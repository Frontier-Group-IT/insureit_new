begin;

-- Revert Partner Portal multi-login access and restore the pre-feature
-- single-login Partner authentication model.

drop function if exists public.partner_app_current_identity();

do $$
begin
  if to_regprocedure('public.partner_app_current_identity_before_multi_login()') is not null then
    alter function public.partner_app_current_identity_before_multi_login()
      rename to partner_app_current_identity;
  else
    raise exception 'pre-feature partner_app_current_identity function is missing';
  end if;
end;
$$;

revoke all on function public.partner_app_current_identity() from public, anon;
grant execute on function public.partner_app_current_identity() to authenticated, service_role;

drop function if exists public.partner_app_activate_current_account();

do $$
begin
  if to_regprocedure('public.partner_app_activate_current_account_before_multi_login()') is not null then
    alter function public.partner_app_activate_current_account_before_multi_login()
      rename to partner_app_activate_current_account;
  else
    raise exception 'pre-feature partner_app_activate_current_account function is missing';
  end if;
end;
$$;

revoke all on function public.partner_app_activate_current_account() from public, anon;
grant execute on function public.partner_app_activate_current_account() to authenticated, service_role;

-- Restore Partner-level portal status from the untouched primary login table.
update public.intermediaries i
set portal_access_status = coalesce((
  select case a.status
    when 'active' then 'active'
    when 'invited' then 'invited'
    when 'disabled' then 'disabled'
    else 'not_created'
  end
  from public.intermediary_portal_accounts a
  where a.intermediary_id = i.id
  limit 1
), 'not_created'),
updated_at = now()
where i.intermediary_type = 'partner';

drop function if exists public.service_partner_portal_refresh_access_status(uuid);
drop function if exists public.partner_portal_additional_user_identity();
drop function if exists public.partner_portal_additional_user_validate_target();

drop table if exists public.partner_portal_additional_user_audit;
drop table if exists public.partner_portal_additional_users;

commit;
