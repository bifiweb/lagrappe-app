-- ============================================================
-- Push Notifications
-- ============================================================

-- Préférence utilisateur (activé par défaut à la création du compte)
alter table public.profiles
  add column if not exists notifications_enabled boolean not null default true;

-- Stockage des subscriptions Web Push par utilisateur/device
create table public.push_subscriptions (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  endpoint    text not null,
  p256dh      text not null,
  auth        text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table public.push_subscriptions enable row level security;

create policy "Users manage own subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Service role can read all subscriptions"
  on public.push_subscriptions for select
  using (auth.role() = 'service_role');

-- Historique des notifications envoyées
create table public.push_notifications (
  id          uuid primary key default uuid_generate_v4(),
  title       text not null,
  body        text not null,
  url         text,
  sent_by     uuid references public.profiles(id),
  sent_at     timestamptz not null default now(),
  recipients  int not null default 0
);

alter table public.push_notifications enable row level security;

create policy "Admins manage notifications"
  on public.push_notifications for all
  using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );
