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

## Continuation: four scoped summary tabs (2026-10-26)
- Added reusable `PartnerReportTabs` navigation.
- `/partner/reports/business` uses `partner_app_business_performance`-backed service for month-over-month totals, trend and business mix.
- `/partner/reports/portfolio` uses `partner_app_policy_summary`-backed service for policy lifecycle and motor summary.
- `/partner/reports/operations` uses account-scoped claim and renewal summary services.
- Overview now shows all four tabs. All pages validate `requirePartnerReportScope()` before invoking their authenticated RPC-backed data services.
- This completes first-pass navigation and high-level reporting UI, NOT legacy Operations report parity.
- No ad-hoc unrestricted report RPC, service-role loader, export, database migration or user-supplied intermediary filters added.

### Immediate QA blockers
- Run TypeScript build, lint and role-level browser verification for Group, Group Associate, Partner, Partner Associate and Branch. Connector-side source inspection does not prove any of those passed.
- Confirm production RPC contracts and Group Associate / Branch scope. Adjust the guard if their real payload differs without loosening the access boundary.
- Verify that every source RPC correctly enforces the current authentication scope. Treat joins via shared customer ID as insufficient for policy isolation.
- Confirm all operations financial visibility, including payouts, against current payout privilege RPC; do not add Pay-in to partner views merely because Reports exists.
- Implement scoped detailed reporting RPCs and complete reference styling before calling this production-ready.

## Security regression continuation
- Added `apps/web-portal/scripts/partner-hierarchy-reports-regression.mjs`, runnable using `npm run partner-reports:security-regression` from `apps/web-portal`.
- Static assertions cover five role scope invariants, authenticated scoping on all four report pages, absence of privileged Operations report loaders, no user-supplied hierarchy IDs, navigation, and payout permission gating.
- Fixed payout discriminated-union rendering condition to narrow within the authorized JSX branch.
- **These static assertions have not been executed in CI yet, and cannot replace five-role authenticated integration tests.**

## Next iteration: scoped snapshots
- CI on commit `e390763` passed the Partner reporting security regression; full verification failed at unrelated Customer Home Start Claim stage-editing assertion.
- Added `/partner/reports/export?type=policies|claims` as read-only account-scoped CSV snapshots. Both use existing authenticated Partner RPCs, limit output to first 200 rows, neutralize spreadsheet-formula prefixes and set `Cache-Control: private, no-store`.
- Added UI links from Portfolio/Operations and new export assertions to the regression script.
- These are first-page snapshots, **not complete exports**; future full exports require bounded pagination, explicit completeness reporting and runtime access verification.
- New CI not yet verified. Do not merge until tests and five-role authenticated isolation checks pass.

## Continuation — server-side register pagination
- Portfolio and Operations previews now accept only 1–4 digit positive page numbers and request 21 records for 20 displayed rows, using scoped Partner list RPC offsets.
- Prev/Next controls are shown based on the bounded response; never use a caller-supplied partner/group ID.
- Updated regression assertions for page validation, bounded RPC calls, and 20-row rendering.
- Prior CI run passed Reports regression and failed at unrelated Customer Home self-managed-stage regression; latest pagination CI not yet confirmed.

## CI pagination regression correction
- The first CI run after pagination failed in the Reports security script because it broadly rejected any `searchParams`, including the safely validated `page` parameter. Updated that check to forbid only caller-controlled hierarchy identifiers (`partner`, `group`, `branch`) while allowing pagination. Actual report queries still take their scope from authenticated Partner RPCs.
- New CI result and all five authenticated role tests remain to be verified. No release authorization implied.

## PR #3583 continuation — shared reports presentation and restricted financial scope

- Unified partner Reporting shell and tabs with existing employee Reports CSS styling, while retaining Partner RPC-backed datasets.
- Business Trend uses the employee chart component with authenticated scoped premium and policy-count series.
- Business KPI period selector (MTD / last month / last six months / one year) uses authenticated `partner_app_business_range` through `getPartnerWebBusinessRange`; existing six-month trend and mix are explicitly labelled and not falsely re-filtered.
- Portfolio has an account-scoped Motor/other policy distribution; Operations has an account-scoped claims status distribution.
- Group and Branch views do not invoke the payout summary RPC; Partner/Partner Associate render payout only when the existing authorized payout contract says it is available.
- No intermediary view receives new pay-in, retention percentage, retention amount, or internal profitability/margin fields; regression assertions prohibit these names in intermediary report pages.
- No unrestricted Operations admin report loaders, service-role read paths, arbitrary partner/group/branch query scope, or database migration introduced.

### Remaining blockers before calling full parity finished
- Employee reports have additional detailed register/filter/insurer-exposure data not yet supplied by scoped intermediary RPC contracts. Add those contracts using authenticated row-filtering before aggregation and prior to rendering or exporting.
- Role-level integration tests must be performed for Group, Group Associate, Partner, Partner Associate and Branch, including cross-account denial and financial negative-access checks.
- Latest GitHub CI must pass on the final head commit before merging; actual production visuals must be inspected with role-specific accounts.
- PR remains unmerged and undeployed. Do not create APK/AAB.
