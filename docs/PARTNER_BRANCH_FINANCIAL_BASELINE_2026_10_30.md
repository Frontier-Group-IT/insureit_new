# Partner/Branch Reconciliation — 2026-10-30

## Verified live baseline (read-only)
Project: `ilzhsfqqjyppzzvfscmh`.
- Policies: **1,628**
- Total `policies.premium_amount`: **₹1,22,41,380.48** (gross field total, not net premium)
- Legacy Branch-coded policies: **12**
- `partners` records: **93**
- `partner_branch_profiles`: **9**
- `partner_payables`: **0**
- `partner_payment_allocations`: **0**

These are snapshots, not a claim that all finance tables are empty. Reconciliation must include policy payouts, commissions, settlements and other finance sources before rollout.

## SQL verification (read-only, run before AND after each production migration)
```sql
SELECT count(*) policy_count,coalesce(sum(premium_amount),0) gross_premium_sum
FROM public.policies;
SELECT count(*) partner_count FROM public.partners;
SELECT count(*) branch_count FROM public.partner_branch_profiles;
SELECT count(*) payable_count FROM public.partner_payables;
SELECT count(*) allocation_count FROM public.partner_payment_allocations;
SELECT b.id, b.branch_name, p.partner_code legacy_branch_partner_code,
       p.parent_partner_id, parent.partner_code parent_partner_code,
       count(pol.id) policy_count,
       coalesce(sum(pol.premium_amount),0) premium_sum
FROM public.partner_branch_profiles b
JOIN public.partners p ON p.id=b.partner_id
JOIN public.partners parent ON parent.id=p.parent_partner_id
LEFT JOIN public.policies pol ON pol.intermediary_code=p.partner_code
GROUP BY b.id,b.branch_name,p.partner_code,p.parent_partner_id,parent.partner_code
ORDER BY p.partner_code;
```

## Mandatory cutover barriers
1. There is no working canonical-Branch onboarding cutover yet; active action still uses `service_create_partner_branch_profile` and `next_partner_code()`.
2. Live authorization and partner dashboards still consume legacy partner IDs. New `BR` branches would have no equivalent policy scope unless full RPC and UI onboarding change is deployed atomically.
3. Never expose parent-scope policy records in Branch login. Branch can only access records attributed to its **own** branch UUID/legacy code. Direct URL, RPC and report checks are required.
4. Parent Partner sees the union of its own and child Branch policy IDs using DISTINCT policy UUIDs; never sum already aggregated totals.
5. Existing logins remain untouched until canonical service-side scope and portal identity switch is ready.
6. For finance reconciliation also compare all pay-in/payout/commission tables and their ledgers, not only `partner_payables`.
7. This PR is **NOT approved for production** until real role-based isolation tests and all six preservation gates pass.
