# Partner Policies compact reference layout — 2026-10-13

Status: implemented on separate branch; CI, PR, merge, OTA and device visual verification pending.

Scope: `apps/partner-app/app/(tabs)/policies.tsx`. Four light-blue policy KPI cards immediately below search, sourced from existing authorized `partner_app_policy_summary` RPC (total, active, expiring within 30 days, expired). Header intake button removed; full-width navy Policy Intake banner added below KPIs with original `/policy-intakes` destination. Filter tabs and policy navigation preserved. Record cards condensed with smaller gaps, icons and padding. Replaced previous-page/next-page UI with bottom Load More Policies button; increases the first-page limit by 10 and re-queries the existing scoped `partner_app_list_policies` RPC from offset zero, retaining search/filter, preventing duplicate rows from page concatenation. Button hidden after all matching rows load.

Reference includes month-over-month deltas but existing summary RPC does not supply prior-month counts: percentages deliberately omitted rather than fabricated. React Native native views do not provide an exact CSS gradient; current navy button and pale-blue summary card colors approximate the supplied screenshot. Visual comparison on device required.

No SQL, permission, APK/AAB, deployment or OTA publication. Test typecheck, lint, summary loading/error, scoped data, filters, Load More behavior and UI on a device before merge/publish.
