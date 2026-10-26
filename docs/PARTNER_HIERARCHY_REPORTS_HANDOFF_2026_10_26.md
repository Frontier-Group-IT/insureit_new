# Partner Hierarchy Reports — Implementation Handoff (2026-10-26)

## Delivered on draft PR #3552
- Authenticated Partner Portal route `/partner/reports`, read-only overview.
- Reuse existing account-scoped Partner RPCs for premium, policy, renewal, claims and restricted payout summaries.
- Sidebar Reports navigation.
- `lib/reports/partner-report-scope.ts` fail-closed reporting-role gate for Group, Group Associate, Partner, Partner Associate and Branch.
- The gate does not grant group-wide access merely because a Partner is affiliated with a group.

## Verified source relationships
- `partner_portal_access_context()`: signed-in Group/Branch mapping and scoped Partner IDs from `portal_access_identities`.
- `group_associate_active_group_id()`: signed-in Group Associate's active Group.
- `partner_app_current_identity()`: includes Group Associates via the wrapper in migration `20261015080033_group_associate_accounts.sql`.
- `partner_app_commercial_scope()`: returns portal access type/entity, partner IDs, intermediary IDs and group IDs; the Partner fallback is `partner_family`.
- Partner Associate identity uses an associate source and the assigned Partner identity.

## Not finished — DO NOT DEPLOY / MERGE as full Reports parity
1. Validate active production schema and exact runtime RPC output for all five role classes. Repo migrations are not proof all functions were applied.
2. Validate Group Associate and Branch logins using representative test accounts. Any mismatch should fail closed and be corrected before rollout.
3. Current overview is NOT Operations Reports visual/functionality parity. Implement Overview, Business, Portfolio and Operations within Partner Portal using scoped reporting contracts.
4. Never call `createSupabaseAdminClient()` Operations report loaders on intermediary routes without row-level source filtering. `group_ids` are affiliation data, not permission to read peer Partners.
5. Scope each register, aggregate, date selector, drilldown and export **before aggregation**, from immutable policy/claim ownership and historic membership rules.
6. Financial visibility remains separately authorized; no pay-in, pay-out or rate expansion by Reports alone.
7. Verify branch-specific eligibility and cross-group/partner denial, and prevent query-string ID injection.
8. Run typecheck, lint, relevant tests, and authenticated browser checks. None have been confirmed yet.
9. Do not apply production migrations, merge, deploy, or build APK/AAB without user authorization.

## Data contract caution
- Partner/Group/Branch access is resolved via the authenticated user's RPCs.
- Group Associate has `account_subtype=group_associate` and Group portal type.
- If scope lists are missing/malformed, reporting is blocked. Empty partner lists are not reinterpreted as all partners.
- Existing operation reporting pages under `/reports` must remain untouched.
