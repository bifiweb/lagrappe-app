-- Accès invités par projet (sans compte)
alter table public.projects
  add column if not exists guest_access boolean not null default false;

-- Fix trigger : les utilisateurs anonymes Supabase ont email = null
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;
