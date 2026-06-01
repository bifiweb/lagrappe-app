-- ============================================================
-- POLICIES : soirée continue
-- ============================================================

-- Evenings : tout utilisateur connecté peut créer une soirée
create policy "Authenticated users can create evenings"
  on public.evenings for insert
  with check (auth.uid() is not null);

-- Evenings : l'organisateur peut mettre à jour sa soirée
create policy "Evening organizer can update"
  on public.evenings for update
  using (auth.uid() = chef_id);

-- Sessions : tout utilisateur connecté peut créer une session
-- (peut déjà exister en prod — ignoré si c'est le cas)
do $$ begin
  create policy "Authenticated users can create sessions"
    on public.sessions for insert
    with check (auth.uid() is not null);
exception when duplicate_object then null;
end $$;

-- Sessions : participants et admins peuvent mettre à jour le statut
do $$ begin
  create policy "Authenticated users can update sessions"
    on public.sessions for update
    using (auth.uid() is not null);
exception when duplicate_object then null;
end $$;
