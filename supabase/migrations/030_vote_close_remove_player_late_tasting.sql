-- Vote : clôture sans attendre un joueur absent
alter table public.sessions add column if not exists vote_closed_at timestamptz;

-- Le·la chef·fe (ou l'organisateur·ice de la soirée) peut retirer un joueur.
-- Fonction security definer : une policy de session_players ne peut pas relire cette table sans récursion.
create or replace function public.can_manage_session(p_session_id uuid)
returns boolean as $$
  select exists(
    select 1 from public.session_players
    where session_id = p_session_id and user_id = auth.uid() and is_chef
  ) or exists(
    select 1 from public.sessions s
    join public.evenings e on e.id = s.evening_id
    where s.id = p_session_id and e.chef_id = auth.uid()
  );
$$ language sql stable security definer set search_path = public;

create policy "Chef can remove players"
  on public.session_players for delete using (public.can_manage_session(session_id));

-- Fiche envoyée après une révélation forcée : elle est notée seule (pts_robe = 0 = pas encore notée),
-- sans recalculer les fiches déjà affichées aux autres joueurs
create or replace function public.calculate_session_scores(p_session_id uuid)
returns void as $$
declare
  v_wine          public.wines%rowtype;
  v_notes         public.grappiste_notes%rowtype;
  v_tasting       public.tastings%rowtype;
  v_arome         text;
  v_arome_count   int;
  v_total_players int;
  v_pts_aromes    int;
  v_pts_prix      int;
  v_pts_mil       int;
  v_diff_prix     numeric;
  v_diff_mil      int;
  v_total         int;
  v_bouche_scale  text[];
  v_bouche_dist   int;
  v_pts_bouche    int;
  v_late          boolean;
begin
  -- Guard : si déjà calculé, seules les fiches arrivées après la révélation restent à noter
  select status = 'revealed' into v_late
  from public.sessions
  where id = p_session_id;

  if v_late and not exists(
    select 1 from public.tastings
    where session_id = p_session_id and pts_robe = 0
  ) then
    return;
  end if;

  select w.* into v_wine
  from public.sessions s
  join public.wines w on w.id = s.wine_id
  where s.id = p_session_id;

  select * into v_notes
  from public.grappiste_notes
  where wine_id = v_wine.id;

  -- Échelle de structure (rouge) / acidité (blanc) — même ordre que WINE_CONTENT côté app
  v_bouche_scale := case v_wine.type
    when 'rouge'     then array['Très léger', 'Léger', 'Souple, équilibré', 'Puissant', 'Très puissant']
    when 'blanc'     then array['Acidité vive', 'Acidité', 'Équilibre', 'Gras', 'Très gras, onctueux']
    when 'rose'      then array['Léger, frais', 'Fruité, équilibré', 'Structuré']
    when 'petillant' then array['Léger, délicat', 'Vif, bulles fines', 'Crémeux, persistant']
  end;

  -- Nombre total de joueurs ayant soumis une dégustation
  select count(*) into v_total_players
  from public.tastings
  where session_id = p_session_id;

  for v_tasting in
    select * from public.tastings
    where session_id = p_session_id and (not v_late or pts_robe = 0)
  loop
    v_total := 0;

    -- 1. ROBE
    if v_tasting.robe = v_notes.robe then
      update public.tastings set pts_robe = 500 where id = v_tasting.id;
      v_total := v_total + 500;
    else
      update public.tastings set pts_robe = 200 where id = v_tasting.id;
      v_total := v_total + 200;
    end if;

    -- 2. ARÔMES — round(nb_AUTRES_même / (total - 1) * 1000) + 200 si officiel
    --    Le joueur ne se compte plus lui-même : en solo, seul le bonus officiel compte
    v_pts_aromes := 0;
    for v_arome in select jsonb_array_elements_text(v_tasting.aromes)
    loop
      select count(*) into v_arome_count
      from public.tastings
      where session_id = p_session_id
        and id <> v_tasting.id
        and aromes @> to_jsonb(v_arome::text);

      if v_total_players > 1 then
        v_pts_aromes := v_pts_aromes
          + round(
              (v_arome_count::float / (v_total_players - 1)) * 1000
            )::int;
      end if;

      if v_notes.aromes_officiels @> to_jsonb(v_arome::text) then
        v_pts_aromes := v_pts_aromes + 200;
      end if;
    end loop;
    update public.tastings set pts_aromes = v_pts_aromes where id = v_tasting.id;
    v_total := v_total + v_pts_aromes;

    -- 3. BOUCHE (500 si juste · 350 si case voisine sur l'échelle · 200 sinon)
    v_bouche_dist := abs(
      array_position(v_bouche_scale, v_tasting.bouche)
      - array_position(v_bouche_scale, v_notes.bouche)
    );
    v_pts_bouche := case
      when v_tasting.bouche = v_notes.bouche then 500
      when v_bouche_dist = 1 then 350
      else 200
    end;
    update public.tastings set pts_bouche = v_pts_bouche where id = v_tasting.id;
    v_total := v_total + v_pts_bouche;

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

    -- 5. MILLÉSIME (500 si exact · −50 pts/année · min 0)
    if v_tasting.millesime_estime is not null and v_notes.millesime is not null then
      v_diff_mil := abs(v_tasting.millesime_estime - v_notes.millesime);
      v_pts_mil  := greatest(0, 500 - (v_diff_mil * 50));
    else
      v_pts_mil := 0;
    end if;
    update public.tastings set pts_millesime = v_pts_mil where id = v_tasting.id;
    v_total := v_total + v_pts_mil;

    -- 6. CÉPAGE
    if lower(v_tasting.cepage_guess) = lower(v_notes.cepage) then
      update public.tastings set pts_cepage = 1500 where id = v_tasting.id;
      v_total := v_total + 1500;
    else
      update public.tastings set pts_cepage = 300 where id = v_tasting.id;
      v_total := v_total + 300;
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
      update public.tastings set pts_elevage = 500 where id = v_tasting.id;
      v_total := v_total + 500;
    else
      update public.tastings set pts_elevage = 100 where id = v_tasting.id;
      v_total := v_total + 100;
    end if;

    -- 9. MALUS AIDES (−300 pts par aide · min 0 au total)
    v_total := greatest(0, v_total - (v_tasting.hints_used * 300));

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

  if not v_late then
    update public.wines set revealed = true where id = v_wine.id;
    update public.sessions
    set status = 'revealed', revealed_at = now()
    where id = p_session_id;
  end if;

end;
$$ language plpgsql security definer;
