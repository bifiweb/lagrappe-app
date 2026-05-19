import { NextResponse } from 'next/server'

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN ?? 'la-grappe.myshopify.com'
const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN

function gqlQuery(cursor: string | null) {
  return `{
    products(first: 250, sortKey: TITLE${cursor ? `, after: "${cursor}"` : ''}) {
      pageInfo { hasNextPage endCursor }
      edges { node {
        handle
        metafields(identifiers: [
          {namespace: "shopify", key: "region"},
          {namespace: "my_fields", key: "pdf"}
        ]) {
          namespace key value
          reference {
            ... on GenericFile { url }
            ... on Metaobject { field(key: "name") { value } }
          }
          references(first: 1) {
            nodes {
              ... on Metaobject { field(key: "name") { value } }
            }
          }
        }
      }}
    }
  }`
}

function detectWineType(tags: string[], productType: string): string {
  const haystack = [...tags, productType].map(s => s.toLowerCase()).join(' ')
  if (haystack.includes('blanc') || haystack.includes('white')) return 'blanc'
  if (haystack.includes('ros')) return 'rose'
  if (haystack.includes('pétillant') || haystack.includes('petillant') || haystack.includes('mousseux') || haystack.includes('sparkling')) return 'petillant'
  return 'rouge'
}

export async function GET() {
  try {
    // 1. Produits via API publique (paginé)
    const raw: any[] = []
    let nextUrl: string | null = `https://${SHOPIFY_DOMAIN}/products.json?limit=250`
    while (nextUrl) {
      const res = await fetch(nextUrl, { headers: { 'Accept': 'application/json' }, next: { revalidate: 0 } })
      if (!res.ok) {
        return NextResponse.json({ error: `Shopify ${res.status} — vérifie le domaine (${SHOPIFY_DOMAIN})` }, { status: 502 })
      }
      const json = await res.json()
      raw.push(...(json?.products ?? []))
      const linkHeader = res.headers.get('Link')
      const nextMatch = linkHeader?.match(/<([^>]+)>;\s*rel="next"/)
      nextUrl = nextMatch?.[1] ?? null
    }

    // 2. Metafields région + PDF via Storefront API (paginé)
    const metaByHandle: Record<string, { region?: string; pdf?: string }> = {}
    let metaDebug: any = null
    if (STOREFRONT_TOKEN) {
      let cursor: string | null = null
      let hasNextPage = true
      let totalFetched = 0
      let lastStatus = 0

      while (hasNextPage) {
        const gqlRes = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN },
          body: JSON.stringify({ query: gqlQuery(cursor) }),
          next: { revalidate: 0 },
        })
        lastStatus = gqlRes.status
        if (!gqlRes.ok) break
        const gql = await gqlRes.json()
        if (gql?.errors) { metaDebug = { status: lastStatus, errors: gql.errors }; break }

        const productsData = gql?.data?.products
        hasNextPage = productsData?.pageInfo?.hasNextPage ?? false
        cursor = productsData?.pageInfo?.endCursor ?? null

        for (const { node } of productsData?.edges ?? []) {
          const mfs: any[] = node.metafields ?? []
          const regionMf = mfs.find((m: any) => m?.namespace === 'shopify' && m?.key === 'region')
          const pdfMf = mfs.find((m: any) => m?.namespace === 'my_fields' && m?.key === 'pdf')
          metaByHandle[node.handle] = {
            region: regionMf?.reference?.field?.value
              ?? regionMf?.references?.nodes?.[0]?.field?.value
              ?? null,
            pdf: pdfMf?.reference?.url ?? pdfMf?.value ?? undefined,
          }
          totalFetched++
        }
      }
      metaDebug = { status: lastStatus, totalFetched }
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
