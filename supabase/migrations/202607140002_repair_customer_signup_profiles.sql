-- Repair auth identities that were created without a matching app profile.
-- This migration intentionally does not create customers; KYC approval remains the boundary.

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

insert into public.profiles (id, role, full_name, phone, email)
select
  auth_user.id,
  case
    when coalesce(
      nullif(auth_user.raw_app_meta_data ->> 'app_role', ''),
      nullif(auth_user.raw_user_meta_data ->> 'app_role', '')
    ) in (
      'customer', 'director', 'sales_head', 'zonal_head', 'asm', 'sales_manager',
      'agent', 'it_super_user', 'backoffice_executive', 'field_executive',
      'claim_processor', 'manager', 'admin', 'super_admin'
    ) then coalesce(
      nullif(auth_user.raw_app_meta_data ->> 'app_role', ''),
      nullif(auth_user.raw_user_meta_data ->> 'app_role', '')
    )::public.app_role
    else 'customer'::public.app_role
  end,
  coalesce(nullif(auth_user.raw_user_meta_data ->> 'full_name', ''), 'New user'),
  coalesce(nullif(auth_user.phone, ''), nullif(auth_user.raw_user_meta_data ->> 'phone', '')),
  coalesce(nullif(auth_user.email, ''), nullif(auth_user.raw_user_meta_data ->> 'email', ''))
from auth.users auth_user
where not exists (
  select 1 from public.profiles profile where profile.id = auth_user.id
);

create or replace function public.ensure_customer_signup_profile(
  p_full_name text,
  p_phone text,
  p_email text default null
)
returns public.profiles
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  result public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not exists (select 1 from auth.users where id = auth.uid()) then
    raise exception 'Authenticated user was not found.';
  end if;

  insert into public.profiles (id, role, full_name, phone, email)
  values (
    auth.uid(),
    'customer',
    coalesce(nullif(trim(p_full_name), ''), 'New user'),
    nullif(trim(p_phone), ''),
    nullif(trim(p_email), '')
  )
  on conflict (id) do update
  set
    full_name = coalesce(nullif(trim(excluded.full_name), ''), public.profiles.full_name),
    phone = coalesce(nullif(trim(excluded.phone), ''), public.profiles.phone),
    email = coalesce(nullif(trim(excluded.email), ''), public.profiles.email)
  where public.profiles.role = 'customer'
  returning * into result;

  if result.id is null then
    select * into result from public.profiles where id = auth.uid();
  end if;

  return result;
end;
$$;

revoke all on function public.ensure_customer_signup_profile(text, text, text) from public;
grant execute on function public.ensure_customer_signup_profile(text, text, text) to authenticated;
