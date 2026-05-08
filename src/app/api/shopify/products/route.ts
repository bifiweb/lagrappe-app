import { NextResponse } from 'next/server'

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN ?? 'la-grappe.myshopify.com'
const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN

const GQL_QUERY = `{
  products(first: 250, sortKey: TITLE) {
    edges { node {
      handle
      metafields(identifiers: [
        {namespace: "shopify", key: "region"},
        {namespace: "my_fields", key: "pdf"}
      ]) {
        namespace key value
        reference {
          ... on GenericFile { url }
        }
      }
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

    // 2. Metafields région + PDF via Storefront API
    const metaByHandle: Record<string, { region?: string; pdf?: string }> = {}
    let metaDebug: any = null
    if (STOREFRONT_TOKEN) {
      const gqlRes = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN },
        body: JSON.stringify({ query: GQL_QUERY }),
        next: { revalidate: 0 },
      })
      const gql = await gqlRes.json()
      const firstEdge = gql?.data?.products?.edges?.[0]
      metaDebug = {
        status: gqlRes.status,
        errors: gql?.errors,
        firstProduct: firstEdge ? { handle: firstEdge.node.handle, metafields: firstEdge.node.metafields } : null,
      }
      if (gqlRes.ok && !gql?.errors) {
        for (const { node } of gql?.data?.products?.edges ?? []) {
          const mfs: any[] = node.metafields ?? []
          const pdfMf = mfs.find((m: any) => m?.namespace === 'my_fields' && m?.key === 'pdf')
          metaByHandle[node.handle] = {
            region: mfs.find((m: any) => m?.namespace === 'shopify' && m?.key === 'region')?.value,
            pdf: pdfMf?.reference?.url ?? pdfMf?.value ?? undefined,
          }
        }
      }
    } else {
      metaDebug = { status: 'no token' }
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
        description: p.body_html ? (() => { const t = p.body_html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); return t.length > 600 ? t.slice(0, 600) + '…' : t || null })() : null,
        image_url: p.images?.[0]?.src ?? null,
        prix_chf: p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : null,
        shopify_url: `https://${SHOPIFY_DOMAIN}/products/${p.handle}`,
        pdf_url: meta.pdf || null,
        tags,
      }
    })

    const withPdf = products.filter(p => p.pdf_url)
    const withRegion = products.filter(p => p.region)
    return NextResponse.json({ products, _debug: { ...metaDebug, withPdfCount: withPdf.length, withRegionCount: withRegion.length, samplePdf: withPdf[0] ?? null } })
  } catch (e: any) {
    return NextResponse.json({ error: `${e.message} — domaine: "${SHOPIFY_DOMAIN}"` }, { status: 500 })
  }
}
