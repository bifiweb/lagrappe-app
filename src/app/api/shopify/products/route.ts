import { NextResponse } from 'next/server'

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN ?? 'la-grappe.myshopify.com'
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_TOKEN

const SWISS_REGIONS = ['Valais', 'Vaud', 'Genève', 'Geneve', 'Tessin', 'Neuchâtel', 'Neuchatel', 'Grisons', 'Fribourg', 'Zurich', 'Schaffhouse', 'Thurgovie', 'Berne', 'Argovie']

function detectRegionFromTags(tags: string[]): string | null {
  const haystack = tags.map(s => s.toLowerCase())
  for (const region of SWISS_REGIONS) {
    if (haystack.some(t => t.includes(region.toLowerCase()))) return region
  }
  return null
}

function detectWineType(tags: string[], productType: string): string {
  const haystack = [...tags, productType].map(s => s.toLowerCase()).join(' ')
  if (haystack.includes('blanc') || haystack.includes('white')) return 'blanc'
  if (haystack.includes('ros')) return 'rose'
  if (haystack.includes('pétillant') || haystack.includes('petillant') || haystack.includes('mousseux') || haystack.includes('sparkling')) return 'petillant'
  return 'rouge'
}

const GQL_QUERY = `{
  products(first: 250, sortKey: TITLE) {
    edges { node {
      handle
      metafields(identifiers: [
        {namespace: "shopify", key: "region"}
      ]) { namespace key value }
    }}
  }
}`

export async function GET() {
  try {
    // 1. Produits via API publique
    const res = await fetch(
      `https://${SHOPIFY_DOMAIN}/products.json?limit=250`,
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 0 } }
    )
    if (!res.ok) {
      return NextResponse.json({ error: `Shopify ${res.status} — vérifie le domaine (${SHOPIFY_DOMAIN})` }, { status: 502 })
    }
    const json = await res.json()
    const raw: any[] = json?.products ?? []

    // 2. Metafield shopify.region via Admin API GraphQL
    const regionByHandle: Record<string, string> = {}
    if (ADMIN_TOKEN) {
      try {
        const gqlRes = await fetch(`https://${SHOPIFY_DOMAIN}/admin/api/2024-01/graphql.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': ADMIN_TOKEN },
          body: JSON.stringify({ query: GQL_QUERY }),
          next: { revalidate: 0 },
        })
        if (gqlRes.ok) {
          const gql = await gqlRes.json()
          for (const { node } of gql?.data?.products?.edges ?? []) {
            const regionMf = (node.metafields ?? []).find((m: any) => m?.namespace === 'shopify' && m?.key === 'region')
            if (regionMf?.value) regionByHandle[node.handle] = regionMf.value
          }
        }
      } catch {} // fallback silencieux sur les tags
    }

    const products = raw.map((p: any) => {
      const tags: string[] = Array.isArray(p.tags) ? p.tags : (p.tags ? String(p.tags).split(', ') : [])
      return {
        shopify_id: String(p.id),
        name: p.title,
        cave: p.vendor || null,
        cepage: p.product_type || null,
        region: regionByHandle[p.handle] ?? detectRegionFromTags(tags),
        type: detectWineType(tags, p.product_type ?? ''),
        description: p.body_html ? (() => { const t = p.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > 600 ? t.slice(0, 600) + '…' : t || null })() : null,
        image_url: p.images?.[0]?.src ?? null,
        prix_chf: p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : null,
        shopify_url: `https://${SHOPIFY_DOMAIN}/products/${p.handle}`,
        pdf_url: null,
        tags,
      }
    })

    return NextResponse.json({ products })
  } catch (e: any) {
    return NextResponse.json({ error: `${e.message} — domaine: "${SHOPIFY_DOMAIN}"` }, { status: 500 })
  }
}
