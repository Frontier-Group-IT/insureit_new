# Partner Home Reference Redesign — 2026-10-01

## Status
IMPLEMENTED on branch `ui/partner-home-reference-redesign-2026-10-01`.

## Scope
Partner App Home screen UI only. No schema, RLS, permissions, backend contract, runtime version, or native dependency changes.

## Implemented layout
- Compact branded Home hero with official INSUREIT Partner logo, activity shortcut, profile badge, full-name greeting, and overlapping search.
- Removed the Home role/update metadata row.
- Moved business summary directly below search and restyled it to the supplied reference.
- Business summary now shows Net Premium, comparison trend, Policies Sold, Commission Earned, a compact growth visual, period selector, and View Report.
- Quick Actions restyled as compact tiles for Policy Intake, Renewals, Claims, and Customers.
- Replaced the old `For you` presentation with a light-blue `Pending Tasks` card driven by live active-claim data.
- Removed the old `Your impact` Home block from the Home flow.
- Existing INSUREIT Stories rail remains live and is placed below Pending Tasks.
- Existing routes, refresh behavior, cached/offline warning, and live business/service data are preserved.

## Release boundaries
- No APK/AAB build.
- OTA-safe JavaScript/TypeScript UI change for the current Partner runtime.
- Not merged and not production-published at the time of this handoff.
