-- INSUREIT internal assurance: P0/P1 database security hardening.
-- 2026-10-07
-- Purpose:
--   1) remove anonymous execution from SECURITY DEFINER functions while preserving
--      the pre-existing signed-in execution set;
--   2) lock administrative/reporting RPCs to service_role;
--   3) remove broad delete policies that treated customers/intermediaries as staff deleters;
--   4) remove legacy anonymous POSP document access and constrain the bucket;
--   5) lock privileged audit/cleanup views to server-only access and security-invoker semantics;
--   6) pin mutable function search_path values reported by the Supabase advisor.
--
-- This migration intentionally does not delete or rewrite business data.

-- ---------------------------------------------------------------------------
-- 1. SECURITY DEFINER execution surface
-- ---------------------------------------------------------------------------
do $$
declare
  r record;
  v_authenticated_can_execute boolean;
begin
  for r in
    select
      p.oid,
      p.oid::regprocedure as signature,
      p.prorettype = 'pg_catalog.trigger'::regtype as is_trigger
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
  loop
    -- Capture the effective signed-in permission before removing PUBLIC inheritance.
    v_authenticated_can_execute := has_function_privilege('authenticated', r.oid, 'EXECUTE');

    execute format('revoke execute on function %s from public', r.signature);
    execute format('revoke execute on function %s from anon', r.signature);
    execute format('revoke execute on function %s from authenticated', r.signature);

    -- Trigger functions are invoked only by their trigger and should never be
    -- directly exposed as API RPCs.
    if v_authenticated_can_execute and not r.is_trigger then
      execute format('grant execute on function %s to authenticated', r.signature);
    end if;

    execute format('grant execute on function %s to service_role', r.signature);
  end loop;
end
$$;

-- Administrative/reporting functions are server-only even for signed-in clients.
revoke execute on function public.get_policy_business_report_v4(uuid[], date, date, uuid, uuid, text, text, text, integer, integer) from public, anon, authenticated;
grant execute on function public.get_policy_business_report_v4(uuid[], date, date, uuid, uuid, text, text, text, integer, integer) to service_role;

revoke execute on function public.issue_partner_identity(uuid, uuid) from public, anon, authenticated;
grant execute on function public.issue_partner_identity(uuid, uuid) to service_role;

