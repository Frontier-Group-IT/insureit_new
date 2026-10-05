# Partner Claims List Refinement — 2026-10-05

## Scope
Partner Android app Claims tab only.

## Implemented
- Claims hero heading now matches the Business page typography (`20/23`, weight `800`).
- Claims loading/empty list surface now fills with white instead of exposing the blue screen background below short content.
- Claim record heading size increased.
- Claim-card left artwork now resolves the insurer logo through the existing Partner insurer catalog; unknown insurers fall back to the existing Claims artwork.
- Insurer company name text removed from the claim row.
- Internal/External badge is shown beside the claim number when `claim_service_mode` identifies the mode.
- Right-side chevron removed.
- `Amount not recorded` line removed.
- Claim status pill (for example Surveyor Appointed / Initial Documents Submitted) moved into the central record area.
- Claimed-on date retained on the right.

## Safety / scope boundaries
- No database, RPC, RLS, schema, backend or claim workflow changes.
- No native dependency/runtime changes.
- No APK/AAB build.
- Existing claim navigation, search, tabs, filters, pull-to-refresh, pagination and offline/cached banners remain in place.

## Status
IMPLEMENTED on `ui/partner-claims-row-refinement-2026-10-05`.
PR / merge / OTA publish / device verification: pending.
