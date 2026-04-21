import { NextResponse } from 'next/server'

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN ?? 'la-grappe.myshopify.com'
const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN

// Requête Storefront GraphQL pour les metafields (millésime, région) si token disponible
const GQL_QUERY = `{
  products(first: 250, sortKey: TITLE) {
    edges { node {
      id handle
      millesime: metafield(namespace: "custom", key: "millesime") { value }
      region: metafield(namespace: "custom", key: "region") { value }
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

function extractMillesime(title: string): number | null {
  const match = title.match(/\b(19[5-9]\d|20[0-3]\d)\b/)
  return match ? parseInt(match[1]) : null
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
    const metaByHandle: Record<string, { millesime?: string, region?: string }> = {}
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
            metaByHandle[node.handle] = {
              millesime: node.millesime?.value,
              region: node.region?.value,
            }
          }
        }
      } catch {} // silencieux si Storefront indispo
    }

    const products = raw.map((p: any) => {
      const tags: string[] = Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(', ') : [])
      const meta = metaByHandle[p.handle] ?? {}
      const millesime = meta.millesime ? parseInt(meta.millesime) : extractMillesime(p.title)
      return {
        shopify_id: String(p.id),
        name: p.title,
        cave: p.vendor || null,
        cepage: p.product_type || null,
        millesime: millesime || null,
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
