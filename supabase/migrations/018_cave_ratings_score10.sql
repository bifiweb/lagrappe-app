-- Mise à jour cave_ratings pour accepter une note sur 10 (au lieu de 5 étoiles)
alter table public.cave_ratings
  drop constraint if exists cave_ratings_stars_check;

alter table public.cave_ratings
  alter column stars type smallint using stars::smallint,
  alter column stars drop not null,
  alter column stars set default null;

alter table public.cave_ratings
  add constraint cave_ratings_stars_check check (stars is null or (stars >= 0 and stars <= 10));
