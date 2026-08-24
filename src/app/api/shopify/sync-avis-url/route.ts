import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { setAvisUrlMetafield } from '@/lib/shopify/admin'

export const maxDuration = 30

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} (${ms}ms)`)), ms)
    ),
  ])
}

function reviewUrl(wineId: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL!.replace(/\/$/, '')
  return `${base}/app/cave/pepites?wine=${wineId}`
}

// POST { wineId } → sync un seul vin.
// Le sync groupé (tout le catalogue) est piloté côté client en bouclant sur cette
// route vin par vin, pour éviter un timeout serverless (60s max) sur un gros catalogue.
export async function POST(req: Request) {
  const missing = [
    !process.env.SHOPIFY_ADMIN_API_TOKEN && 'SHOPIFY_ADMIN_API_TOKEN',
    !process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN && 'NEXT_PUBLIC_SHOPIFY_DOMAIN',
    !process.env.NEXT_PUBLIC_APP_URL && 'NEXT_PUBLIC_APP_URL',
    !process.env.SUPABASE_SERVICE_ROLE_KEY && 'SUPABASE_SERVICE_ROLE_KEY',
    !process.env.NEXT_PUBLIC_SUPABASE_URL && 'NEXT_PUBLIC_SUPABASE_URL',
  ].filter(Boolean)
  if (missing.length) {
    return NextResponse.json({ error: `Variables manquantes: ${missing.join(', ')}` }, { status: 500 })
  }

  try {
    // Auth via Bearer token (session admin)
    const token = req.headers.get('Authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const adminClient = createAdminClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { data: { user } } = await withTimeout(adminClient.auth.getUser(token), 5000, 'auth.getUser')
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await withTimeout(
      adminClient.from('profiles').select('role').eq('id', user.id).single(),
      5000,
      'profiles.select'
    )
    if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const body = await req.json().catch(() => ({}))
    const { wineId } = body as { wineId?: string }
    if (!wineId) return NextResponse.json({ error: 'wineId requis' }, { status: 400 })

    const { data: wine } = await adminClient
      .from('catalog_wines').select('id, shopify_url').eq('id', wineId).single()
    if (!wine) return NextResponse.json({ error: 'Vin introuvable' }, { status: 404 })
    if (!wine.shopify_url) return NextResponse.json({ error: 'Pas de lien Shopify pour ce vin' }, { status: 400 })

    const result = await setAvisUrlMetafield(wine.shopify_url, reviewUrl(wine.id))
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 })
    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
