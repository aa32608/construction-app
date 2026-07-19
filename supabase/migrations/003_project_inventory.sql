-- Project Inventory Assignments schema
-- Tracks inventory items assigned/allocated to specific projects.

create table if not exists public.project_inventory_assignments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete cascade,
  quantity numeric(12,2) not null check (quantity > 0),
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (project_id, inventory_item_id)
);

create index if not exists project_inventory_company_idx on public.project_inventory_assignments(company_id);
create index if not exists project_inventory_project_idx on public.project_inventory_assignments(project_id);
create index if not exists project_inventory_item_idx on public.project_inventory_assignments(inventory_item_id);

alter table public.project_inventory_assignments enable row level security;

create policy "company members read project inventory assignments"
  on public.project_inventory_assignments for select
  using (is_company_member(company_id));

create policy "managers manage project inventory assignments"
  on public.project_inventory_assignments for all
  using (has_company_role(company_id, array['owner','manager','engineer']::app_role[]));
