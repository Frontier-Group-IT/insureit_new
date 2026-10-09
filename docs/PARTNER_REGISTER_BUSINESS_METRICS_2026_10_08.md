# Partner Register business metrics — 2026-10-08

Status: IMPLEMENTED IN BRANCH; UNVERIFIED. No migration applied, PR merged, or production deployed.

The Partner Register previously hardcoded Customers, Net Premium and Payout to null.
This change adds a service-role-only, read-only batched SQL function
`partner_register_business_metrics(uuid[])` and calls it once in the server-side
Intermediary Register loader. It uses the existing partner-family attribution:
partner intermediary via `partners.source_application_id`, and linked POSP/MISP
via `posp_misp_onboarding_profiles.partner_record_id`.

- Customers: distinct customers whose `lead_source_intermediary_id` belongs to family.
- Net Premium: sum of `policy_premium_details.net_premium` for family-code policies.
- Payout: sum of partner payout amount (where payout basis exists), otherwise gross payout,
  on family policies with matching payout intermediary code.
- Totals are all-time, not MTD. Zero is displayed for partners with no matching business.
- Missing partner-record attribution or RPC failures remain unavailable (dash), not false zero.
- Access: existing `requirePospMispManager` and accessible intermediary ID scope remain;
  RPC executable by service_role only, never directly by authenticated clients.
- Deployment order: apply reviewed SQL migration before releasing frontend. Verify
  counts against existing Partner customer, policy and payout views with real data.
- Risk: verify the historical intermediary code normalization and legacy records;
  no production data was queried or changed in this branch.
- No APK/AAB.

## 2026-10-09 branch follow-up

Normalized policy intermediary-code matching with `upper(btrim(...))`, consistent with payout-code matching, so historical capitalization and surrounding whitespace do not silently exclude attributable policies. The existing `distinct (partner_id, policy_id)` policy-family step still prevents multiple linked intermediaries with the same code from duplicating premium totals.

Evidence: committed SQL correction only; no production query, migration application, CI execution, runtime verification, or deployment has been performed. Before rollout, check representative partner totals and code collisions against production read-only records, confirm the RPC migration is applied, and run CI. Do not apply the migration or deploy without separate approval.
