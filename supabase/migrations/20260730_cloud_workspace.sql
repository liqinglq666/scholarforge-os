-- ScholarForge OS v1.0 cloud workspace
-- Run this migration in the Supabase SQL editor before enabling cloud sync.

create extension if not exists pgcrypto;

create table if not exists public.scholarforge_projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Untitled research writing project',
  task_type text not null default 'precheck'
    check (task_type in ('translate', 'polish', 'precheck', 'review-response')),
  target_journal text not null default '',
  section_type text not null default 'general'
    check (section_type in ('general', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion')),
  review_mode text not null default 'balanced'
    check (review_mode in ('conservative', 'balanced', 'deep')),
  draft jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists scholarforge_projects_user_updated_idx
  on public.scholarforge_projects (user_id, updated_at desc);

create table if not exists public.scholarforge_review_runs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.scholarforge_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_snapshot_id text not null,
  source_text text not null default '',
  supporting_context text not null default '',
  response_location text not null default '',
  request_id text not null default '',
  result jsonb not null default '{}'::jsonb,
  decisions jsonb not null default '{}'::jsonb,
  saved_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, client_snapshot_id)
);

create index if not exists scholarforge_review_runs_project_saved_idx
  on public.scholarforge_review_runs (project_id, saved_at desc);

create or replace function public.scholarforge_set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists scholarforge_projects_set_updated_at on public.scholarforge_projects;
create trigger scholarforge_projects_set_updated_at
before update on public.scholarforge_projects
for each row execute function public.scholarforge_set_updated_at();

drop trigger if exists scholarforge_review_runs_set_updated_at on public.scholarforge_review_runs;
create trigger scholarforge_review_runs_set_updated_at
before update on public.scholarforge_review_runs
for each row execute function public.scholarforge_set_updated_at();

alter table public.scholarforge_projects enable row level security;
alter table public.scholarforge_review_runs enable row level security;

-- Projects: every authenticated user can only operate on rows carrying their own user id.
drop policy if exists "Users can read their ScholarForge projects" on public.scholarforge_projects;
create policy "Users can read their ScholarForge projects"
on public.scholarforge_projects for select
using (auth.uid() = user_id);

drop policy if exists "Users can create their ScholarForge projects" on public.scholarforge_projects;
create policy "Users can create their ScholarForge projects"
on public.scholarforge_projects for insert
with check (auth.uid() = user_id);

drop policy if exists "Users can update their ScholarForge projects" on public.scholarforge_projects;
create policy "Users can update their ScholarForge projects"
on public.scholarforge_projects for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "Users can delete their ScholarForge projects" on public.scholarforge_projects;
create policy "Users can delete their ScholarForge projects"
on public.scholarforge_projects for delete
using (auth.uid() = user_id);

-- Review runs are additionally bound to a project owned by the same authenticated user.
drop policy if exists "Users can read their ScholarForge review runs" on public.scholarforge_review_runs;
create policy "Users can read their ScholarForge review runs"
on public.scholarforge_review_runs for select
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.scholarforge_projects project
    where project.id = project_id and project.user_id = auth.uid()
  )
);

drop policy if exists "Users can create their ScholarForge review runs" on public.scholarforge_review_runs;
create policy "Users can create their ScholarForge review runs"
on public.scholarforge_review_runs for insert
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.scholarforge_projects project
    where project.id = project_id and project.user_id = auth.uid()
  )
);

drop policy if exists "Users can update their ScholarForge review runs" on public.scholarforge_review_runs;
create policy "Users can update their ScholarForge review runs"
on public.scholarforge_review_runs for update
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.scholarforge_projects project
    where project.id = project_id and project.user_id = auth.uid()
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1 from public.scholarforge_projects project
    where project.id = project_id and project.user_id = auth.uid()
  )
);

drop policy if exists "Users can delete their ScholarForge review runs" on public.scholarforge_review_runs;
create policy "Users can delete their ScholarForge review runs"
on public.scholarforge_review_runs for delete
using (
  auth.uid() = user_id
  and exists (
    select 1 from public.scholarforge_projects project
    where project.id = project_id and project.user_id = auth.uid()
  )
);

-- Realtime is optional. The UI currently uses explicit refresh and debounced sync.
