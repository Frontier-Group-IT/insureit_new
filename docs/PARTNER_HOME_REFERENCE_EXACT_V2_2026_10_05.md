# Partner Home exact-reference refinement — 2026-10-05

## Scope

UI-only refinement of `apps/partner-app/app/(tabs)/index.tsx` to match the user-supplied second Home reference more closely. Existing Home hero/search, live business data, period selection, routes, counts, Stories, bottom navigation, authorization, runtime and backend behavior remain unchanged.

## Implemented visual changes

- This Month card keeps the approved compact layout but replaces the dark business-performance artwork with the bright blue reference-style bar-chart + upward-arrow treatment.
- Policies Sold and Commission Earned now use bright-blue reference-style vector icon tiles instead of the darker mixed asset treatment.
- Quick Actions now use one coordinated bright-blue illustrated/vector language matching the supplied reference: Policy Intake, Renewals, Claims and Customers each use a main blue glyph with a small semantic badge and soft cyan glow.
- Pending Tasks keeps its live claim count/route but replaces the dark decorative artwork with a pale blue clipboard/check illustration and uses a bright-blue task icon at left.
- Card radius, dividers, internal spacing and pale-blue surfaces were tuned to the supplied reference while preserving the accepted Home header/search/Stories/navigation geometry.

## Safety / runtime boundary

- JS/TS/UI only.
- No schema, database, RPC, RLS, permission or accounting change.
- No native dependency, Expo runtime, SDK, permission or package change.
- OTA-safe for Partner production runtime `0.2.0`.
- No APK/AAB/native build created or authorized.

## Evidence state

Branch: `ui/partner-home-reference-exact-v2-2026-10-05`

Implementation commit: `a83645f6cd9e6ca8c48072aa8bf3a80071608148`

**IMPLEMENTED on branch. PR, canonical CI, merge, production OTA and installed-device verification are pending.**
