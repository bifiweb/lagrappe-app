-- ============================================================
-- CAVE RATINGS — Notes manuelles sur les vins (hors jeu)
-- ============================================================

create table public.cave_ratings (
  id                 uuid primary key default uuid_generate_v4(),
  wine_id            uuid not null references public.wines(id) on delete cascade,
  user_id            uuid not null references public.profiles(id) on delete cascade,
  stars              numeric(2,1) not null default 0 check (stars >= 0 and stars <= 5),
  notes_degustation  text,
  design_rating      int check (design_rating between 1 and 5),
  valeur_rating      int check (valeur_rating between 1 and 5),
  racheterait        boolean,
  notes_libres       text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (wine_id, user_id)
);

alter table public.cave_ratings enable row level security;

create policy "Users see own ratings"
  on public.cave_ratings for select using (auth.uid() = user_id);

create policy "Users manage own ratings"
  on public.cave_ratings for all using (auth.uid() = user_id);

-- Admin voit tout pour les rapports agrégés
create policy "Admins see all ratings"
  on public.cave_ratings for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

alter publication supabase_realtime add table public.cave_ratings;
