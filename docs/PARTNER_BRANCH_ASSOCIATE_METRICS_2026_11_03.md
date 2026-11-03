# Partner Branch & Associate Register — Customer Count / Net Premium

Date: 2026-11-03
Branch: `feat/partner-branch-associate-customer-net-premium-20261103`
Status: Implemented in separate GitHub branch. **No PR, merge, deployment, database migration, or production data mutation.**

## UI
- Partner application Branch Register: two read-only columns immediately after Phone Number and before Status: Customer Count and Net Premium. Mobile branch cards contain the same values.
- Partner application Associate Accounts Register: the same columns immediately before Status, after Role (and therefore between Phone and Status).
- Indian grouping for counts; INR currency formatting; verified zero is `0`; unresolved metrics show `—`.
- Other Branch Register views retain their existing columns and layout.

## Attribution rules
- Branch: `partner_branch_profiles.partner_id` -> `partner_branches.legacy_branch_profile_id`, constrained to the selected parent Partner -> canonical `partner_branch_policy_links.branch_id`. One policy UUID counted once. Customer Count is distinct `policies.customer_id` across linked policies (i.e. **customers with linked policies**, not all prospect leads).
- Associate: `partner_portal_associate_accounts.auth_user_id` -> `policy_intake_requests.submitted_by_profile_id`. Count distinct `matched_customer_id` and final-policy `customer_id`; sum net premium once per distinct `final_policy_id` (not all parent Partner business). Unmatched intake leads without an authoritative customer UUID are not counted.
- Both use `policy_premium_details.net_premium`, **never gross premium**, do not infer ownership from names or parent-only totals, and do not change historical ownership.
- Any missing/ambiguous canonical Branch mapping, failed query, missing policy lookup or missing premium produces `—` for the affected metric rather than a false zero. Server queries are restricted to the already-authorized Partner application page.

## Verification performed
- Read-only schema inspection confirmed verified canonical Branch policy links and separate net-premium rows, plus Associate-to-intake submitter relationships.
- Source-level assertions checked the mappings, field placement, formatting, pagination, deduplication and missing-data behavior.
- A regression script is committed at `apps/web-portal/scripts/partner-branch-associate-metrics-regression.mjs`.
- No automated GitHub Actions workflow was triggered by the feature-branch-only changes. Typecheck, lint, build, integration tests and authenticated browser checks remain pending before any future merge.

## Future check
Run `node apps/web-portal/scripts/partner-branch-associate-metrics-regression.mjs` and the repository's Verify web portal checks before merging. Test multiple branches, associates with zero intakes, missing customer links, duplicate intake references, net-premium parity and permission isolation. Do not claim all customers (including leads without a linked policy/customer UUID) are included.
