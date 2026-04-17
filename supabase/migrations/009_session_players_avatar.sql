-- Ajouter le champ avatar dans session_players
alter table public.session_players
  add column if not exists avatar text;
