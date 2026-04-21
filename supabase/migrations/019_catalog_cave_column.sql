-- Ajout de la colonne "cave" (producteur/vendor Shopify) dans catalog_wines
alter table public.catalog_wines
  add column if not exists cave text null;

-- Index unique sur shopify_url pour permettre l'upsert lors de l'import Shopify
create unique index if not exists catalog_wines_shopify_url_key
  on public.catalog_wines (shopify_url)
  where shopify_url is not null;
