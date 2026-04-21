import { NextResponse } from 'next/server'

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN ?? 'la-grappe.myshopify.com'
const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN

// Requête Storefront GraphQL pour les metafields (région) si token disponible
const GQL_QUERY = `{
  products(first: 250, sortKey: TITLE) {
    edges { node {
      id handle
      metafields(identifiers: [
        {namespace: "shopify", key: "region"}
      ]) { namespace key value }
    }}
  }
}`

function detectWineType(tags: string[], productType: string): string {
  const haystack = [...tags, productType].map(s => s.toLowerCase()).join(' ')
  if (haystack.includes('blanc') || haystack.includes('white')) return 'blanc'
  if (haystack.includes('ros')) return 'rose'
  if (haystack.includes('pétillant') || haystack.includes('petillant') || haystack.includes('mousseux') || haystack.includes('sparkling')) return 'petillant'
  return 'rouge'
}


export async function GET() {
  try {
    // 1. API JSON publique — aucun token requis
    const res = await fetch(
      `https://${SHOPIFY_DOMAIN}/products.json?limit=250`,
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 0 } }
    )
    if (!res.ok) {
      return NextResponse.json({ error: `Shopify ${res.status} — vérifie le domaine (${SHOPIFY_DOMAIN})` }, { status: 502 })
    }
    const json = await res.json()
    const raw: any[] = json?.products ?? []

    // 2. Metafields via Storefront API si token disponible
    const metaByHandle: Record<string, { region?: string }> = {}
    if (STOREFRONT_TOKEN) {
      try {
        const gqlRes = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN },
          body: JSON.stringify({ query: GQL_QUERY }),
        })
        if (gqlRes.ok) {
          const gql = await gqlRes.json()
          for (const { node } of gql?.data?.products?.edges ?? []) {
            const mfs: any[] = node.metafields ?? []
            metaByHandle[node.handle] = {
              region: mfs.find(m => m?.namespace === 'shopify' && m?.key === 'region')?.value,
            }
          }
        }
      } catch {} // silencieux si Storefront indispo
    }

    const products = raw.map((p: any) => {
      const tags: string[] = Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(', ') : [])
      const meta = metaByHandle[p.handle] ?? {}
      return {
        shopify_id: String(p.id),
        name: p.title,
        cave: p.vendor || null,
        cepage: p.product_type || null,
        region: meta.region || null,
        type: detectWineType(tags, p.product_type ?? ''),
        description: p.body_html ? p.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600) || null : null,
        image_url: p.images?.[0]?.src ?? null,
        prix_chf: p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : null,
        shopify_url: `https://${SHOPIFY_DOMAIN}/products/${p.handle}`,
        tags,
      }
    })

    return NextResponse.json({ products })
  } catch (e: any) {
    return NextResponse.json({ error: `${e.message} — domaine: "${SHOPIFY_DOMAIN}"` }, { status: 500 })
  }
}
