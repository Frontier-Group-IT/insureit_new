-- Automatically attach newly completed, unambiguously Branch-submitted policies.
-- Branch ownership comes from the authenticated submitter's persisted canonical/legacy
-- account mapping, never from names or browser-provided parameters.
-- Only a policy with the Branch's legacy code or its verified parent code qualifies.
BEGIN;
CREATE OR REPLACE FUNCTION public.partner_branch_link_completed_intake_policy()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public','auth'
AS $fn$
DECLARE
  v_branch uuid;
  v_parent uuid;
  v_branch_code text;
  v_parent_code text;
  v_legacy_code text;
  v_count integer;
  v_policy_code text;
  v_other_branch uuid;
BEGIN
  IF NEW.status IS DISTINCT FROM 'completed' OR NEW.final_policy_id IS NULL
     OR NEW.submitted_by_profile_id IS NULL THEN RETURN NEW; END IF;
  -- On insert or when completion/policy linkage changes, look up a single
  -- currently active Branch identity for this historical intake submitter.
  WITH found AS (
    SELECT DISTINCT b.id,b.parent_partner_id,b.branch_code,legacy_partner.partner_code AS legacy_code,
           parent.partner_code AS parent_code
    FROM public.portal_access_identities a
    JOIN public.partner_branch_profiles legacy ON legacy.partner_id=a.entity_id
    JOIN public.partner_branches b ON b.legacy_branch_profile_id=legacy.id
    JOIN public.partners legacy_partner ON legacy_partner.id=legacy.partner_id
    JOIN public.partners parent ON parent.id=b.parent_partner_id
    JOIN public.profiles profile ON profile.id=a.profile_id
    WHERE a.profile_id=NEW.submitted_by_profile_id AND a.entity_type='branch'
      AND a.status='active' AND b.status='active' AND profile.is_active
      AND legacy_partner.parent_partner_id=b.parent_partner_id
      AND parent.parent_partner_id IS NULL AND parent.partner_status='active_partner'
  )
  SELECT count(*),max(id::text)::uuid,max(parent_partner_id::text)::uuid,max(branch_code),max(legacy_code),max(parent_code)
  INTO v_count,v_branch,v_parent,v_branch_code,v_legacy_code,v_parent_code
  FROM found;
  IF v_count=0 THEN RETURN NEW; END IF;
  IF v_count<>1 THEN RAISE EXCEPTION 'Ambiguous Branch policy ownership for intake %',NEW.id; END IF;
  SELECT intermediary_code INTO v_policy_code FROM public.policies WHERE id=NEW.final_policy_id;
  IF NOT FOUND OR v_policy_code NOT IN (v_legacy_code,v_parent_code) THEN RETURN NEW; END IF;

  -- Never silently transfer a policy already linked to another Branch.
  SELECT branch_id INTO v_other_branch FROM public.partner_branch_policy_links
    WHERE policy_id=NEW.final_policy_id;
  IF v_other_branch IS NOT NULL AND v_other_branch<>v_branch THEN
    RAISE EXCEPTION 'Policy % already belongs to another Branch',NEW.final_policy_id;
  END IF;

  INSERT INTO public.partner_branch_policy_links(policy_id,branch_id,parent_partner_id,legacy_intermediary_code)
  VALUES(NEW.final_policy_id,v_branch,v_parent,v_policy_code)
  ON CONFLICT (policy_id) DO NOTHING;
  RETURN NEW;
END;
$fn$;
REVOKE ALL ON FUNCTION public.partner_branch_link_completed_intake_policy() FROM PUBLIC,anon,authenticated;
DROP TRIGGER IF EXISTS partner_branch_link_completed_intake_policy_trg ON public.policy_intake_requests;
CREATE TRIGGER partner_branch_link_completed_intake_policy_trg
AFTER INSERT OR UPDATE OF status,final_policy_id,submitted_by_profile_id
ON public.policy_intake_requests
FOR EACH ROW EXECUTE FUNCTION public.partner_branch_link_completed_intake_policy();
COMMIT;
