-- ScholarForge OS v1.0 cloud workspace
-- Run this migration in the Supabase SQL editor before enabling cloud sync.
-- The browser uses the publishable key plus the authenticated user's JWT;
-- Row Level Security is the actual data-isolation boundary.

create extension if not exists pgcrypto;

create table if not exists public.scholarforge_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  project_key text not null,
  title text not null default 'Untitled research project',
  task_type text not null default 'precheck'
    check (task_type in ('translate', 'polish', 'precheck', 'review-response')),
  target_journal text not null default '',
  section_type text not null default 'general'
    check (section_type in ('general', 'abstract', 'introduction', 'methods', 'results', 'discussion', 'conclusion')),
  review_mode text not null default 'balanced'
    check (review_mode in ('conservative', 'balanced', 'deep')),
  workspace_payload jsonb not null default '{"draft":null,"history":[]}'::jsonb,
  latest_score integer null check (latest_score between 0 and 100),
  pending_count integer not null default 0 check (pending_count >= 0),
  last_run_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, project_key)
);

create index if not exists scholarforge_projects_owner_updated_idx
  on public.scholarforge_projects (owner_id, updated_at desc);

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

alter table public.scholarforge_projects enable row level security;

-- Every operation is restricted to the authenticated owner.
drop policy if exists "Users can read their ScholarForge projects" on public.scholarforge_projects;
create policy "Users can read their ScholarForge projects"
on public.scholarforge_projects for select
using (auth.uid() = owner_id);

drop policy if exists "Users can create their ScholarForge projects" on public.scholarforge_projects;
create policy "Users can create their ScholarForge projects"
on public.scholarforge_projects for insert
with check (auth.uid() = owner_id);

drop policy if exists "Users can update their ScholarForge projects" on public.scholarforge_projects;
create policy "Users can update their ScholarForge projects"
on public.scholarforge_projects for update
using (auth.uid() = owner_id)
with check (auth.uid() = owner_id);

drop policy if exists "Users can delete their ScholarForge projects" on public.scholarforge_projects;
create policy "Users can delete their ScholarForge projects"
on public.scholarforge_projects for delete
using (auth.uid() = owner_id);

-- Optional safety checks for the JSON envelope used by v1.0.
alter table public.scholarforge_projects
  drop constraint if exists scholarforge_workspace_payload_shape;
alter table public.scholarforge_projects
  add constraint scholarforge_workspace_payload_shape check (
    jsonb_typeof(workspace_payload) = 'object'
    and workspace_payload ? 'history'
    and jsonb_typeof(workspace_payload -> 'history') = 'array'
  );

comment on table public.scholarforge_projects is
  'User-isolated ScholarForge project envelopes containing the latest draft and up to eight review snapshots.';
comment on column public.scholarforge_projects.project_key is
  'Stable client-side key derived from project title, workflow type, and target journal.';
comment on column public.scholarforge_projects.workspace_payload is
  'Version-1 local workspace envelope: { draft, history }. Never expose a service-role key to the browser.';
