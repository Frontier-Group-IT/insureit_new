-- Keep detail authorization aligned with the partner policy register.
-- The register authorizes intermediary IDs and scoped Partner codes, including active child branches.
-- Never authorize based on a branch name or an unscoped intermediary code.
CREATE OR REPLACE FUNCTION public.partner_app_policy_in_scope(p_policy_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  v_scope jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_partner_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_policy public.policies%rowtype;
  v_intermediary_id uuid;
BEGIN
  IF p_policy_id IS NULL THEN RETURN false; END IF;
  v_scope := public.partner_app_commercial_scope();
  IF v_scope IS NULL THEN RETURN false; END IF;

  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');
  IF v_scope_mode='none' THEN RETURN false; END IF;

  SELECT * INTO v_policy FROM public.policies WHERE id=p_policy_id;
  IF NOT FOUND THEN RETURN false; END IF;

  IF v_actor_kind='employee' AND v_scope_mode='organization' THEN RETURN true; END IF;

  SELECT coalesce(array_agg(value::uuid),array[]::uuid[])
    INTO v_employee_ids
    FROM jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;
  SELECT coalesce(array_agg(value::uuid),array[]::uuid[])
    INTO v_intermediary_ids
    FROM jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;
  SELECT coalesce(array_agg(value::uuid),array[]::uuid[])
    INTO v_partner_ids
    FROM jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;
  SELECT coalesce(array_agg(value::uuid),array[]::uuid[])
    INTO v_group_ids
    FROM jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  SELECT i.id INTO v_intermediary_id
    FROM public.intermediaries i
    WHERE i.intermediary_code=v_policy.intermediary_code
    LIMIT 1;

  IF v_actor_kind='intermediary' THEN
    RETURN (v_intermediary_id IS NOT NULL AND v_intermediary_id=ANY(v_intermediary_ids))
      OR EXISTS (
        SELECT 1 FROM public.partners scoped_partner
        WHERE scoped_partner.id=ANY(v_partner_ids)
          AND scoped_partner.partner_code=v_policy.intermediary_code
      );
  END IF;

  IF v_actor_kind='employee' THEN
    RETURN v_policy.rm_employee_id=ANY(v_employee_ids)
      OR (v_intermediary_id IS NOT NULL AND v_intermediary_id=ANY(v_intermediary_ids))
      OR (v_policy.intermediary_group_id IS NOT NULL AND v_policy.intermediary_group_id=ANY(v_group_ids));
  END IF;

  RETURN false;
END;
$function$;

REVOKE ALL ON FUNCTION public.partner_app_policy_in_scope(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_app_policy_in_scope(uuid) TO authenticated, service_role;
