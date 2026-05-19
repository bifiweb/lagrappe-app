import { NextResponse } from 'next/server'

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN ?? 'la-grappe.myshopify.com'
const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN

function gqlQuery(cursor: string | null) {
  return `{
    products(first: 250, sortKey: TITLE${cursor ? `, after: "${cursor}"` : ''}) {
      pageInfo { hasNextPage endCursor }
      edges { node {
        id
        handle
        title
        vendor
        productType
        descriptionHtml
        tags
        images(first: 1) { edges { node { url } } }
        variants(first: 1) { edges { node { price { amount } } } }
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
    if (!STOREFRONT_TOKEN) {
      return NextResponse.json({ error: 'NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN manquant' }, { status: 500 })
    }

    const products: any[] = []
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
      if (!gqlRes.ok) {
        return NextResponse.json({ error: `Shopify GraphQL ${gqlRes.status}` }, { status: 502 })
      }
      const gql = await gqlRes.json()
      if (gql?.errors) {
        return NextResponse.json({ error: 'Erreur GraphQL Shopify', details: gql.errors }, { status: 502 })
      }

      const productsData = gql?.data?.products
      hasNextPage = productsData?.pageInfo?.hasNextPage ?? false
      cursor = productsData?.pageInfo?.endCursor ?? null

      for (const { node: p } of productsData?.edges ?? []) {
        const tags: string[] = p.tags ?? []
        const mfs: any[] = p.metafields ?? []
        const regionMf = mfs.find((m: any) => m?.namespace === 'shopify' && m?.key === 'region')
        const pdfMf = mfs.find((m: any) => m?.namespace === 'my_fields' && m?.key === 'pdf')
        const region = regionMf?.reference?.field?.value
          ?? regionMf?.references?.nodes?.[0]?.field?.value
          ?? null
        const pdf = pdfMf?.reference?.url ?? pdfMf?.value ?? null
        const rawHtml = p.descriptionHtml ?? ''
        const descText = rawHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
        const gidParts = (p.id as string).split('/')
        products.push({
          shopify_id: gidParts[gidParts.length - 1],
          name: p.title,
          cave: p.vendor || null,
          cepage: p.productType || null,
          region,
          type: detectWineType(tags, p.productType ?? ''),
          description: descText.length > 600 ? descText.slice(0, 600) + '…' : descText || null,
          image_url: p.images?.edges?.[0]?.node?.url ?? null,
          prix_chf: p.variants?.edges?.[0]?.node?.price?.amount ? parseFloat(p.variants.edges[0].node.price.amount) : null,
          shopify_url: `https://${SHOPIFY_DOMAIN}/products/${p.handle}`,
          pdf_url: pdf,
          tags,
        })
        totalFetched++
      }
    }

    const withPdf = products.filter(p => p.pdf_url)
    const withRegion = products.filter(p => p.region)
    return NextResponse.json({ products, _debug: { status: lastStatus, totalFetched, withPdfCount: withPdf.length, withRegionCount: withRegion.length, samplePdf: withPdf[0] ?? null } })
  } catch (e: any) {
    return NextResponse.json({ error: `${e.message} — domaine: "${SHOPIFY_DOMAIN}"` }, { status: 500 })
  }
}
