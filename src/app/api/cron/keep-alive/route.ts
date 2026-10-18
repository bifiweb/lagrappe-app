import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Appelée une fois par jour par Vercel Cron (voir vercel.json) : une requête légère
// suffit pour que Supabase (plan gratuit) ne mette pas le projet en pause après 7 jours d'inactivité.
export async function GET(req: Request) {
  // Si CRON_SECRET est défini sur Vercel, Vercel l'envoie en Bearer : on refuse les autres appels.
  if (process.env.CRON_SECRET && req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )

  const { error } = await supabase.from('catalog_wines').select('id').limit(1)
  if (error) {
    console.error('[cron/keep-alive]', error.message)
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
