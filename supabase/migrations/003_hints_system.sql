-- ============================================================
-- HINTS SYSTEM — Aide pendant la dégustation
-- ============================================================

-- 1. Ajouter la colonne hints_used à tastings
alter table public.tastings
  add column hints_used integer not null default 0;

-- 2. Fonction sécurisée pour obtenir les options à éliminer
--    (security definer = peut lire grappiste_notes sans restriction RLS)
--    Retourne uniquement les options à éliminer, jamais la bonne réponse.
create or replace function public.get_hint(
  p_wine_id         uuid,
  p_section         text,
  p_all_options     text[],
  p_already_eliminated text[]
) returns text[] as $$
declare
  v_notes   public.grappiste_notes%rowtype;
  v_correct text[];
  v_wrong   text[];
  v_count   int;
  v_result  text[];
begin
  select * into v_notes from public.grappiste_notes where wine_id = p_wine_id;
  if not found then return array[]::text[]; end if;

  -- Déterminer la/les bonne(s) réponse(s) selon la section
  case p_section
    when 'aromes' then
      v_correct := array(select jsonb_array_elements_text(v_notes.aromes_officiels));
    when 'cepage' then
      v_correct := array[v_notes.cepage];
    when 'region' then
      v_correct := array[v_notes.region];
    when 'prix' then
      v_correct := array[v_notes.prix_chf];
    else
      return array[]::text[];
  end case;

  -- Mauvaises réponses non encore éliminées
  select array_agg(opt) into v_wrong
  from unnest(p_all_options) as opt
  where (v_correct is null or opt != all(v_correct))
    and (p_already_eliminated is null or opt != all(p_already_eliminated));

  if v_wrong is null or array_length(v_wrong, 1) = 0 then
    return coalesce(p_already_eliminated, array[]::text[]);
  end if;

  -- Éliminer 1/3 arrondi au supérieur
  v_count := greatest(1, ceil(array_length(v_wrong, 1)::numeric / 3)::int);

  select array_agg(opt) into v_result
  from (
    select opt from unnest(v_wrong) as opt
    order by random()
    limit v_count
  ) sub;

  return coalesce(v_result, array[]::text[]);
end;
$$ language plpgsql security definer;

-- Permettre aux utilisateurs authentifiés d'appeler la fonction
grant execute on function public.get_hint(uuid, text, text[], text[]) to authenticated;

-- 3. Mettre à jour la fonction de scoring pour appliquer la pénalité d'aide
create or replace function public.calculate_session_scores(p_session_id uuid)
returns void as $$
declare
  v_wine        public.wines%rowtype;
  v_notes       public.grappiste_notes%rowtype;
  v_tasting     public.tastings%rowtype;
  v_arome       text;
  v_arome_count int;
  v_pts_aromes  int;
  v_total       int;
begin
  -- Récupérer le vin et les notes officielles
  select w.* into v_wine
  from public.sessions s
  join public.wines w on w.id = s.wine_id
  where s.id = p_session_id;

  select * into v_notes
  from public.grappiste_notes
  where wine_id = v_wine.id;

  -- Pour chaque tasting de la session
  for v_tasting in
    select * from public.tastings where session_id = p_session_id
  loop
    v_total := 0;

    -- 1. ROBE (300 si correct, 100 sinon)
    if v_tasting.robe = v_notes.robe then
      update public.tastings set pts_robe = 300 where id = v_tasting.id;
      v_total := v_total + 300;
    else
      update public.tastings set pts_robe = 100 where id = v_tasting.id;
      v_total := v_total + 100;
    end if;

    -- 2. ARÔMES
    v_pts_aromes := 0;
    for v_arome in select jsonb_array_elements_text(v_tasting.aromes)
    loop
      select count(*) into v_arome_count
      from public.tastings
      where session_id = p_session_id
        and aromes @> to_jsonb(v_arome::text);

      v_pts_aromes := v_pts_aromes + ((v_arome_count - 1) * 100);

      if v_notes.aromes_officiels @> to_jsonb(v_arome::text) then
        v_pts_aromes := v_pts_aromes + 50;
      end if;
    end loop;
    update public.tastings set pts_aromes = v_pts_aromes where id = v_tasting.id;
    v_total := v_total + v_pts_aromes;

    -- 3. BOUCHE (300 si correct, 100 sinon)
    if v_tasting.bouche = v_notes.bouche then
      update public.tastings set pts_bouche = 300 where id = v_tasting.id;
      v_total := v_total + 300;
    else
      update public.tastings set pts_bouche = 100 where id = v_tasting.id;
      v_total := v_total + 100;
    end if;

    -- 4. PRIX (500 si bonne fourchette, 100 sinon)
    if v_tasting.prix_estime = v_notes.prix_chf then
      update public.tastings set pts_prix = 500 where id = v_tasting.id;
      v_total := v_total + 500;
    else
      update public.tastings set pts_prix = 100 where id = v_tasting.id;
      v_total := v_total + 100;
    end if;

    -- 5. MILLÉSIME (400 si correct, 100 sinon)
    if v_tasting.millesime_estime = v_notes.millesime then
      update public.tastings set pts_millesime = 400 where id = v_tasting.id;
      v_total := v_total + 400;
    else
      update public.tastings set pts_millesime = 100 where id = v_tasting.id;
      v_total := v_total + 100;
    end if;

    -- 6. CÉPAGE (1000 si correct, 200 sinon)
    if lower(v_tasting.cepage_guess) = lower(v_notes.cepage) then
      update public.tastings set pts_cepage = 1000 where id = v_tasting.id;
      v_total := v_total + 1000;
    else
      update public.tastings set pts_cepage = 200 where id = v_tasting.id;
      v_total := v_total + 200;
    end if;

    -- 7. RÉGION (1000 si correct, 200 sinon)
    if lower(v_tasting.region_guess) = lower(v_notes.region) then
      update public.tastings set pts_region = 1000 where id = v_tasting.id;
      v_total := v_total + 1000;
    else
      update public.tastings set pts_region = 200 where id = v_tasting.id;
      v_total := v_total + 200;
    end if;

    -- 8. MALUS AIDES (-100 pts par aide utilisée)
    v_total := v_total - (v_tasting.hints_used * 100);
    if v_total < 0 then v_total := 0; end if;

    -- Mettre à jour le total
    update public.tastings
    set total_points = v_total
    where id = v_tasting.id;

    -- Mettre à jour session_players
    update public.session_players
    set points_session = v_total
    where session_id = p_session_id and user_id = v_tasting.user_id;

  end loop;

  -- Cumuler les points dans points_evening si soirée continue
  update public.session_players sp
  set points_evening = (
    select coalesce(sum(sp2.points_session), 0)
    from public.session_players sp2
    join public.sessions s on s.id = sp2.session_id
    where sp2.user_id = sp.user_id
      and s.evening_id = (select evening_id from public.sessions where id = p_session_id)
  )
  where session_id = p_session_id
    and (select evening_id from public.sessions where id = p_session_id) is not null;

  -- Marquer le vin comme révélé et la session comme terminée
  update public.wines set revealed = true where id = v_wine.id;
  update public.sessions
  set status = 'revealed', revealed_at = now()
  where id = p_session_id;

end;
$$ language plpgsql security definer;
