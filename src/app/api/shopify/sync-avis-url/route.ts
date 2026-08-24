import { createClient as createAdminClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { setAvisUrlMetafield } from '@/lib/shopify/admin'

export const maxDuration = 60

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

// POST { wineId } → sync un seul vin. POST { all: true } → sync tout le catalogue.
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
    const { wineId, all } = body as { wineId?: string; all?: boolean }

    let wines: { id: string; shopify_url: string | null }[] = []
    if (all) {
      const { data } = await adminClient
        .from('catalog_wines').select('id, shopify_url').not('shopify_url', 'is', null)
      wines = data ?? []
    } else if (wineId) {
      const { data } = await adminClient
        .from('catalog_wines').select('id, shopify_url').eq('id', wineId).single()
      if (data) wines = [data]
    } else {
      return NextResponse.json({ error: 'wineId ou all requis' }, { status: 400 })
    }

    const results: { wineId: string; ok: boolean; error?: string }[] = []
    for (const wine of wines) {
      if (!wine.shopify_url) {
        results.push({ wineId: wine.id, ok: false, error: 'Pas de lien Shopify' })
        continue
      }
      try {
        const res = await setAvisUrlMetafield(wine.shopify_url, reviewUrl(wine.id))
        results.push({ wineId: wine.id, ok: res.ok, error: res.error })
      } catch (e: any) {
        results.push({ wineId: wine.id, ok: false, error: e.message })
      }
      // petite pause pour rester sous le rate limit de l'Admin API
      if (wines.length > 1) await new Promise(r => setTimeout(r, 300))
    }

    const failed = results.filter(r => !r.ok)
    return NextResponse.json({ synced: results.length - failed.length, failed })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
