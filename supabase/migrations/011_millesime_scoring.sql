-- ============================================================
-- SCORING — Millésime progressif (comme le prix)
-- 500 pts si juste · −100 pts par année d'écart (min 0)
-- ============================================================

create or replace function public.calculate_session_scores(p_session_id uuid)
returns void as $$
declare
  v_wine        public.wines%rowtype;
  v_notes       public.grappiste_notes%rowtype;
  v_tasting     public.tastings%rowtype;
  v_arome       text;
  v_arome_count int;
  v_pts_aromes  int;
  v_pts_prix    int;
  v_pts_mil     int;
  v_diff_prix   numeric;
  v_diff_mil    int;
  v_total       int;
begin
  select w.* into v_wine
  from public.sessions s
  join public.wines w on w.id = s.wine_id
  where s.id = p_session_id;

  select * into v_notes
  from public.grappiste_notes
  where wine_id = v_wine.id;

  for v_tasting in
    select * from public.tastings where session_id = p_session_id
  loop
    v_total := 0;

    -- 1. ROBE
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

      v_pts_aromes := v_pts_aromes + (v_arome_count * 300);

      if v_notes.aromes_officiels @> to_jsonb(v_arome::text) then
        v_pts_aromes := v_pts_aromes + 300;
      end if;
    end loop;
    update public.tastings set pts_aromes = v_pts_aromes where id = v_tasting.id;
    v_total := v_total + v_pts_aromes;

    -- 3. BOUCHE
    if v_tasting.bouche = v_notes.bouche then
      update public.tastings set pts_bouche = 300 where id = v_tasting.id;
      v_total := v_total + 300;
    else
      update public.tastings set pts_bouche = 100 where id = v_tasting.id;
      v_total := v_total + 100;
    end if;

    -- 4. PRIX (500 si exact · −50 pts/CHF · min 0)
    if v_tasting.prix_estime is not null
       and v_notes.prix_exact is not null
       and v_tasting.prix_estime ~ '^[0-9]+(\.[0-9]+)?$'
    then
      v_diff_prix := abs(v_tasting.prix_estime::numeric - v_notes.prix_exact);
      v_pts_prix  := greatest(0, 500 - (round(v_diff_prix) * 50)::int);
    else
      v_pts_prix := 0;
    end if;
    update public.tastings set pts_prix = v_pts_prix where id = v_tasting.id;
    v_total := v_total + v_pts_prix;

    -- 5. MILLÉSIME (500 si exact · −100 pts par année d'écart · min 0)
    if v_tasting.millesime_estime is not null and v_notes.millesime is not null then
      v_diff_mil := abs(v_tasting.millesime_estime - v_notes.millesime);
      v_pts_mil  := greatest(0, 500 - (v_diff_mil * 100));
    else
      v_pts_mil := 0;
    end if;
    update public.tastings set pts_millesime = v_pts_mil where id = v_tasting.id;
    v_total := v_total + v_pts_mil;

    -- 6. CÉPAGE
    if lower(v_tasting.cepage_guess) = lower(v_notes.cepage) then
      update public.tastings set pts_cepage = 1000 where id = v_tasting.id;
      v_total := v_total + 1000;
    else
      update public.tastings set pts_cepage = 200 where id = v_tasting.id;
      v_total := v_total + 200;
    end if;

    -- 7. RÉGION
    if lower(v_tasting.region_guess) = lower(v_notes.region) then
      update public.tastings set pts_region = 500 where id = v_tasting.id;
      v_total := v_total + 500;
    else
      update public.tastings set pts_region = 100 where id = v_tasting.id;
      v_total := v_total + 100;
    end if;

    -- 8. ÉLEVAGE
    if v_tasting.elevage_guess = v_notes.elevage then
      update public.tastings set pts_elevage = 300 where id = v_tasting.id;
      v_total := v_total + 300;
    else
      update public.tastings set pts_elevage = 100 where id = v_tasting.id;
      v_total := v_total + 100;
    end if;

    -- 9. MALUS AIDES (−200 pts par aide · min 0)
    v_total := greatest(0, v_total - (v_tasting.hints_used * 200));

    update public.tastings
    set total_points = v_total
    where id = v_tasting.id;

    update public.session_players
    set points_session = v_total
    where session_id = p_session_id and user_id = v_tasting.user_id;

  end loop;

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

  update public.wines set revealed = true where id = v_wine.id;
  update public.sessions
  set status = 'revealed', revealed_at = now()
  where id = p_session_id;

end;
$$ language plpgsql security definer;
