-- ============================================================================
-- Migration 005: Tabla profiles con plan de suscripción
-- ============================================================================

-- Tabla de perfiles con plan
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  plan       text not null default 'free' check (plan in ('free', 'pro', 'lifetime')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "profiles: own data"
  on public.profiles for all
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Auto-crear perfil en signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, plan) values (new.id, 'free');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Backfill: crear perfil para usuarios existentes que no tengan uno
insert into public.profiles (id, plan)
select id, 'free' from auth.users
on conflict (id) do nothing;
