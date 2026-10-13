# Partner Business reference-density implementation — 2026-10-13

## Scope and state
**IMPLEMENTED ON BRANCH. NOT MERGED, DEPLOYED, OTA-PUBLISHED OR DEVICE-VERIFIED.**

Branch: `ui/partner-business-reference-compact-20261013`.
- Compact native Business hero, search, KPI cards, trend chart, product mix, quick actions, and network areas toward the supplied single-screen reference.
- On shorter devices (<800 logical px) use additional height reduction for hero/chart and containers.
- Keep real live business figures, scope, actions, permissions and current bottom-tab navigation unchanged. No mock reference numbers.
- The Top Insurers section is currently a static placeholder in `apps/partner-app/app/(tabs)/business.tsx`; this remains a **known incomplete item**, not claimed fixed.
- Root data contract `partner_app_business_performance()` exposes `business_mix` and `trend`, but not insurer ranking. A separate scoped, safe database/RPC change and frontend rendering are required for real insurer logos/rankings. Do not synthesize rankings from product mix.
- Device screenshot verification, UI interaction regression and CI pending. Do not create APK/AAB. Do not publish OTA without user instruction.