revoke execute on function public.issue_legacy_partner_identity(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.issue_legacy_partner_identity(uuid, uuid, text) to service_role;

revoke execute on function public.ensure_legacy_partner_record(uuid, uuid) from public, anon, authenticated;
grant execute on function public.ensure_legacy_partner_record(uuid, uuid) to service_role;

revoke execute on function public.post_accounts_excel_reconciliation(uuid, jsonb, jsonb, jsonb) from public, anon, authenticated;
grant execute on function public.post_accounts_excel_reconciliation(uuid, jsonb, jsonb, jsonb) to service_role;

revoke execute on function public.finalize_policy_intake_motor_v1(uuid, jsonb, integer) from public, anon, authenticated;
grant execute on function public.finalize_policy_intake_motor_v1(uuid, jsonb, integer) to service_role;


-- Internal synchronization / repair helpers must not be directly client-callable.
revoke execute on function public.insert_customer_activity_event(uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.insert_customer_activity_event(uuid, uuid, uuid, uuid, uuid, text, uuid, text, text, text, text, jsonb) to service_role;

revoke execute on function public.repair_legacy_partner_record_link(uuid, uuid) from public, anon, authenticated;
grant execute on function public.repair_legacy_partner_record_link(uuid, uuid) to service_role;

revoke execute on function public.sync_existing_intermediary_migration(uuid, uuid, jsonb, text) from public, anon, authenticated;
grant execute on function public.sync_existing_intermediary_migration(uuid, uuid, jsonb, text) to service_role;

revoke execute on function public.sync_external_customer_stage_to_operations(uuid, uuid) from public, anon, authenticated;
grant execute on function public.sync_external_customer_stage_to_operations(uuid, uuid) to service_role;

revoke execute on function public.sync_group_corporate_onboarding_contacts(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.sync_group_corporate_onboarding_contacts(uuid, jsonb) to service_role;

revoke execute on function public.sync_partner_details_to_linked_accounts(uuid) from public, anon, authenticated;
grant execute on function public.sync_partner_details_to_linked_accounts(uuid) to service_role;

revoke execute on function public.sync_partner_identity_to_intermediary_register(uuid) from public, anon, authenticated;
grant execute on function public.sync_partner_identity_to_intermediary_register(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 2. Role resolution and destructive RLS policies
-- ---------------------------------------------------------------------------
-- Bind group-management actor IDs to the authenticated caller. Server-side
-- service-role workflows remain permitted when they explicitly supply the actor.
create or replace function public.assert_group_relationship_manager(actor_profile_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public
as $function$
declare
  actor_role text;
  request_role text := coalesce(
    auth.jwt() ->> 'role',
    current_setting('request.jwt.claim.role', true),
    ''
  );
begin
  if actor_profile_id is null then
    raise exception 'A reviewer profile is required to manage Group affiliations.';
  end if;

  if request_role <> 'service_role' and actor_profile_id is distinct from auth.uid() then
    raise exception 'The Group relationship actor does not match the authenticated user.';
  end if;

  select role::text into actor_role
  from public.profiles
  where id = actor_profile_id
    and is_active;

  if actor_role not in (
    'super_admin', 'admin', 'manager', 'it_super_user',
    'sales_operations_head', 'backoffice_executive'
  ) then
    raise exception 'You are not allowed to manage Group affiliations.';
  end if;
end;
$function$;

create or replace function public.current_app_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $function$
  select case
    when coalesce(
      auth.jwt() ->> 'role',
      current_setting('request.jwt.claim.role', true),
      ''
    ) = 'service_role'
      then 'super_admin'::public.app_role
    when auth.uid() is null
      then null::public.app_role
    else coalesce(
      (
        select profile.role
        from public.profiles as profile
        where profile.id = auth.uid()
          and profile.is_active
      ),
      'customer'::public.app_role
    )
  end;
$function$;

do $$
declare
  v_table text;
  v_tables text[] := array[
    'claim_document_verifications',
    'claim_documents',
    'claim_financials',
    'claim_tasks',
    'customer_contacts',
    'customer_documents',
    'customer_memberships',
    'customer_onboarding_applications',
    'customer_onboarding_contacts',
    'customer_onboarding_documents',
    'customer_relationships',
    'external_policies',
    'garages',
    'insurance_companies',
    'insurance_company_aliases',
    'intermediaries',
    'intermediary_commission_ledger',
    'intermediary_customer_links',
    'intermediary_documents',
    'intermediary_onboarding_applications',
    'intermediary_onboarding_contacts',
    'intermediary_onboarding_documents',
    'intermediary_referrals',
    'intermediary_training_exam_assignments',
    'non_motor_policy_details',
    'notifications',
    'policies',
    'policy_documents',
    'posp_misp_import_batches',
    'posp_misp_import_row_documents',
    'posp_misp_import_rows',
    'posp_misp_onboarding_profiles',
    'surveyors',
    'vehicles'
  ];
begin
  foreach v_table in array v_tables
  loop
    execute format(
      'drop policy if exists %I on public.%I',
      'staff_delete_reserved_for_it_super_user',
      v_table
    );

    execute format(
      'create policy %I on public.%I for delete to authenticated using ((select auth.uid()) is not null and public.current_app_role() = ''it_super_user''::public.app_role)',
      'staff_delete_reserved_for_it_super_user',
      v_table
    );

    -- Anonymous users never need direct destructive access to these business tables.
    execute format('revoke delete on table public.%I from anon', v_table);
  end loop;
end
$$;

-- ---------------------------------------------------------------------------
-- 3. RLS deny-all tables: remove non-RLS client privileges
-- ---------------------------------------------------------------------------
-- RLS does not govern TRUNCATE / REFERENCES / TRIGGER privileges. Tables that
-- intentionally have RLS enabled with zero policies are server-only; remove all
-- direct client privileges so the deny-all contract is complete.
do $
declare
  r record;
begin
  for r in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_policy p on p.polrelid = c.oid
    where n.nspname = 'public'
      and c.relkind = 'r'
      and c.relrowsecurity
    group by c.oid, c.relname
    having count(p.oid) = 0
  loop
    execute format('revoke all privileges on table public.%I from anon', r.relname);
    execute format('revoke all privileges on table public.%I from authenticated', r.relname);
    execute format('grant all privileges on table public.%I to service_role', r.relname);
  end loop;
end
$;

-- ---------------------------------------------------------------------------
-- 4. Legacy POSP document bucket
-- ---------------------------------------------------------------------------
drop policy if exists "Allow anon read posp-documents" on storage.objects;
drop policy if exists "Allow anon upload posp-documents" on storage.objects;

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png']::text[]
where id = 'posp-documents';

-- ---------------------------------------------------------------------------
-- 5. Privileged audit/cleanup views
-- ---------------------------------------------------------------------------
alter view public.intermediary_customer_cleanup_candidates set (security_invoker = true);
alter view public.intermediary_onboarding_cutover_audit set (security_invoker = true);

revoke all on table public.intermediary_customer_cleanup_candidates from anon, authenticated;
revoke all on table public.intermediary_onboarding_cutover_audit from anon, authenticated;
grant select on table public.intermediary_customer_cleanup_candidates to service_role;
grant select on table public.intermediary_onboarding_cutover_audit to service_role;

-- ---------------------------------------------------------------------------
-- 6. Mutable search_path hardening
-- ---------------------------------------------------------------------------
alter function public.assign_support_ticket_number() set search_path = public, pg_temp;
alter function public.audit_customer_creation_provenance() set search_path = public, pg_temp;
alter function public.audit_customer_parent_relationship() set search_path = public, pg_temp;
alter function public.classify_direct_customer_onboarding() set search_path = public, pg_temp;
alter function public.classify_policy_onboarded_customer() set search_path = public, pg_temp;
alter function public.exchange_mask_registration(text) set search_path = public, pg_temp;
alter function public.generate_claim_control_no() set search_path = public, pg_temp;
alter function public.generate_sibl_claim_no() set search_path = public, pg_temp;
alter function public.is_allowed_customer_hierarchy(text, text) set search_path = public, pg_temp;
alter function public.is_shared_intermediary_document_type(text) set search_path = public, pg_temp;
alter function public.prevent_intermediary_customer_rows() set search_path = public, pg_temp;
alter function public.prevent_private_voice_dataset_member_mutation() set search_path = public, pg_temp;
alter function public.protect_customer_creation_provenance() set search_path = public, pg_temp;
alter function public.set_claim_document_verifications_updated_at() set search_path = public, pg_temp;
alter function public.set_customer_activity_events_updated_at() set search_path = public, pg_temp;
alter function public.set_updated_at() set search_path = public, pg_temp;
alter function public.sync_pending_vehicle_no_from_chassis() set search_path = public, pg_temp;
alter function public.touch_policy_intake_updated_at() set search_path = public, pg_temp;
alter function public.validate_intermediary_onboarding_profile() set search_path = public, pg_temp;
alter function public.validate_required_intermediary_identity_fields() set search_path = public, pg_temp;


-- ---------------------------------------------------------------------------
-- 7. Extension schema hardening
-- ---------------------------------------------------------------------------
-- The live database search_path already includes "extensions"; move pg_trgm
-- out of the exposed public schema without rebuilding dependent indexes.
alter extension pg_trgm set schema extensions;


-- ---------------------------------------------------------------------------
-- 8. Explicit authenticated-only reference-data policy
-- ---------------------------------------------------------------------------
drop policy if exists "Authenticated users can read vehicle manufacturers" on public.vehicle_manufacturers;
create policy "Authenticated users can read vehicle manufacturers"
on public.vehicle_manufacturers
for select
to authenticated
using (true);
