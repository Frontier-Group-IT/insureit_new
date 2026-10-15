begin;
-- Only execute after safely deprovisioning all Group Associate accounts.
do $$ begin
 if exists(select 1 from public.group_portal_associate_accounts limit 1) then
  raise exception 'Refusing rollback: Group Associate accounts still exist';
 end if;
end $$;
drop function public.partner_app_current_identity();
alter function public.partner_app_current_identity_before_group_associates() rename to partner_app_current_identity;
revoke all on function public.partner_app_current_identity() from public,anon;
grant execute on function public.partner_app_current_identity() to authenticated,service_role;
drop function public.partner_portal_access_context();
alter function public.partner_portal_access_context_before_group_associates() rename to partner_portal_access_context;
revoke all on function public.partner_portal_access_context() from public,anon;
grant execute on function public.partner_portal_access_context() to authenticated,service_role;
drop function public.group_associate_active_group_id();
drop table public.group_portal_associate_audit;
drop table public.group_portal_associate_accounts;
commit;
