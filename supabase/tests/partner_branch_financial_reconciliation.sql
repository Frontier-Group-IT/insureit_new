-- READ-ONLY hierarchy financial reconciliation. Run against a stable database snapshot
-- before and after each rollout stage; compare all amount totals and policy UUID sets.
WITH baseline AS (
 SELECT
 (SELECT count(*) FROM public.policies) policy_count,
 (SELECT coalesce(sum(premium_amount),0) FROM public.policies) policy_premium_amount,
 (SELECT count(*) FROM public.policy_intermediary_payouts) payout_count,
 (SELECT coalesce(sum(gross_payout),0) FROM public.policy_intermediary_payouts) payout_amount,
 (SELECT count(*) FROM public.policy_payin_bills) payin_bill_count,
 (SELECT coalesce(sum(billed_amount),0) FROM public.policy_payin_bills) billed_amount,
 (SELECT count(*) FROM public.policy_payin_details) payin_detail_count,
 (SELECT coalesce(sum(projected_commission_amount),0) FROM public.policy_payin_details) projected_commission,
 (SELECT count(*) FROM public.intermediary_commission_ledger) ledger_count,
 (SELECT coalesce(sum(net_payable),0) FROM public.intermediary_commission_ledger) ledger_net_payable,
 (SELECT count(*) FROM public.partners) partner_count,
 (SELECT count(*) FROM public.partner_branches) canonical_branch_count
), attribution AS (
 SELECT count(*) mapped_policy_count,count(DISTINCT policy_id) distinct_mapped_policies
 FROM public.partner_branch_policy_links
), mismatch AS (
 SELECT count(*) mismatched_parent_count FROM public.partner_branch_policy_links l
 JOIN public.partner_branches b ON b.id=l.branch_id
 WHERE b.parent_partner_id IS DISTINCT FROM l.parent_partner_id
)
SELECT * FROM baseline CROSS JOIN attribution CROSS JOIN mismatch;
-- Rule: mapped_policy_count = distinct_mapped_policies AND mismatched_parent_count = 0.
-- Do not attribute changing business totals to a migration without transaction-level
-- evidence. Compare a frozen snapshot or recorded policy IDs to distinguish live writes.
