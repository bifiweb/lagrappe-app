import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN!
const SHOPIFY_ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN!

const QUERY = `{
  products(first: 100, sortKey: TITLE) {
    edges {
      node {
        id
        title
        vendor
        productType
        handle
        description
        images(first: 1) { edges { node { url } } }
        priceRangeV2 { minVariantPrice { amount } }
        tags
        metafields(identifiers: [
          {namespace: "custom", key: "nom_du_vin"},
          {namespace: "custom", key: "millesime"},
          {namespace: "custom", key: "region"}
        ]) { namespace key value }
      }
    }
  }
}`

function detectType(tags: string[]): string {
  const t = tags.map(s => s.toLowerCase())
  if (t.some(s => s.includes('blanc') || s === 'white')) return 'blanc'
  if (t.some(s => s.includes('ros'))) return 'rose'
  if (t.some(s => s.includes('pétillant') || s.includes('petillant') || s.includes('mousseux') || s.includes('sparkling'))) return 'petillant'
  return 'rouge'
}

export async function GET() {
  // Vérification admin via Supabase
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })
  const { data: prof } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (prof?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  if (!SHOPIFY_ADMIN_TOKEN) {
    return NextResponse.json({ error: 'SHOPIFY_ADMIN_API_TOKEN manquant dans .env' }, { status: 500 })
  }

  const res = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_ADMIN_TOKEN,
    },
    body: JSON.stringify({ query: QUERY }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Shopify API error: ${text}` }, { status: 502 })
  }

  const json = await res.json()
  const edges = json?.data?.products?.edges ?? []

  const products = edges.map(({ node }: any) => {
    const mf: Record<string, string> = {}
    for (const m of (node.metafields ?? [])) {
      if (m) mf[m.key] = m.value
    }
    return {
      shopify_id: node.id,
      name: mf['nom_du_vin'] || node.title,
      cave: node.vendor || null,
      cepage: node.productType || null,
      millesime: mf['millesime'] ? parseInt(mf['millesime']) : null,
      region: mf['region'] || null,
      type: detectType(node.tags ?? []),
      description: node.description || null,
      image_url: node.images?.edges?.[0]?.node?.url ?? null,
      prix_chf: node.priceRangeV2?.minVariantPrice?.amount
        ? parseFloat(node.priceRangeV2.minVariantPrice.amount)
        : null,
      shopify_url: `https://${SHOPIFY_DOMAIN}/products/${node.handle}`,
      tags: node.tags ?? [],
    }
  })

  return NextResponse.json({ products })
}
