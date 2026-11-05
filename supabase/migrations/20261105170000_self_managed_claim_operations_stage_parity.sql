-- Self-managed Operations claim stage parity.
-- Changes two existing trigger functions; does not modify claim rows or user permissions.
DO $migration$
DECLARE
  fn text;
  body text;
  original_lookup text := 'and claim_service_mode = ''broker_managed''';
  new_lookup text := 'and claim_service_mode in (''broker_managed'', ''self_managed'')';
  old_guard text := '  if not found then' || chr(10) || '    raise exception ''Managed claim not found.'';' || chr(10) || '  end if;';
  new_guard text := old_guard || chr(10) || chr(10) ||
    '  if v_claim.claim_service_mode = ''self_managed'' and not v_operations_actor then' || chr(10) ||
    '    raise exception ''Self-managed claim stages require Operations authorization.'';' || chr(10) ||
    '  end if;';
BEGIN
  FOREACH fn IN ARRAY ARRAY[
    'persist_initial_document_submission_from_stage_details',
    'persist_managed_claim_stage_transition_from_details',
    'advance_initial_documents_verified',
    'complete_spot_survey'
  ] LOOP
    SELECT pg_get_functiondef(p.oid) INTO body
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = fn AND p.pronargs = 0;
    IF body IS NULL OR position(original_lookup IN body) = 0
       OR (fn IN ('persist_initial_document_submission_from_stage_details',
                   'persist_managed_claim_stage_transition_from_details')
           AND (position(old_guard IN body) = 0 OR position('v_operations_actor' IN body) = 0)) THEN
      RAISE EXCEPTION 'Unexpected trigger function definition: %', fn;
    END IF;
    body := replace(body, original_lookup, new_lookup);
    IF fn IN ('persist_initial_document_submission_from_stage_details',
              'persist_managed_claim_stage_transition_from_details') THEN
      body := replace(body, old_guard, new_guard);
    END IF;
    IF fn = 'persist_managed_claim_stage_transition_from_details' THEN
      IF position('  if v_claim.policy_service_source::text = ''external''' IN body) = 0 THEN
        RAISE EXCEPTION 'Expected external claim save-only guard missing';
      END IF;
      body := replace(body,
        '  if v_claim.policy_service_source::text = ''external''',
        '  if v_claim.claim_service_mode = ''self_managed'' and not (new.details ? ''completed_at'') then' || chr(10) ||
        '    return new;' || chr(10) ||
        '  end if;' || chr(10) || chr(10) ||
        '  if v_claim.policy_service_source::text = ''external''');
    END IF;
    EXECUTE body;
  END LOOP;
END;
$migration$;
