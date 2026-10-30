-- Canonical hierarchy release gate: read only, no credential impersonation.
-- Run in a consistent database snapshot. A PASS here does not certify browser JWT
-- isolation, complete financial before/after parity, or canonical-only onboarding.
WITH branch_errors AS (
 SELECT count(*) AS n FROM public.partner_branch_profiles legacy
 LEFT JOIN public.partner_branches b ON b.legacy_branch_profile_id=legacy.id
 WHERE b.id IS NULL OR b.parent_partner_id IS DISTINCT FROM legacy.parent_partner_id
), policy_errors AS (
 SELECT count(*) AS n FROM public.partner_branch_policy_links l
 JOIN public.policies p ON p.id=l.policy_id
 JOIN public.partner_branches b ON b.id=l.branch_id
 WHERE l.parent_partner_id IS DISTINCT FROM b.parent_partner_id
    OR l.legacy_intermediary_code IS DISTINCT FROM p.intermediary_code
), missing_policy_links AS (
 SELECT count(*) AS n FROM public.policies p
 JOIN public.partners legacy ON legacy.partner_code=p.intermediary_code
 JOIN public.partner_branch_profiles bp ON bp.partner_id=legacy.id
 LEFT JOIN public.partner_branch_policy_links l ON l.policy_id=p.id
 WHERE l.policy_id IS NULL
), invalid_claim_owners AS (
 SELECT count(*) AS n FROM public.partner_branch_policyless_claim_ownership own
 JOIN public.partner_branches b ON b.id=own.branch_id
 JOIN public.claims c ON c.id=own.claim_id
 WHERE b.parent_partner_id IS DISTINCT FROM own.parent_partner_id OR c.policy_id IS NOT NULL
)
SELECT now() AS snapshot_at,
 (SELECT n FROM branch_errors) branch_errors,
 (SELECT n FROM policy_errors) policy_errors,
 (SELECT n FROM missing_policy_links) missing_policy_links,
 (SELECT n FROM invalid_claim_owners) invalid_claim_owners,
 (SELECT count(*) FROM public.partner_branch_login_links) canonical_only_login_links,
 (SELECT count(*) FROM public.partner_branch_policyless_claim_ownership) assigned_policyless_claims,
 (SELECT count(*) FROM public.claims WHERE policy_id IS NULL) total_policyless_claims,
 (SELECT count(*) FROM public.policies) policies,
 (SELECT coalesce(sum(premium_amount),0) FROM public.policies) premium,
 (SELECT count(*) FROM public.policy_intermediary_payouts) payout_rows,
 (SELECT coalesce(sum(gross_payout),0) FROM public.policy_intermediary_payouts) gross_payout,
 (SELECT count(*) FROM public.policy_payin_bills) payin_rows,
 (SELECT coalesce(sum(billed_amount),0) FROM public.policy_payin_bills) billed_amount,
 (SELECT count(*) FROM public.policy_payin_details) payin_detail_rows,
 (SELECT coalesce(sum(projected_commission_amount),0) FROM public.policy_payin_details) projected_commission,
 (SELECT count(*) FROM public.intermediary_commission_ledger) commission_ledger_rows,
 (SELECT count(*) FROM public.partner_payables) payables_rows,
 (SELECT count(*) FROM public.partner_payment_allocations) payment_allocation_rows,
 CASE WHEN (SELECT n FROM branch_errors)=0
   AND (SELECT n FROM policy_errors)=0
   AND (SELECT n FROM missing_policy_links)=0
   AND (SELECT n FROM invalid_claim_owners)=0
 THEN 'MAPPING_INTEGRITY_PASS' ELSE 'MAPPING_INTEGRITY_FAIL' END AS mapping_result;
