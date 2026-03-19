-- ============================================================
-- Time Tracker Schema
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================================

-- CLIENTS
create table if not exists public.clients (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  color       text not null default '#3B82F6',
  created_at  timestamptz default now()
);

-- PROJECTS
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  client_id   uuid references public.clients(id) on delete cascade not null,
  name        text not null,
  color       text not null default '#6366F1',
  created_at  timestamptz default now()
);

-- TASKS
create table if not exists public.tasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid references auth.users(id) on delete cascade not null,
  client_id    uuid references public.clients(id) on delete set null,
  project_id   uuid references public.projects(id) on delete set null,
  title        text not null,
  description  text not null default '',
  status       text not null default 'pending' check (status in ('pending', 'done')),
  color        text not null default '#3B82F6',
  created_at   timestamptz default now()
);

-- SUBTASKS
-- user_id incluido directamente para evitar subqueries en RLS policies
create table if not exists public.subtasks (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid references auth.users(id) on delete cascade not null,
  task_id  uuid references public.tasks(id) on delete cascade not null,
  title    text not null,
  done     boolean not null default false
);

-- ENTRIES (time logs)
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete cascade not null,
  task_id     uuid references public.tasks(id) on delete set null,
  client_id   uuid references public.clients(id) on delete set null,
  project_id  uuid references public.projects(id) on delete set null,
  subtask_id  uuid references public.subtasks(id) on delete set null,
  date        date not null,
  start_time  time not null,
  end_time    time not null,
  notes       text not null default '',
  is_subtask  boolean not null default false,
  created_at  timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- Cada usuario solo accede a su propia data.
-- Todas las policies usan auth.uid() = user_id directamente,
-- sin subqueries a otras tablas (evita bucles de evaluación).
-- ============================================================

alter table public.clients  enable row level security;
alter table public.projects enable row level security;
alter table public.tasks    enable row level security;
alter table public.subtasks enable row level security;
alter table public.entries  enable row level security;

-- CLIENTS
create policy "clients: own data"
  on public.clients for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- PROJECTS
create policy "projects: own data"
  on public.projects for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- TASKS
create policy "tasks: own data"
  on public.tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- SUBTASKS (user_id propio, sin subquery a tasks)
create policy "subtasks: own data"
  on public.subtasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ENTRIES
create policy "entries: own data"
  on public.entries for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ============================================================
-- INDEXES (performance para queries frecuentes)
-- ============================================================

create index if not exists idx_projects_client_id   on public.projects(client_id);
create index if not exists idx_tasks_project_id     on public.tasks(project_id);
create index if not exists idx_subtasks_task_id     on public.subtasks(task_id);
create index if not exists idx_entries_user_date    on public.entries(user_id, date);
create index if not exists idx_entries_task_id      on public.entries(task_id);
