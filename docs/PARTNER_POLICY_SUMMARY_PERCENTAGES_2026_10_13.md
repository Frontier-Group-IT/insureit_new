# Partner Policy summary portfolio percentages — 2026-10-13

Scope: `apps/partner-app/app/(tabs)/policies.tsx` only. Four cards below search now show a small percentage of the **total authorized partner policies**, using the existing `partner_app_policy_summary` RPC. The labels are explicitly `% of total` (not month-over-month growth). Total Policies = 100% when nonzero; Active/Expiring/Lapsed share the same total denominator. One decimal is shown for noninteger percentages. Zero denominator shows 0%; unavailable data shows an em dash, never a fabricated value.

No schema, auth, RLS, server, app runtime, APK/AAB, or OTA change. No merge or publication authorized in this PR. Verify with partner CI/typecheck and a mobile-device screenshot before deployment. Existing summary cache and authorization remain unchanged.
