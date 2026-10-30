-- Explicit Branch ownership for claims without policies. No inference from customer IDs.
-- No existing claims altered. Unassigned policyless claims remain inaccessible to Branches.
BEGIN;
CREATE TABLE IF NOT EXISTS public.partner_branch_policyless_claim_ownership (
 claim_id uuid PRIMARY KEY REFERENCES public.claims(id) ON DELETE RESTRICT,
 branch_id uuid NOT NULL REFERENCES public.partner_branches(id) ON DELETE RESTRICT,
 parent_partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
 verified_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
 verified_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.partner_branch_policyless_claim_ownership ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_branch_policyless_claim_ownership FROM PUBLIC,anon,authenticated;
GRANT SELECT,INSERT,UPDATE ON public.partner_branch_policyless_claim_ownership TO service_role;
CREATE OR REPLACE FUNCTION public.partner_branch_authorized_claim_ids()
RETURNS TABLE(claim_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','auth'
AS $fn$
 WITH policy_claims AS (
   SELECT DISTINCT c.id AS claim_id FROM public.partner_branch_authorized_policy_ids() scope
   JOIN public.claims c ON c.policy_id=scope.policy_id
 ), branch_claims AS (
   SELECT own.claim_id
   FROM public.partner_branch_policyless_claim_ownership own
   JOIN public.claims c ON c.id=own.claim_id AND c.policy_id IS NULL
   JOIN public.partner_branches b ON b.id=own.branch_id AND b.parent_partner_id=own.parent_partner_id
   JOIN public.partner_branch_canonical_access() access ON access.branch_id=b.id
 ), parent_claims AS (
   SELECT own.claim_id
   FROM public.partner_branch_policyless_claim_ownership own
   JOIN public.claims c ON c.id=own.claim_id AND c.policy_id IS NULL
   JOIN public.partner_branches b ON b.id=own.branch_id AND b.parent_partner_id=own.parent_partner_id
   JOIN public.partners p ON p.id=b.parent_partner_id
   JOIN public.intermediary_portal_accounts a ON a.application_id=p.source_application_id
   WHERE a.auth_user_id=auth.uid() AND a.status='active'
     AND NOT EXISTS(SELECT 1 FROM public.portal_access_identities ba WHERE ba.profile_id=auth.uid() AND ba.entity_type='branch')
     AND NOT EXISTS(SELECT 1 FROM public.partner_branch_login_links bl WHERE bl.profile_id=auth.uid())
 )
 SELECT claim_id FROM policy_claims WHERE auth.uid() IS NOT NULL
 UNION SELECT claim_id FROM branch_claims WHERE auth.uid() IS NOT NULL
 UNION SELECT claim_id FROM parent_claims WHERE auth.uid() IS NOT NULL;
$fn$;
REVOKE ALL ON FUNCTION public.partner_branch_authorized_claim_ids() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.partner_branch_authorized_claim_ids() TO authenticated,service_role;
COMMIT;