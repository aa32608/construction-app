create table public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  rfq_id uuid references public.rfqs(id) on delete cascade,
  vendor_id uuid references public.vendors(id) on delete cascade,
  status text not null default 'pending',
  response_deadline timestamptz,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index quote_requests_company_idx on public.quote_requests(company_id);
create index quote_requests_rfq_idx on public.quote_requests(rfq_id);
create index quote_requests_vendor_idx on public.quote_requests(vendor_id);

alter table public.quote_requests enable row level security;
create policy "members read quote requests" on public.quote_requests for select using (is_company_member(company_id));
create policy "managers manage quote requests" on public.quote_requests for all using (has_company_role(company_id, array['owner','manager','engineer']::app_role[]));
