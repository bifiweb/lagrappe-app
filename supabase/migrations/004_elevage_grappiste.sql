-- Ajouter l'élevage dans les notes officielles grappistes
alter table public.grappiste_notes
  add column elevage text;
