-- ============================================================
-- CATALOG WINES — Vins de la cave à pépites (indépendant du jeu)
-- ============================================================

create table public.catalog_wines (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  cepage      text,
  region      text,
  millesime   int,
  type        text not null default 'rouge' check (type in ('rouge', 'blanc', 'rose', 'petillant')),
  description text,
  image_url   text,
  prix_chf    numeric(6,2),
  shopify_url text,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

alter table public.catalog_wines enable row level security;

create policy "Catalog wines viewable by everyone"
  on public.catalog_wines for select using (active = true);

create policy "Only admins can manage catalog"
  on public.catalog_wines for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Migrer cave_ratings pour pointer sur catalog_wines
alter table public.cave_ratings
  drop constraint cave_ratings_wine_id_fkey;

alter table public.cave_ratings
  add constraint cave_ratings_wine_id_fkey
  foreign key (wine_id) references public.catalog_wines(id) on delete cascade;
