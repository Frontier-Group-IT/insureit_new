-- Verification for 20261007143000_internal_assurance_p0_security_hardening.sql
do $$
declare
  v_count integer;
begin
  -- No SECURITY DEFINER function in public may remain executable by anon.
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and has_function_privilege('anon', p.oid, 'EXECUTE');
  if v_count <> 0 then
    raise exception 'Anonymous SECURITY DEFINER execution remains on % function(s)', v_count;
  end if;


  -- Trigger functions must not be directly executable as API RPCs.
  select count(*) into v_count
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef
    and p.prorettype = 'pg_catalog.trigger'::regtype
    and has_function_privilege('authenticated', p.oid, 'EXECUTE');
  if v_count <> 0 then
    raise exception 'Authenticated direct trigger-function execution remains on % function(s)', v_count;
  end if;

  -- Internal helpers identified by the assurance review must be service-role-only.
  if exists (
    select 1
    from unnest(array[
      'public.insert_customer_activity_event(uuid,uuid,uuid,uuid,uuid,text,uuid,text,text,text,text,jsonb)'::regprocedure,
      'public.repair_legacy_partner_record_link(uuid,uuid)'::regprocedure,
      'public.sync_existing_intermediary_migration(uuid,uuid,jsonb,text)'::regprocedure,
      'public.sync_external_customer_stage_to_operations(uuid,uuid)'::regprocedure,
      'public.sync_group_corporate_onboarding_contacts(uuid,jsonb)'::regprocedure,
      'public.sync_partner_details_to_linked_accounts(uuid)'::regprocedure,
      'public.sync_partner_identity_to_intermediary_register(uuid)'::regprocedure
    ]) as f(oid)
    where has_function_privilege('anon', f.oid, 'EXECUTE')
       or has_function_privilege('authenticated', f.oid, 'EXECUTE')
  ) then
    raise exception 'One or more internal synchronization helpers remain client-callable';
  end if;

  if position(
    'actor_profile_id is distinct from auth.uid()'
    in pg_get_functiondef('public.assert_group_relationship_manager(uuid)'::regprocedure)
  ) = 0 then
    raise exception 'Group relationship manager helper is not bound to auth.uid()';
  end if;

  -- Confirm server-only administrative RPCs are not executable by ordinary clients.
  if has_function_privilege('anon', 'public.get_policy_business_report_v4(uuid[],date,date,uuid,uuid,text,text,text,integer,integer)'::regprocedure, 'EXECUTE')
     or has_function_privilege('authenticated', 'public.get_policy_business_report_v4(uuid[],date,date,uuid,uuid,text,text,text,integer,integer)'::regprocedure, 'EXECUTE') then
    raise exception 'Policy business report RPC is not service-role-only';
  end if;

  if has_function_privilege('anon', 'public.issue_partner_identity(uuid,uuid)'::regprocedure, 'EXECUTE')
     or has_function_privilege('authenticated', 'public.issue_partner_identity(uuid,uuid)'::regprocedure, 'EXECUTE') then
    raise exception 'Partner identity RPC is not service-role-only';
  end if;

  if has_function_privilege('anon', 'public.issue_legacy_partner_identity(uuid,uuid,text)'::regprocedure, 'EXECUTE')
     or has_function_privilege('authenticated', 'public.issue_legacy_partner_identity(uuid,uuid,text)'::regprocedure, 'EXECUTE') then
    raise exception 'Legacy partner identity RPC is not service-role-only';
  end if;

  if has_function_privilege('anon', 'public.ensure_legacy_partner_record(uuid,uuid)'::regprocedure, 'EXECUTE')
     or has_function_privilege('authenticated', 'public.ensure_legacy_partner_record(uuid,uuid)'::regprocedure, 'EXECUTE') then
    raise exception 'Legacy partner record RPC is not service-role-only';
  end if;

  if has_function_privilege('anon', 'public.post_accounts_excel_reconciliation(uuid,jsonb,jsonb,jsonb)'::regprocedure, 'EXECUTE')
     or has_function_privilege('authenticated', 'public.post_accounts_excel_reconciliation(uuid,jsonb,jsonb,jsonb)'::regprocedure, 'EXECUTE') then
    raise exception 'Accounts reconciliation RPC is not service-role-only';
  end if;

  if has_function_privilege('anon', 'public.finalize_policy_intake_motor_v1(uuid,jsonb,integer)'::regprocedure, 'EXECUTE')
     or has_function_privilege('authenticated', 'public.finalize_policy_intake_motor_v1(uuid,jsonb,integer)'::regprocedure, 'EXECUTE') then
    raise exception 'Policy intake finalization RPC is not service-role-only';
  end if;

  -- The legacy POSP bucket must no longer expose anonymous read/upload policies.
  if exists (
    select 1 from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname in ('Allow anon read posp-documents', 'Allow anon upload posp-documents')
  ) then
    raise exception 'Legacy POSP anonymous storage policy remains';
  end if;

  if exists (
    select 1
    from storage.buckets
    where id = 'posp-documents'
      and (
        public
        or file_size_limit is distinct from 10485760
        or allowed_mime_types is distinct from array['application/pdf','image/jpeg','image/png']::text[]
      )
  ) then
    raise exception 'POSP document bucket hardening is incomplete';
  end if;

  -- Privileged views must be invoker-mode and unavailable to ordinary API roles.
  if exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('intermediary_customer_cleanup_candidates','intermediary_onboarding_cutover_audit')
      and not ('security_invoker=true' = any(coalesce(c.reloptions, array[]::text[])))
  ) then
    raise exception 'Privileged views are not security_invoker';
  end if;

  if has_table_privilege('anon', 'public.intermediary_customer_cleanup_candidates', 'SELECT')
     or has_table_privilege('authenticated', 'public.intermediary_customer_cleanup_candidates', 'SELECT')
     or has_table_privilege('anon', 'public.intermediary_onboarding_cutover_audit', 'SELECT')
     or has_table_privilege('authenticated', 'public.intermediary_onboarding_cutover_audit', 'SELECT') then
    raise exception 'Privileged views remain client-readable';
  end if;

  -- Broad delete policy must no longer be assigned to PUBLIC or allow customer/intermediary.
  select count(*) into v_count
  from pg_policies
  where schemaname = 'public'
    and policyname = 'staff_delete_reserved_for_it_super_user'
    and (
      'public' = any(roles)
      or coalesce(qual,'') ilike '%customer%'
      or coalesce(qual,'') ilike '%intermediary%'
      or coalesce(qual,'') not ilike '%it_super_user%'
    );
  if v_count <> 0 then
    raise exception 'Unsafe generic delete policy remains on % table(s)', v_count;
  end if;
  if exists (
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pg_trgm'
      and n.nspname = 'public'
  ) then
    raise exception 'pg_trgm remains installed in the public schema';
  end if;
end
$;

select 'internal assurance P0/P1 database security verification passed' as verification_result;
