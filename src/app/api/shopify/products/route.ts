import { NextResponse } from 'next/server'

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN ?? 'la-grappe.myshopify.com'

function detectWineType(tags: string[], productType: string): string {
  const haystack = [...tags, productType].map(s => s.toLowerCase()).join(' ')
  if (haystack.includes('blanc') || haystack.includes('white')) return 'blanc'
  if (haystack.includes('ros')) return 'rose'
  if (haystack.includes('pétillant') || haystack.includes('petillant') || haystack.includes('mousseux') || haystack.includes('sparkling')) return 'petillant'
  return 'rouge'
}

export async function GET() {
  try {
    // API JSON publique Shopify — aucun token requis
    const res = await fetch(
      `https://${SHOPIFY_DOMAIN}/products.json?limit=250`,
      { headers: { 'Accept': 'application/json' }, next: { revalidate: 0 } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: `Shopify ${res.status} — vérifie le domaine (${SHOPIFY_DOMAIN})` }, { status: 502 })
    }

    const json = await res.json()
    const raw = json?.products ?? []

    const products = raw.map((p: any) => ({
      shopify_id: String(p.id),
      name: p.title,
      cave: p.vendor || null,
      cepage: p.product_type || null,
      millesime: null,
      region: null,
      type: detectWineType(p.tags ? p.tags.split(', ') : [], p.product_type ?? ''),
      description: p.body_html ? p.body_html.replace(/<[^>]+>/g, '').trim().slice(0, 500) || null : null,
      image_url: p.images?.[0]?.src ?? null,
      prix_chf: p.variants?.[0]?.price ? parseFloat(p.variants[0].price) : null,
      shopify_url: `https://${SHOPIFY_DOMAIN}/products/${p.handle}`,
      tags: p.tags ? p.tags.split(', ') : [],
    }))

    return NextResponse.json({ products })
  } catch (e: any) {
    return NextResponse.json({ error: `${e.message} — domaine: "${SHOPIFY_DOMAIN}"` }, { status: 500 })
  }
}
