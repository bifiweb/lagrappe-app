-- Ajout des champs appréciation unifiés dans la table tastings
alter table public.tastings
  add column if not exists notes_degustation text null,
  add column if not exists design_rating smallint null,
  add column if not exists valeur_rating smallint null,
  add column if not exists racheterait boolean null;
