// ============================================================
// Shopify Storefront API — La Grappe
// ============================================================

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN!
const SHOPIFY_TOKEN  = process.env.NEXT_PUBLIC_SHOPIFY_STOREFRONT_TOKEN!
const API_URL = `https://${SHOPIFY_DOMAIN}/api/2024-01/graphql.json`

async function shopifyFetch(query: string, variables = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Storefront-Access-Token': SHOPIFY_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  })
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0].message)
  return json.data
}

// Récupérer un produit par son ID Shopify
export async function getShopifyProduct(productId: string) {
  const data = await shopifyFetch(`
    query GetProduct($id: ID!) {
      product(id: $id) {
        id
        title
        handle
        description
        images(first: 1) { nodes { url altText } }
        variants(first: 1) {
          nodes {
            id
            price { amount currencyCode }
            availableForSale
          }
        }
      }
    }
  `, { id: `gid://shopify/Product/${productId}` })
  return data.product
}

// Construire le lien d'achat direct (avec variant)
export function buildShopifyCheckoutUrl(variantId: string, quantity = 1): string {
  return `https://${SHOPIFY_DOMAIN}/cart/${variantId}:${quantity}`
}

// Récupérer l'image d'un produit pour l'afficher dans le reveal
export async function getWineImageUrl(shopifyProductId: string): Promise<string | null> {
  try {
    const product = await getShopifyProduct(shopifyProductId)
    return product?.images?.nodes?.[0]?.url ?? null
  } catch {
    return null
  }
}
