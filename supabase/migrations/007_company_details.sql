alter table public.companies add column if not exists industry text;
alter table public.companies add column if not exists phone text;
alter table public.companies add column if not exists address text;

create or replace function public.create_company(p_name text, p_slug text, p_industry text default 'Construction', p_phone text default null, p_address text default null)
returns public.companies language plpgsql security definer set search_path = public as $$
declare v_company public.companies%rowtype; v_user uuid := auth.uid();
begin
 if v_user is null then raise exception 'Not authenticated'; end if;
 if nullif(btrim(p_name),'') is null then raise exception 'Company name is required'; end if;
 insert into public.companies(name,slug,industry,phone,address) values (btrim(p_name),coalesce(nullif(btrim(p_slug),''),regexp_replace(lower(p_name),'[^a-z0-9]+','-','g')),nullif(btrim(p_industry),''),nullif(btrim(p_phone),''),nullif(btrim(p_address),'')) returning * into v_company;
 insert into public.company_members(company_id,user_id,role,job_title) values(v_company.id,v_user,'owner','Owner');
 return v_company;
end; $$;
revoke all on function public.create_company(text,text,text,text,text) from public, anon;
grant execute on function public.create_company(text,text,text,text,text) to authenticated;
