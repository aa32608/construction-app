-- ConstructOS auth + tenant onboarding
-- Adds a low-stock flag for fast inventory queries and a SECURITY DEFINER RPC
-- that provisions a company for a freshly signed-up user and seeds it with
-- starter data so the dashboard is populated on first run.
--
-- The membership insert must run as a privileged role because company_members
-- RLS only allows owners/managers to write — and the creator is not yet a
-- member. SECURITY DEFINER (running as the postgres owner) sidesteps that
-- chicken-and-egg situation while every later read stays behind RLS.

-- Fast, indexable low-stock detection on the inventory table.
alter table public.inventory_items
  add column if not exists low_stock boolean generated always as (current_stock < minimum_stock) stored;

create index if not exists inventory_low_stock_idx
  on public.inventory_items(company_id) where low_stock = true;

create or replace function public.create_company(p_name text, p_slug text)
returns public.companies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_company public.companies%rowtype;
  v_user uuid := auth.uid();
  v_project_id uuid;
  v_project_id_2 uuid;
begin
  if v_user is null then
    raise exception 'Not authenticated';
  end if;
  if p_name is null or btrim(p_name) = '' then
    raise exception 'Company name is required';
  end if;

  insert into public.companies (name, slug)
  values (
    p_name,
    coalesce(nullif(btrim(p_slug), ''), regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'))
  )
  returning * into v_company;

  -- Make the creator the owner of the new workspace.
  insert into public.company_members (company_id, user_id, role, job_title)
  values (v_company.id, v_user, 'owner', 'Owner');

  -- Seed a couple of starter projects so the dashboard is not empty.
  insert into public.projects (company_id, name, client_name, status, progress, budget, due_date, created_by)
  values (v_company.id, 'Riverside Apartments', 'Balkan Properties', 'active', 38, 248000, current_date + 90, v_user)
  returning id into v_project_id;

  insert into public.projects (company_id, name, client_name, status, progress, budget, due_date, created_by)
  values (v_company.id, 'Central Business Hub', 'Nova Developments', 'on_hold', 22, 416500, current_date + 120, v_user)
  returning id into v_project_id_2;

  -- Seed starter tasks assigned to the new owner.
  insert into public.tasks (company_id, project_id, assignee_id, title, status, priority, due_date, created_by)
  values
    (v_company.id, v_project_id,   v_user, 'Review concrete delivery schedule', 'todo', 'high',   current_date,     v_user),
    (v_company.id, v_project_id,   v_user, 'Submit weekly site report',         'todo', 'medium', current_date + 4, v_user),
    (v_company.id, v_project_id_2, v_user, 'Approve revised floor plans',       'todo', 'urgent', current_date + 2, v_user),
    (v_company.id, v_project_id_2, v_user, 'Order insulation materials',        'done', 'low',    current_date - 1, v_user);

  -- Seed starter inventory items for the workspace.
  insert into public.inventory_items (company_id, name, sku, category, warehouse, unit, current_stock, minimum_stock)
  values
    (v_company.id, 'Portland Cement 50kg', 'CEM-PORT-50', 'Cement', 'Main Warehouse', 'pcs', 120, 15),
    (v_company.id, 'Reinforced Steel Rebars 12mm', 'STL-REBAR-12', 'Steel', 'Central Storage', 'kg', 850, 100),
    (v_company.id, 'Structural Timber Beams', 'TMB-BEAM-04', 'Timber', 'Site Shed B', 'm', 45, 10);

  return v_company;
end;
$$;

revoke all on function public.create_company(text, text) from public, anon;
grant execute on function public.create_company(text, text) to authenticated;
