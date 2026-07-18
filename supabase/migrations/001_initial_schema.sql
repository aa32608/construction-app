-- ConstructOS foundation schema
-- Apply in Supabase SQL editor or via supabase db push.
create extension if not exists "pgcrypto";

create type public.app_role as enum ('owner','manager','engineer','employee');
create type public.project_status as enum ('planning','active','on_hold','completed','archived');
create type public.task_priority as enum ('low','medium','high','urgent');
create type public.task_status as enum ('todo','in_progress','done');

create table public.companies (
  id uuid primary key default gen_random_uuid(), name text not null, slug text not null unique,
  logo_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade, full_name text not null default '',
  avatar_url text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.company_members (
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role public.app_role not null default 'employee', job_title text, joined_at timestamptz not null default now(),
  primary key (company_id,user_id)
);
create table public.projects (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, client_name text, description text, status public.project_status not null default 'planning',
  progress smallint not null default 0 check (progress between 0 and 100), budget numeric(14,2) not null default 0,
  start_date date, due_date date, created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  primary key (project_id,user_id)
);
create table public.tasks (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade, assignee_id uuid references public.profiles(id),
  title text not null, description text, status public.task_status not null default 'todo',
  priority public.task_priority not null default 'medium', due_date date, created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.inventory_items (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  name text not null, sku text, category text, warehouse text, unit text not null default 'pcs',
  current_stock numeric(12,2) not null default 0, minimum_stock numeric(12,2) not null default 0,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.documents (
  id uuid primary key default gen_random_uuid(), company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade, name text not null, file_path text not null,
  mime_type text, size_bytes bigint, version integer not null default 1, uploaded_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
create table public.audit_logs (
  id bigint generated always as identity primary key, company_id uuid not null references public.companies(id) on delete cascade,
  actor_id uuid references public.profiles(id), action text not null, entity_type text not null, entity_id uuid,
  metadata jsonb not null default '{}', created_at timestamptz not null default now()
);

create index projects_company_idx on public.projects(company_id);
create index tasks_company_due_idx on public.tasks(company_id,due_date);
create index inventory_company_idx on public.inventory_items(company_id);
create index documents_company_idx on public.documents(company_id);
create index audit_company_created_idx on public.audit_logs(company_id,created_at desc);

create or replace function public.is_company_member(target_company uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.company_members where company_id = target_company and user_id = auth.uid());
$$;
create or replace function public.has_company_role(target_company uuid, allowed_roles public.app_role[])
returns boolean language sql security definer stable set search_path = public as $$
  select exists(select 1 from public.company_members where company_id = target_company and user_id = auth.uid() and role = any(allowed_roles));
$$;

-- Every tenant-owned table is protected by the company membership check.
do $$ declare t text; begin
  foreach t in array array['company_members','projects','tasks','inventory_items','documents','audit_logs'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;
create policy "members can read company members" on public.company_members for select using (is_company_member(company_id));
create policy "owners and managers manage members" on public.company_members for all using (has_company_role(company_id, array['owner','manager']::app_role[]));
create policy "company members read projects" on public.projects for select using (is_company_member(company_id));
create policy "managers can manage projects" on public.projects for all using (has_company_role(company_id, array['owner','manager','engineer']::app_role[]));
create policy "company members read tasks" on public.tasks for select using (is_company_member(company_id));
create policy "members can manage tasks" on public.tasks for all using (has_company_role(company_id, array['owner','manager','engineer']::app_role[]));
create policy "company members read inventory" on public.inventory_items for select using (is_company_member(company_id));
create policy "managers manage inventory" on public.inventory_items for all using (has_company_role(company_id, array['owner','manager']::app_role[]));
create policy "company members read documents" on public.documents for select using (is_company_member(company_id));
create policy "members upload documents" on public.documents for insert with check (is_company_member(company_id));
create policy "company members read audit logs" on public.audit_logs for select using (is_company_member(company_id));

-- New auth users get a profile. Company creation/invites should be performed by a server action.
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id,full_name) values (new.id,coalesce(new.raw_user_meta_data->>'full_name','')); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();
