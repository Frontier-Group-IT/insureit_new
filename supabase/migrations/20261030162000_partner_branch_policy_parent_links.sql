-- Non-destructive attribution bridge: same pattern as Partner associates (child identity, parent owner).
-- No updates to policies, premiums, intermediary codes or historical Partner IDs.
BEGIN;
CREATE TABLE IF NOT EXISTS public.partner_branch_policy_links (
 policy_id uuid PRIMARY KEY REFERENCES public.policies(id) ON DELETE RESTRICT,
 branch_id uuid NOT NULL REFERENCES public.partner_branches(id) ON DELETE RESTRICT,
 parent_partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
 legacy_intermediary_code text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_branch_policy_links_parent_idx ON public.partner_branch_policy_links(parent_partner_id);
CREATE INDEX IF NOT EXISTS partner_branch_policy_links_branch_idx ON public.partner_branch_policy_links(branch_id);
ALTER TABLE public.partner_branch_policy_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_branch_policy_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT ON public.partner_branch_policy_links TO service_role;

-- Guard against silently misattributing historical policies.
DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM public.policies p
  JOIN public.partners legacy ON legacy.partner_code=p.intermediary_code
  JOIN public.partner_branch_profiles old ON old.partner_id=legacy.id
  LEFT JOIN public.partner_branches b ON b.legacy_branch_profile_id=old.id
  WHERE b.id IS NULL OR b.parent_partner_id IS DISTINCT FROM legacy.parent_partner_id
 ) THEN
  RAISE EXCEPTION 'Unresolved Branch/Partner ownership: refusing policy mapping';
 END IF;
END $$;

INSERT INTO public.partner_branch_policy_links(policy_id,branch_id,parent_partner_id,legacy_intermediary_code)
SELECT p.id,b.id,b.parent_partner_id,p.intermediary_code
FROM public.policies p
JOIN public.partners legacy ON legacy.partner_code=p.intermediary_code
JOIN public.partner_branch_profiles old ON old.partner_id=legacy.id
JOIN public.partner_branches b ON b.legacy_branch_profile_id=old.id
ON CONFLICT (policy_id) DO NOTHING;

DO $$
BEGIN
 IF EXISTS (
  SELECT 1 FROM public.partner_branch_policy_links links
  JOIN public.policies p ON p.id=links.policy_id
  JOIN public.partner_branches b ON b.id=links.branch_id
  WHERE links.parent_partner_id IS DISTINCT FROM b.parent_partner_id
     OR links.legacy_intermediary_code IS DISTINCT FROM p.intermediary_code
 ) THEN
  RAISE EXCEPTION 'Existing Branch policy link is inconsistent with original records';
 END IF;
END $$;
COMMIT;
