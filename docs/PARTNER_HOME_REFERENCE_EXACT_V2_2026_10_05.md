# Partner Home exact-reference refinement — 2026-10-05

## Scope

UI-only refinement of `apps/partner-app/app/(tabs)/index.tsx` to match the user-supplied second Home reference more closely. Existing Home hero/search, live business data, period selection, routes, counts, Stories, bottom navigation, authorization, runtime and backend behavior remain unchanged.

## Implemented visual changes

- This Month card keeps the approved compact layout but replaces the dark business-performance artwork with the bright blue reference-style bar-chart + upward-arrow treatment.
- Policies Sold and Commission Earned now use bright-blue reference-style vector icon tiles instead of the darker mixed asset treatment.
- Quick Actions now use the **exact four icon artworks cropped from the user-supplied approved second reference image** for Policy Intake, Renewals, Claims and Customers. The crops are stored under `apps/partner-app/assets/partner/home-reference/` and exposed through the static Partner asset registry for Metro bundling.
- Pending Tasks keeps its live claim count/route but replaces the dark decorative artwork with a pale blue clipboard/check illustration and uses a bright-blue task icon at left.
- Card radius, dividers, internal spacing and pale-blue surfaces were tuned to the supplied reference while preserving the accepted Home header/search/Stories/navigation geometry.

## Safety / runtime boundary

- JS/TS/assets/UI only.
- No schema, database, RPC, RLS, permission or accounting change.
- No native dependency, Expo runtime, SDK, permission or package change.
- OTA-safe for Partner production runtime `0.2.0`.
- No APK/AAB/native build created or authorized.

## Evidence state

Branch: `ui/partner-home-reference-exact-v2-2026-10-05`

Primary UI commit: `a83645f6cd9e6ca8c48072aa8bf3a80071608148`

Exact-reference Quick Action assets were added and wired on the same branch after the primary UI commit.

**IMPLEMENTED on branch. PR, canonical CI, merge, production OTA and installed-device verification are pending.**
