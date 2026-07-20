-- Complete invited-user onboarding: metadata from the admin invite is converted
-- into a tenant membership when the user accepts/signs up.
create or replace function public.handle_invited_user_membership()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.raw_user_meta_data ? 'company_id' then
    insert into public.company_members(company_id, user_id, role, job_title)
    values (
      (new.raw_user_meta_data->>'company_id')::uuid,
      new.id,
      coalesce(nullif(new.raw_user_meta_data->>'role',''), 'employee')::public.app_role,
      nullif(new.raw_user_meta_data->>'job_title','')
    ) on conflict (company_id, user_id) do nothing;
  end if;
  return new;
exception when others then
  raise warning 'Could not create invited membership: %', SQLERRM;
  return new;
end; $$;

drop trigger if exists on_auth_user_invited_membership on auth.users;
create trigger on_auth_user_invited_membership
after insert on auth.users for each row execute function public.handle_invited_user_membership();
