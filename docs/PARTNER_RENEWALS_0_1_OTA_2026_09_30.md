# Partner Renewals runtime 0.1.0 OTA — 2026-09-30

## Scope

The current Partner Renewals redesign already exists in `apps/partner-app/app/renewals.tsx`, but the installed Partner APK `0.1.0 (5)` consumes runtime `0.1.0` and therefore cannot receive the generic current-app runtime `0.2.0` OTA.

This change adds a runtime-0.1-safe compatibility mirror at `scripts/partner/compat/partner-renewals-reference-0-1.tsx` and extends the existing cumulative workflow `.github/workflows/publish-partner-0-1-claim-detail-reference.yml` to install that Renewals source into the approved `0.1.0` compatibility checkout before typecheck and EAS Update.

## Release contract

- Installed APK target: `0.1.0 (5)`
- OTA runtime: `0.1.0`
- Channel: `preview`
- Source baseline: approved compatibility commit `74039199991888777911deb30cf248e8f36cf8a8`, plus the cumulative accepted Partner compatibility overlays from current `main`
- Native APK/AAB build: **not authorized and not used**
- Generic runtime `0.2.0` Partner OTA workflow: **not used for this release**

## Renewal redesign preserved

The compatibility source mirrors the approved current Renewals screen including the Next 30 Days premium/policy summary, 0–7 / 8–15 / 16–30 / Overdue metrics, Upcoming/Overdue tabs, search/filter controls, Renewal Opportunities/Overdue Policies heading, Due Date sort surface, dense renewal rows, and redesigned empty state.

Existing renewal queries, policy/customer navigation, paging, refresh, cached-state handling, and authorization remain unchanged.

## Verification state

**IMPLEMENTED on branch `fix/partner-renewals-0-1-cumulative-ota`; PR/CI/merge/OTA/device verification pending.**

The cumulative workflow verifies that its compatibility checkout is Partner version/runtime `0.1.0`, runs `npx tsc --noEmit`, verifies the linked Partner EAS project, and only then publishes an EAS Update to `preview` with `--clear-cache`.

A successful OTA publish is not installed-device verification. The work should only be called device-verified after `0.1.0 (5)` is relaunched and the Renewals screen is visually confirmed.
