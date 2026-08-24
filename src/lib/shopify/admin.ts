// ============================================================
// Shopify Admin API — sync du metafield "avis" vers les fiches produit
// (server-only : ne jamais importer ce fichier dans un composant client)
// ============================================================

const SHOPIFY_DOMAIN = process.env.NEXT_PUBLIC_SHOPIFY_DOMAIN!
const ADMIN_TOKEN = process.env.SHOPIFY_ADMIN_API_TOKEN!
const API_URL = `https://${SHOPIFY_DOMAIN}/admin/api/2024-01/graphql.json`

async function adminFetch(query: string, variables: Record<string, unknown> = {}) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': ADMIN_TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  })
  if (!res.ok) throw new Error(`Shopify Admin API ${res.status}`)
  const json = await res.json()
  if (json.errors) throw new Error(json.errors[0]?.message ?? 'Erreur GraphQL Admin API')
  return json.data
}

function handleFromShopifyUrl(shopifyUrl: string): string | null {
  try {
    const match = new URL(shopifyUrl).pathname.match(/\/products\/([^/?#]+)/)
    return match?.[1] ?? null
  } catch {
    return null
  }
}

type SyncResult = { ok: boolean; error?: string }

// Écrit l'URL de notation La grAPP dans le metafield `lagrappe.avis_url`
// du produit Shopify correspondant (retrouvé via le handle de shopify_url).
export async function setAvisUrlMetafield(shopifyUrl: string, avisUrl: string): Promise<SyncResult> {
  const handle = handleFromShopifyUrl(shopifyUrl)
  if (!handle) return { ok: false, error: `URL Shopify invalide : ${shopifyUrl}` }

  const productData = await adminFetch(
    `query GetProductByHandle($handle: String!) {
      productByHandle(handle: $handle) { id }
    }`,
    { handle }
  )

  const productId = productData?.productByHandle?.id
  if (!productId) return { ok: false, error: `Produit Shopify introuvable pour le handle "${handle}"` }

  const result = await adminFetch(
    `mutation SetAvisUrl($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id }
        userErrors { field message code }
      }
    }`,
    {
      metafields: [
        {
          ownerId: productId,
          namespace: 'lagrappe',
          key: 'avis_url',
          type: 'url',
          value: avisUrl,
        },
      ],
    }
  )

  const errors = result?.metafieldsSet?.userErrors
  if (errors?.length) return { ok: false, error: errors.map((e: any) => e.message).join(', ') }
  return { ok: true }
}
