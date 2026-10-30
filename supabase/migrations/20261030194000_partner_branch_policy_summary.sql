-- Read-only hierarchy business summary; count each authorized policy UUID exactly once.
-- Consumes authenticated policy scope; does not modify historical policies or finance.
BEGIN;
CREATE OR REPLACE FUNCTION public.partner_branch_policy_summary()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public','auth'
AS $fn$
 WITH scoped AS (
   SELECT DISTINCT policy_id FROM public.partner_branch_authorized_policy_ids()
 ), totals AS (
   SELECT count(*)::bigint AS policies,
          coalesce(sum(p.premium_amount),0)::numeric AS recorded_premium
   FROM scoped s JOIN public.policies p ON p.id=s.policy_id
 )
 SELECT CASE WHEN auth.uid() IS NULL THEN NULL
 ELSE jsonb_build_object('policies',policies,'recorded_premium',recorded_premium)
 END FROM totals;
$fn$;
REVOKE ALL ON FUNCTION public.partner_branch_policy_summary() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_branch_policy_summary() TO authenticated,service_role;
COMMIT;
