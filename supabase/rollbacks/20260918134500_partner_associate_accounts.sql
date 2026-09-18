begin;

drop function if exists public.partner_app_current_identity();

do $$
begin
  if to_regprocedure('public.partner_app_current_identity_before_associate_accounts()') is not null then
    alter function public.partner_app_current_identity_before_associate_accounts()
      rename to partner_app_current_identity;
  end if;
end;
$$;
grant execute on function public.partner_app_current_identity() to authenticated, service_role;

drop function if exists public.partner_app_activate_current_account();

do $$
begin
  if to_regprocedure('public.partner_app_activate_current_account_before_associate_accounts()') is not null then
    alter function public.partner_app_activate_current_account_before_associate_accounts()
      rename to partner_app_activate_current_account;
  end if;
end;
$$;
grant execute on function public.partner_app_activate_current_account() to authenticated, service_role;

drop function if exists public.partner_portal_associate_identity();
drop table if exists public.partner_portal_associate_account_audit;
drop table if exists public.partner_portal_associate_accounts;

commit;
