-- Apply only to the existing coordinated, guarded IT Super User pair-delete RPC.
-- Keep the FK RESTRICT constraint. This change is atomic with policy deletion.
DO $migration$
DECLARE definition text;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO definition
  FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.proname='delete_policy_with_completed_intake_pair'
    AND pg_get_function_identity_arguments(p.oid)='p_policy_id uuid, p_intake_id uuid, p_actor_id uuid';
  IF definition IS NULL THEN RAISE EXCEPTION 'Expected coordinated delete function missing'; END IF;
  IF position('delete from public.partner_branch_policy_links' in lower(definition)) > 0 THEN RETURN; END IF;
  IF position('  delete from public.policy_intake_requests' in definition)=0
     OR position('  delete from public.policies where id = p_policy_id;' in definition)=0
     OR position('  select count(*) into v_block_count from public.claims' in definition)=0
  THEN RAISE EXCEPTION 'Unexpected coordinated deletion function shape'; END IF;
  definition := replace(definition,
    '  delete from public.policy_intake_requests',
    $replacement$  -- Remove only this policy's association after the existing dependency guards.
  delete from public.partner_branch_policy_links where policy_id = p_policy_id;

  delete from public.policy_intake_requests$replacement$);
  EXECUTE definition;
END
$migration$;
