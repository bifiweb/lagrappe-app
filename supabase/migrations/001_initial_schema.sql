-- ============================================================
-- LA GRAPPE — Migration initiale
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS (géré par Supabase Auth + profil étendu)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  role        text not null default 'player' check (role in ('admin', 'player')),
  display_name text,
  created_at  timestamptz not null default now()
);

-- Trigger : créer un profil automatiquement à l'inscription
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- PROJECTS (ex: Swiss Wine Challenge)
-- ============================================================
create table public.projects (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text not null unique,
  description text,
  image_url   text,
  active      boolean not null default true,
  created_by  uuid not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- ============================================================
-- WINES (bouteilles numérotées 1-6 liées à Shopify)
-- ============================================================
create table public.wines (
  id                  uuid primary key default uuid_generate_v4(),
  project_id          uuid not null references public.projects(id) on delete cascade,
  bottle_number       int not null check (bottle_number >= 1),
  type                text not null check (type in ('rouge', 'blanc', 'rose', 'petillant')),
  shopify_product_id  text,
  shopify_variant_id  text,
  shopify_url         text,
  image_url           text,
  revealed            boolean not null default false,
  created_at          timestamptz not null default now(),
  unique (project_id, bottle_number)
);

-- ============================================================
-- GRAPPISTE NOTES (notes officielles La Grappe par vin)
-- ============================================================
create table public.grappiste_notes (
  id              uuid primary key default uuid_generate_v4(),
  wine_id         uuid not null unique references public.wines(id) on delete cascade,
  note            numeric(3,1) not null check (note >= 0 and note <= 10),
  description     text,
  robe            text,
  aromes_officiels jsonb not null default '[]',
  bouche          text,
  accords         jsonb not null default '[]',
  cepage          text,
  region          text,
  millesime       int,
  prix_chf        text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- EVENINGS (soirée continue, groupe fixe)
-- ============================================================
create table public.evenings (
  id            uuid primary key default uuid_generate_v4(),
  project_id    uuid not null references public.projects(id) on delete cascade,
  chef_id       uuid references public.profiles(id),
  mode          text not null default 'standalone' check (mode in ('standalone', 'continuous')),
  bottle_order  jsonb not null default '[]',  -- ex: [4,2,1,6,3,5]
  status        text not null default 'lobby' check (status in ('lobby', 'voting', 'in_progress', 'finished')),
  created_at    timestamptz not null default now()
);

-- ============================================================
-- SESSIONS (une session = un vin mystère)
-- ============================================================
create table public.sessions (
  id               uuid primary key default uuid_generate_v4(),
  project_id       uuid not null references public.projects(id) on delete cascade,
  wine_id          uuid not null references public.wines(id),
  evening_id       uuid references public.evenings(id),
  chef_id          uuid references public.profiles(id),
  bottle_number    int not null,
  order_in_evening int not null default 1,
  status           text not null default 'lobby'
                   check (status in ('lobby', 'voting', 'tasting', 'waiting_reveal', 'revealed', 'finished')),
  started_at       timestamptz,
  revealed_at      timestamptz,
  created_at       timestamptz not null default now()
);

-- ============================================================
-- SESSION PLAYERS (joueurs d'une session)
-- ============================================================
create table public.session_players (
  id              uuid primary key default uuid_generate_v4(),
  session_id      uuid not null references public.sessions(id) on delete cascade,
  evening_id      uuid references public.evenings(id),
  user_id         uuid not null references public.profiles(id),
  pseudo          text not null,
  is_chef         boolean not null default false,
  votes_received  int not null default 0,
  tasting_done    boolean not null default false,
  points_session  int not null default 0,
  points_evening  int not null default 0,
  joined_at       timestamptz not null default now(),
  unique (session_id, user_id)
);

-- ============================================================
-- TASTINGS (fiche de dégustation d'un joueur)
-- ============================================================
create table public.tastings (
  id               uuid primary key default uuid_generate_v4(),
  session_id       uuid not null references public.sessions(id) on delete cascade,
  user_id          uuid not null references public.profiles(id),
  -- Vue
  robe             text,
  -- Nez
  nez_intensite    int check (nez_intensite between 1 and 5),
  aromes           jsonb not null default '[]',  -- max 5 arômes
  -- Bouche
  bouche           text,
  accords          jsonb not null default '[]',
  -- Devinette
  prix_estime      text,
  millesime_estime int,
  cepage_guess     text,
  region_guess     text,
  -- Notes perso
  score_perso      int check (score_perso between 0 and 10),
  notes_libres     text,
  -- Scoring calculé à la révélation
  pts_robe         int not null default 0,
  pts_aromes       int not null default 0,
  pts_bouche       int not null default 0,
  pts_prix         int not null default 0,
  pts_millesime    int not null default 0,
  pts_cepage       int not null default 0,
  pts_region       int not null default 0,
  total_points     int not null default 0,
  -- Meta
  submitted_at     timestamptz,
  created_at       timestamptz not null default now(),
  unique (session_id, user_id)
);

-- ============================================================
-- VOTES (vote pour le chef de groupe)
-- ============================================================
create table public.votes (
  id          uuid primary key default uuid_generate_v4(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  voter_id    uuid not null references public.profiles(id),
  voted_for   uuid not null references public.profiles(id),
  created_at  timestamptz not null default now(),
  unique (session_id, voter_id)
);

-- ============================================================
-- QUIZ QUESTIONS (éducatif sur les régions suisses)
-- ============================================================
create table public.quiz_questions (
  id             uuid primary key default uuid_generate_v4(),
  project_id     uuid references public.projects(id) on delete cascade,
  question       text not null,
  options        jsonb not null,   -- ["Valais","Vaud","Genève","Tessin"]
  correct_answer text not null,
  explanation    text,
  category       text not null default 'region'
                 check (category in ('region', 'cepage', 'accord', 'general')),
  difficulty     int not null default 1 check (difficulty between 1 and 3),
  created_at     timestamptz not null default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.wines enable row level security;
alter table public.grappiste_notes enable row level security;
alter table public.evenings enable row level security;
alter table public.sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.tastings enable row level security;
alter table public.votes enable row level security;
alter table public.quiz_questions enable row level security;

-- Profiles : lecture libre, écriture sur soi-même
create policy "Profiles are viewable by everyone"
  on public.profiles for select using (true);
create policy "Users can update own profile"
  on public.profiles for update using (auth.uid() = id);

-- Projects : lecture libre, écriture admin seulement
create policy "Projects are viewable by everyone"
  on public.projects for select using (true);
create policy "Only admins can manage projects"
  on public.projects for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Wines : lecture libre, écriture admin
create policy "Wines are viewable by everyone"
  on public.wines for select using (true);
create policy "Only admins can manage wines"
  on public.wines for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Grappiste notes : visibles seulement après révélation du vin
create policy "Grappiste notes visible after reveal"
  on public.grappiste_notes for select using (
    exists (select 1 from public.wines where id = wine_id and revealed = true)
  );
create policy "Only admins can manage grappiste notes"
  on public.grappiste_notes for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Sessions, evenings, players : visibles par les participants
create policy "Sessions viewable by participants"
  on public.sessions for select using (true);
create policy "Evenings viewable by everyone"
  on public.evenings for select using (true);
create policy "Session players viewable by everyone"
  on public.session_players for select using (true);

-- Tastings : chaque joueur voit seulement la sienne, admin voit tout
create policy "Players see own tasting"
  on public.tastings for select using (
    auth.uid() = user_id
    or exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
    or exists (select 1 from public.sessions s
               join public.wines w on w.id = s.wine_id
               where s.id = session_id and w.revealed = true)
  );
create policy "Players manage own tasting"
  on public.tastings for all using (auth.uid() = user_id);

-- Votes : secret jusqu'au dépouillement
create policy "Players can vote"
  on public.votes for insert with check (auth.uid() = voter_id);
create policy "Players see own vote"
  on public.votes for select using (auth.uid() = voter_id);

-- Quiz : lecture libre
create policy "Quiz questions viewable by everyone"
  on public.quiz_questions for select using (true);
create policy "Only admins can manage quiz"
  on public.quiz_questions for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ============================================================
-- REALTIME (activer les tables nécessaires)
-- ============================================================
alter publication supabase_realtime add table public.sessions;
alter publication supabase_realtime add table public.session_players;
alter publication supabase_realtime add table public.votes;
alter publication supabase_realtime add table public.evenings;
