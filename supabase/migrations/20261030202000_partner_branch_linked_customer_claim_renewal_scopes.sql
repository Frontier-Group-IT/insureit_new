-- Read-only canonical hierarchy scopes for linked customers, claims and renewals.
-- Identity is always derived from auth.uid() via partner_branch_authorized_policy_ids().
-- Policyless claims and unrelated customer records are deliberately excluded (fail closed).
BEGIN;
CREATE OR REPLACE FUNCTION public.partner_branch_authorized_customer_ids()
RETURNS TABLE(customer_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','auth'
AS $fn$
 SELECT DISTINCT p.customer_id
 FROM public.partner_branch_authorized_policy_ids() scope
 JOIN public.policies p ON p.id=scope.policy_id
 WHERE p.customer_id IS NOT NULL AND auth.uid() IS NOT NULL;
$fn$;

CREATE OR REPLACE FUNCTION public.partner_branch_authorized_claim_ids()
RETURNS TABLE(claim_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','auth'
AS $fn$
 SELECT DISTINCT c.id
 FROM public.partner_branch_authorized_policy_ids() scope
 JOIN public.claims c ON c.policy_id=scope.policy_id
 WHERE auth.uid() IS NOT NULL;
$fn$;

CREATE OR REPLACE FUNCTION public.partner_branch_authorized_renewal_policy_ids()
RETURNS TABLE(policy_id uuid, end_date date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','auth'
AS $fn$
 SELECT DISTINCT p.id,p.end_date::date
 FROM public.partner_branch_authorized_policy_ids() scope
 JOIN public.policies p ON p.id=scope.policy_id
 WHERE p.end_date IS NOT NULL AND auth.uid() IS NOT NULL;
$fn$;

REVOKE ALL ON FUNCTION public.partner_branch_authorized_customer_ids() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.partner_branch_authorized_claim_ids() FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.partner_branch_authorized_renewal_policy_ids() FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.partner_branch_authorized_customer_ids() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.partner_branch_authorized_claim_ids() TO authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.partner_branch_authorized_renewal_policy_ids() TO authenticated,service_role;
COMMIT;
