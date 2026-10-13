# Partner Business reference-density implementation — 2026-10-13

## Scope and state
**IMPLEMENTED ON BRANCH. NOT MERGED, DEPLOYED, OTA-PUBLISHED OR DEVICE-VERIFIED.**

Branch: `ui/partner-business-reference-compact-20261013`.
- Compact native Business hero, search, KPI cards, trend chart, product mix, quick actions, and network areas toward the supplied single-screen reference.
- On shorter devices (<800 logical px) use additional height reduction for hero/chart and containers.
- Keep real live business figures, scope, actions, permissions and current bottom-tab navigation unchanged. No mock reference numbers.
- The Top Insurers section now renders a five-tile ranking from the independent `partner_app_top_insurers()` RPC, using the existing insurer logo component; it provides no-data and request-failure fallbacks.
- New migration `supabase/migrations/20261013124500_partner_app_top_insurers.sql` adds an isolated read-only security-definer RPC mirroring the current Partner commercial scope and effective-premium calculation, for MTD top insurers. Rollback: `supabase/rollbacks/20261013124500_partner_app_top_insurers.sql`. Existing `partner_app_business_performance()` stays unchanged. **MIGRATION NOT APPLIED TO PRODUCTION.**
- Device screenshot verification, UI interaction regression and CI pending. Do not create APK/AAB. Do not publish OTA without user instruction.
