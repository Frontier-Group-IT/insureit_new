-- Read-only, authenticated policy access contract for canonical Partner / Branch hierarchy.
-- Future portal readers may use this after a staged authorization cutover.
-- Existing production RPCs, logins, and financial/policy rows remain unchanged.
BEGIN;
CREATE OR REPLACE FUNCTION public.partner_branch_authorized_policy_ids()
RETURNS TABLE(policy_id uuid)
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','auth'
AS $fn$
DECLARE
  v_branch_id uuid;
  v_parent_id uuid;
  v_identity jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  -- A Branch session takes precedence over Partner identity. Do not fall back to
  -- a wider Partner scope when a Branch login is present but invalid or disabled.
  IF EXISTS (
    SELECT 1 FROM public.portal_access_identities a
    WHERE a.profile_id=auth.uid() AND a.entity_type='branch'
  ) OR EXISTS (
    SELECT 1 FROM public.partner_branch_login_links l WHERE l.profile_id=auth.uid()
  ) THEN
    SELECT a.branch_id INTO v_branch_id
    FROM public.partner_branch_canonical_access() a;
    IF v_branch_id IS NULL THEN RETURN; END IF;
    RETURN QUERY
      SELECT links.policy_id FROM public.partner_branch_policy_links links
      WHERE links.branch_id=v_branch_id;
    RETURN;
  END IF;

  -- Parent Partner only: consolidate its own original policy code and linked
  -- Branch policies by policy UUID. Never use name matching for authorization.
  v_identity := public.partner_app_current_identity();
  IF v_identity IS NULL OR v_identity->>'actor_kind'<>'intermediary' THEN RETURN; END IF;
  IF v_identity->>'intermediary_type'<>'partner' THEN RETURN; END IF;
  IF coalesce(v_identity->>'partner_id','') !~* '^[0-9a-f-]{36}
  v_parent_id := (v_identity->>'partner_id')::uuid;
  IF NOT EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id=v_parent_id AND p.parent_partner_id IS NULL
      AND p.partner_status='active_partner'
  ) THEN RETURN; END IF;

  RETURN QUERY
    SELECT p.id
    FROM public.policies p
    WHERE p.intermediary_code=(SELECT partner_code FROM public.partners WHERE id=v_parent_id)
    UNION
    SELECT links.policy_id
    FROM public.partner_branch_policy_links links
    WHERE links.parent_partner_id=v_parent_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.partner_branch_authorized_policy_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_branch_authorized_policy_ids() TO authenticated, service_role;
COMMIT;
 THEN RETURN; END IF;
  v_parent_id := (v_identity->>'partner_id')::uuid;
  IF NOT EXISTS (
    SELECT 1 FROM public.partners p
    WHERE p.id=v_parent_id AND p.parent_partner_id IS NULL
      AND p.partner_status='active_partner'
  ) THEN RETURN; END IF;

  RETURN QUERY
    SELECT p.id
    FROM public.policies p
    WHERE p.intermediary_code=(SELECT partner_code FROM public.partners WHERE id=v_parent_id)
    UNION
    SELECT links.policy_id
    FROM public.partner_branch_policy_links links
    WHERE links.parent_partner_id=v_parent_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.partner_branch_authorized_policy_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_branch_authorized_policy_ids() TO authenticated, service_role;
COMMIT;
