-- Financing, Payments & Cost Calculations Schema
-- Adds unit costs to inventory items, hourly rates to company members, and tracks project financial payments/invoices.

alter table public.inventory_items
  add column if not exists unit_cost numeric(12,2) not null default 0.00;

alter table public.company_members
  add column if not exists hourly_rate numeric(10,2) not null default 35.00;

create table if not exists public.project_payments (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  type text not null check (type in ('income', 'expense')),
  amount numeric(14,2) not null check (amount > 0),
  category text not null default 'other',
  status text not null default 'completed' check (status in ('pending', 'completed', 'overdue')),
  payment_date date not null default current_date,
  notes text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_payments_company_idx on public.project_payments(company_id);
create index if not exists project_payments_project_idx on public.project_payments(project_id);

alter table public.project_payments enable row level security;

create policy "company members read project payments"
  on public.project_payments for select
  using (is_company_member(company_id));

create policy "managers manage project payments"
  on public.project_payments for all
  using (has_company_role(company_id, array['owner','manager','engineer']::app_role[]));
