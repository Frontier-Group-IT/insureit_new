begin;
-- Non-destructive code rollback. Keep all Group Associate and audit rows intact.
-- Refuse rollback while ANY Group Associate exists: rollback would otherwise remove
-- their login resolution and make still-provisioned users unexpectedly inaccessible.
do $$
begin
 if exists (select 1 from public.group_portal_associate_accounts limit 1) then
   raise exception 'Group Associate accounts exist; deprovision through approved process before rolling back the identity functions';
 end if;
end $$;

-- Remove dependent convenience wrappers inside the same transaction before\n-- restoring the original function identities. Both wrappers are recreated below.\ndrop function public.partner_portal_current_identity();\ndrop function public.partner_portal_scoped_partner_ids();\n\n-- Restore original Auth activation entrypoint and its prior privilege contract.
drop function public.partner_app_activate_current_account();
alter function public.partner_app_activate_current_account_before_group_associates()
  rename to partner_app_activate_current_account;
revoke all on function public.partner_app_activate_current_account() from public, anon;
grant execute on function public.partner_app_activate_current_account() to authenticated, service_role;

-- Restore original identity resolution and context.
drop function public.partner_app_current_identity();
alter function public.partner_app_current_identity_before_group_associates()
  rename to partner_app_current_identity;
revoke all on function public.partner_app_current_identity() from public, anon;
grant execute on function public.partner_app_current_identity() to authenticated, service_role;

drop function public.partner_portal_access_context();
alter function public.partner_portal_access_context_before_group_associates()
  rename to partner_portal_access_context;
revoke all on function public.partner_portal_access_context() from public, anon;
grant execute on function public.partner_portal_access_context() to authenticated, service_role;

-- Retarget convenience wrappers so they do not retain dependencies on renamed
-- function OIDs from the Group Associate version.
create function public.partner_portal_current_identity()
returns jsonb language sql stable security definer
set search_path=public,auth as $$
 select public.partner_app_current_identity();
$$;
revoke all on function public.partner_portal_current_identity() from public,anon;
grant execute on function public.partner_portal_current_identity() to authenticated,service_role;

create function public.partner_portal_scoped_partner_ids()
returns uuid[] language sql stable security definer
set search_path=public as $$
 select coalesce((select c.scoped_partner_ids from public.partner_portal_access_context() c limit 1),'{}'::uuid[]);
$$;
revoke all on function public.partner_portal_scoped_partner_ids() from public,anon;
grant execute on function public.partner_portal_scoped_partner_ids() to authenticated,service_role;

drop function public.group_associate_active_group_id();

-- Deliberately retain public.group_portal_associate_accounts and
-- public.group_portal_associate_audit, preserving history for forensic review.
-- A subsequent explicit cleanup migration may remove empty tables after approval.
commit;
