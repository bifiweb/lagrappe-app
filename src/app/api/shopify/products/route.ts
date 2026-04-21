import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN!
const STOREFRONT_TOKEN = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN!

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
        priceRange { minVariantPrice { amount } }
        tags
        nom_du_vin: metafield(namespace: "custom", key: "nom_du_vin") { value }
        millesime: metafield(namespace: "custom", key: "millesime") { value }
        region: metafield(namespace: "custom", key: "region") { value }
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

export async function GET() { try {
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

  const res = await fetch(`https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': STOREFRONT_TOKEN,
    },
    body: JSON.stringify({ query: QUERY }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Shopify API error: ${text}` }, { status: 502 })
  }

  const json = await res.json()

  if (json.errors) {
    return NextResponse.json({ error: json.errors.map((e: any) => e.message).join(', ') }, { status: 502 })
  }

  const edges = json?.data?.products?.edges ?? []

  const products = edges.map(({ node }: any) => ({
    shopify_id: node.id,
    name: node.nom_du_vin?.value || node.title,
    cave: node.vendor || null,
    cepage: node.productType || null,
    millesime: node.millesime?.value ? parseInt(node.millesime.value) : null,
    region: node.region?.value || null,
    type: detectType(node.tags ?? []),
    description: node.description || null,
    image_url: node.images?.edges?.[0]?.node?.url ?? null,
    prix_chf: node.priceRange?.minVariantPrice?.amount
      ? parseFloat(node.priceRange.minVariantPrice.amount)
      : null,
    shopify_url: `https://${SHOPIFY_DOMAIN}/products/${node.handle}`,
    tags: node.tags ?? [],
  }))

  return NextResponse.json({ products })
} catch (e: any) {
  return NextResponse.json({ error: e.message ?? 'Erreur serveur' }, { status: 500 })
}}
