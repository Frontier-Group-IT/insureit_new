-- Continue 2026-10-07 internal security remediation.
-- Trigger functions are database plumbing, not Data API endpoints. Remove direct browser
-- execution while preserving their existing trigger bindings. Also pin search_path on the
-- exact functions reported by the Supabase security advisor.

begin;

do $$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and pg_get_function_result(p.oid) in ('trigger', 'event_trigger')
  loop
    execute format(
      'revoke execute on function %s from public, anon, authenticated',
      function_row.signature
    );
  end loop;
end;
$$;

do $$
declare
  function_row record;
begin
  for function_row in
    select p.oid::regprocedure as signature
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any(array[
        'classify_direct_customer_onboarding',
        'is_shared_intermediary_document_type',
        'prevent_intermediary_customer_rows',
        'set_claim_document_verifications_updated_at',
        'assign_support_ticket_number',
        'prevent_private_voice_dataset_member_mutation',
        'audit_customer_creation_provenance',
        'audit_customer_parent_relationship',
        'classify_policy_onboarded_customer',
        'generate_claim_control_no',
        'generate_sibl_claim_no',
        'is_allowed_customer_hierarchy',
        'protect_customer_creation_provenance',
        'set_customer_activity_events_updated_at',
        'set_updated_at',
        'exchange_mask_registration',
        'sync_pending_vehicle_no_from_chassis',
        'validate_intermediary_onboarding_profile',
        'validate_required_intermediary_identity_fields',
        'touch_policy_intake_updated_at'
      ])
  loop
    execute format(
      'alter function %s set search_path to public',
      function_row.signature
    );
  end loop;
end;
$$;

commit;
