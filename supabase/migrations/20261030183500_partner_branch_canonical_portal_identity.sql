-- Canonical Branch identity contract, following the Partner Associate account pattern.
-- No legacy login function is replaced here. This resolver is intended for an
-- atomic application+RPC cutover after real authenticated security tests pass.
BEGIN;
CREATE OR REPLACE FUNCTION public.partner_branch_portal_identity()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path TO 'public','auth'
AS $fn$
DECLARE
  v_branch record;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NULL; END IF;
  -- A disabled legacy account cannot be revived via a canonical link.
  IF EXISTS (
    SELECT 1 FROM public.portal_access_identities a
    WHERE a.profile_id=auth.uid() AND a.entity_type='branch' AND a.status<>'active'
  ) THEN RETURN NULL; END IF;
  SELECT c.branch_id,c.parent_partner_id,c.branch_code,c.legacy_partner_id,
         b.branch_name,p.partner_code parent_partner_code,p.display_name parent_partner_name
    INTO v_branch
  FROM public.partner_branch_canonical_access() c
  JOIN public.partner_branches b ON b.id=c.branch_id
  JOIN public.partners p ON p.id=c.parent_partner_id
  LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object(
    'actor_kind','intermediary',
    'auth_user_id',auth.uid(),
    'profile_id',auth.uid(),
    'portal_access_type','branch',
    'portal_access_entity_id',v_branch.branch_id,
    'branch_id',v_branch.branch_id,
    'branch_code',v_branch.branch_code,
    'parent_partner_id',v_branch.parent_partner_id,
    'parent_partner_code',v_branch.parent_partner_code,
    'parent_partner_name',v_branch.parent_partner_name,
    'legacy_partner_id',v_branch.legacy_partner_id,
    'display_name',v_branch.branch_name
  );
END;
$fn$;
REVOKE ALL ON FUNCTION public.partner_branch_portal_identity() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.partner_branch_portal_identity() TO authenticated,service_role;
COMMIT;
