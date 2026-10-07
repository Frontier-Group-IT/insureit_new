-- Internal security boundary hardening identified during 2026-10-07 production assurance audit.
-- Scope: fail-closed role resolution, remove broad delete policy exposure, protect privileged
-- RPCs/views, and close legacy anonymous POSP document access. No business data is deleted.

begin;

-- Fail closed when there is no active signed-in profile.
create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select case
    when coalesce(
      auth.jwt() ->> 'role',
      current_setting('request.jwt.claim.role', true),
      ''
    ) = 'service_role'
      then 'super_admin'::public.app_role
    else (
      select profile.role
      from public.profiles as profile
      where profile.id = (select auth.uid())
        and profile.is_active
      limit 1
    )
  end;
$$;

revoke all on function public.current_app_role() from public, anon;
grant execute on function public.current_app_role() to authenticated, service_role;

-- The policy name says staff delete is reserved for IT Super User. The previous predicate
-- also admitted customer/intermediary, which made the permissive policy table-wide.
do $$
declare
  policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and policyname = 'staff_delete_reserved_for_it_super_user'
  loop
    execute format(
      'alter policy %I on %I.%I to authenticated using ((select auth.uid()) is not null and (select public.current_app_role()) = ''it_super_user''::public.app_role)',
      policy_row.policyname,
      policy_row.schemaname,
      policy_row.tablename
    );
  end loop;
end;
$$;

-- Legacy audit/cleanup views must not expose owner-level visibility through the Data API.
alter view public.intermediary_customer_cleanup_candidates set (security_invoker = true);
alter view public.intermediary_onboarding_cutover_audit set (security_invoker = true);

revoke all on table public.intermediary_customer_cleanup_candidates from public, anon, authenticated;
revoke all on table public.intermediary_onboarding_cutover_audit from public, anon, authenticated;
grant select on table public.intermediary_customer_cleanup_candidates to service_role;
grant select on table public.intermediary_onboarding_cutover_audit to service_role;

-- These privileged workflows are invoked through server-only/admin paths. Remove direct
-- browser/anonymous execution and retain service-role execution only.
revoke all on function public.finalize_policy_intake_motor_v1(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.finalize_policy_intake_motor_v1(uuid, jsonb, integer) to service_role;

revoke all on function public.get_policy_business_report_v4(uuid[], date, date, uuid, uuid, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_policy_business_report_v4(uuid[], date, date, uuid, uuid, text, text, text, integer, integer) to service_role;

revoke all on function public.issue_partner_identity(uuid, uuid) from public, anon, authenticated;
grant execute on function public.issue_partner_identity(uuid, uuid) to service_role;

revoke all on function public.issue_legacy_partner_identity(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.issue_legacy_partner_identity(uuid, uuid, text) to service_role;

revoke all on function public.ensure_legacy_partner_record(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ensure_legacy_partner_record(uuid, uuid) to service_role;

revoke all on function public.post_accounts_excel_reconciliation(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.post_accounts_excel_reconciliation(uuid, jsonb, jsonb, jsonb) to service_role;

-- Legacy POSP bucket is private but previously had bucket-wide anonymous read/upload policies.
drop policy if exists "Allow anon read posp-documents" on storage.objects;
drop policy if exists "Allow anon upload posp-documents" on storage.objects;

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['application/pdf','image/jpeg','image/png']::text[]
where id = 'posp-documents';

commit;
