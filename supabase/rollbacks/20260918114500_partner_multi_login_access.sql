begin;

-- Disable the multi-login runtime while retaining additional-user rows as an
-- inert archive. The original primary Partner login remains unchanged.
drop function if exists public.partner_app_current_identity();

do $$
begin
  if to_regprocedure('public.partner_app_current_identity_before_multi_login()') is not null then
    alter function public.partner_app_current_identity_before_multi_login()
      rename to partner_app_current_identity;
  end if;
end;
$;
grant execute on function public.partner_app_current_identity() to authenticated, service_role;

drop function if exists public.partner_app_activate_current_account();

do $$
begin
  if to_regprocedure('public.partner_app_activate_current_account_before_multi_login()') is not null then
    alter function public.partner_app_activate_current_account_before_multi_login()
      rename to partner_app_activate_current_account;
  end if;
end;
$;
grant execute on function public.partner_app_activate_current_account() to authenticated, service_role;

revoke all on function public.partner_portal_additional_user_identity() from authenticated;

-- Recompute the legacy Partner-level status from the untouched primary account.
update public.intermediaries i
set portal_access_status = coalesce((
  select case a.status
    when 'active' then 'active'
    when 'invited' then 'invited'
    when 'disabled' then 'disabled'
    else 'not_created'
  end
  from public.intermediary_portal_accounts a
  where a.intermediary_id=i.id
  limit 1
), 'not_created'),
updated_at=now()
where i.intermediary_type='partner';

-- partner_portal_additional_users and its audit table are intentionally retained
-- so rollback is non-destructive and the feature can be re-enabled later.
commit;
