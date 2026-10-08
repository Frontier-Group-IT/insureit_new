# Customer Web compact Operations-style layout — 2026-10-08

Branch: `ui/customer-compact-tables-operations-journey-2026-10-08`.

## Implemented on branch
- Customer Policies and Vehicles registers converted from large cards to compact tables. Search/filter and ownership-scoped loaders unchanged. Horizontal scroll on narrow screens.
- Policy and Vehicle detail key/value fields converted to compact label/value rows.
- Claim Overview and individual nine-stage details reuse a single horizontal `CustomerClaimStageStrip`, matching the Operations concept: nine evenly spaced stages, active highlight, complete markers and future-stage locks, with narrow-screen horizontal scrolling.
- Home fleet hero, five KPIs, quick actions, claims and support sections have reduced vertical spacing; all existing counts and links preserved.
- Customer-only UI changes, no schema, Supabase RLS, mutation logic or Partner/Operations UI modifications.

## Evidence state
Implemented on branch; CI pending; merge not done; Cloudflare runtime not verified. No APK/AAB.

## Review points
Check responsive table scroll and text wrapping; visual comparison to Operations reference screenshot; customer session on live/Preview; accessibility keyboard and stage navigation; GitHub Verify web portal regression/typecheck/lint/build before merge.
