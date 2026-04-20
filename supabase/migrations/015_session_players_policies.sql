-- Permettre aux utilisateurs de quitter une session (supprimer leur propre ligne)
create policy "Players can leave session"
  on public.session_players for delete using (auth.uid() = user_id);

-- Permettre aux joueurs de rejoindre une session (insert leur propre ligne)
create policy "Players can join session"
  on public.session_players for insert with check (auth.uid() = user_id);

-- Permettre aux joueurs de mettre à jour leur propre ligne (tasting_done, points...)
create policy "Players can update own session player"
  on public.session_players for update using (auth.uid() = user_id);
