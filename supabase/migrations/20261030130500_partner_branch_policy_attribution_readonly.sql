-- Phase 2 preparation: explicit canonical Branch attribution, with zero business-data mutation.
-- Read-only, service-only resolver ensures policy reports can migrate off legacy PT codes.
BEGIN;
CREATE OR REPLACE VIEW public.partner_branch_policy_attribution
WITH (security_invoker = true)
AS
SELECT p.id AS policy_id,
       p.intermediary_code AS historical_intermediary_code,
       b.id AS branch_id,
       b.branch_code,
       b.parent_partner_id,
       legacy.id AS legacy_partner_id,
       legacy.partner_code AS legacy_partner_code
FROM public.policies p
JOIN public.partners legacy ON legacy.partner_code = p.intermediary_code
JOIN public.partner_branch_profiles b ON b.partner_id = legacy.id;
REVOKE ALL ON public.partner_branch_policy_attribution FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.partner_branch_policy_attribution TO service_role;

-- Guard against ambiguity: fail migration if a legacy code maps to more than one Branch.
DO $$
BEGIN
  IF EXISTS (
    SELECT legacy.partner_code
    FROM public.partner_branch_profiles b
    JOIN public.partners legacy ON legacy.id=b.partner_id
    GROUP BY legacy.partner_code HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Ambiguous legacy Branch partner code; migration refused';
  END IF;
END $$;
COMMIT;
