-- Keep account existence checks restricted to the service role.
create or replace function public.portal_password_recovery_eligibility(p_email text)
returns text
language plpgsql stable security definer
set search_path = public, auth
as $fn$
declare
  v_user auth.users%rowtype;
  v_employee_id uuid;
begin
  select * into v_user from auth.users
  where lower(email)=lower(btrim(p_email))
  limit 1;
  if not found then return 'unknown'; end if;
  if v_user.banned_until > now() then return 'inactive'; end if;

  if exists(select 1 from public.profiles pr
    where pr.id=v_user.id and pr.is_active is false) then
    return 'inactive';
  end if;
  v_employee_id := nullif(v_user.raw_app_meta_data->>'employee_id','')::uuid;
  if v_employee_id is not null and exists (
    select 1 from public.employees e
    where e.id=v_employee_id and lower(coalesce(e.employment_status,'')) <> 'active'
  ) then return 'inactive'; end if;
  if exists(select 1 from public.partner_portal_associate_accounts a
    where a.auth_user_id=v_user.id and lower(coalesce(a.status,'')) <> 'active') then
    return 'inactive';
  end if;
  if exists(select 1 from public.group_portal_associate_accounts a
    where a.auth_user_id=v_user.id and lower(coalesce(a.status,'')) <> 'active') then
    return 'inactive';
  end if;
  if exists(select 1 from public.intermediary_portal_accounts a
    where a.auth_user_id=v_user.id and lower(coalesce(a.status,'')) <> 'active') then
    return 'inactive';
  end if;
  return 'active';
end;
$fn$;
revoke all on function public.portal_password_recovery_eligibility(text) from public, anon, authenticated;
grant execute on function public.portal_password_recovery_eligibility(text) to service_role;
