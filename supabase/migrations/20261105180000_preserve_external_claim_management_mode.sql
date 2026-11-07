-- Entering an External Claim in Operations is an authorized read, not an ownership takeover.
-- Keep self_managed and broker_managed unchanged, along with customer milestones,
-- assistance decisions, actor assignment and status history.
CREATE OR REPLACE FUNCTION public.begin_external_claim_operations_workflow(
  p_claim_id uuid,
  p_actor_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_claim public.claims%rowtype;
BEGIN
  IF auth.uid() IS NULL OR p_actor_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'The Operations user does not match the authenticated user.';
  END IF;

  IF NOT public.can_update_claim_status()
     OR NOT public.can_access_claim(auth.uid(), p_claim_id) THEN
    RAISE EXCEPTION 'You do not have permission to manage this claim.';
  END IF;

  SELECT * INTO v_claim FROM public.claims WHERE id = p_claim_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Claim not found.';
  END IF;

  IF v_claim.policy_service_source IS DISTINCT FROM 'external'::public.policy_service_source
     OR v_claim.external_policy_id IS NULL THEN
    RAISE EXCEPTION 'Only External Claims can enter the External Operations workflow.';
  END IF;

  IF v_claim.claim_service_mode NOT IN
     ('self_managed'::public.claim_service_mode, 'broker_managed'::public.claim_service_mode) THEN
    RAISE EXCEPTION 'This External Claim has an unsupported workflow ownership state.';
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'claim_id', v_claim.id,
    'claim_service_mode', v_claim.claim_service_mode::text,
    'policy_service_source', 'external',
    'current_status', v_claim.current_status,
    'changed', false
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.begin_external_claim_operations_workflow(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.begin_external_claim_operations_workflow(uuid, uuid) TO authenticated;
