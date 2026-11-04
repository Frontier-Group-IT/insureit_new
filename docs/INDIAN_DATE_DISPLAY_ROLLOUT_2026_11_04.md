# INSUREIT — DD/MM/YYYY date display rollout
Date: 2026-11-04
Branch: `feat/unified-indian-date-display-web-mobile-20261104`

## User requirement
Across Operations, Partner and Customer web portals, and the Customer/Partner Android and iOS apps, show human-facing dates as DD/MM/YYYY, and date/time as DD/MM/YYYY, hh:mm AM/PM. Preserve ISO database/API fields, date calculations, native calendar behavior, timezone semantics, permissions and existing data. Do not touch technical timestamps or original source documents.

## Implemented in this branch
- Web shared `lib/indian-date.ts`: added timezone-explicit `formatIndianDateTime` for timestamp display.
- Web shared `IndianDateField`: overlay DD/MM/YYYY label over native ISO date field.
- Operations nine-stage Claim Journey `operations-claim-stages.tsx`: all structured date fields use the custom DD/MM/YYYY display with native date inputs retaining ISO submission. Stage 1 date/time groups updated.
- Operations Claim Intimation final-documents workspace: Claim Intimation Date and Gate-in Date render DD/MM/YYYY.
- Customer Portal Spot Intimation: Accident Date and Spot Intimation Date use new `CustomerDateInput` with native ISO form values.
- Reports shared date-range picker: human-facing range dates now DD/MM/YYYY, query-string filter dates remain YYYY-MM-DD.
- Customer mobile app: added `lib/indian-date.ts` with `formatAppDate`, `formatAppDateTime`, `parseAppDate`; converted Claims, Renewals, Policies, Claim Detail, Vehicle Detail, Vehicles, Start Claim, Support, Service Enquiry Detail and self-managed claim timeline display helpers.
- Partner mobile app: equivalent date helper; shared PartnerDatePicker, Policies list/details, claim detail dates, and Spot Intimation manual date entry/pickers updated. Spot Intimation still submits ISO dates.
- Added `apps/web-portal/scripts/indian-date-ecosystem-regression.mjs` and Verify web portal CI integration.

## Not yet fully migrated
This is a **first rollout**, not a claim that every independent date control or date label in the whole repository is complete. Other independent web forms, registers, exports, deep mobile screens and third-party components require a full inventory and per-feature validation. Date widgets provided by iOS/Android themselves may render according to device locale; the INSUREIT field label can remain DD/MM/YYYY.
Do not globally rewrite raw date strings, ISO APIs, exported machine-readable columns, RLS rules, or arbitrary text. Verify ISO date-only values on UTC/local boundary cases and timestamp interpretation for Asia/Kolkata separately.

## Release gates / pending validation
1. Run `Verify web portal`, `Verify mobile app`, and `Verify Partner app` on this exact branch head. Workflows are `workflow_dispatch` capable. Run no APK/AAB/IPA workflows.
2. Confirm regression test, TypeScript, lint, and web/Expo review builds pass. Run authenticated visual/date edit tests on each portal and both native platforms.
3. Check leap days, invalid 31st dates, blank/required fields, date-only timezone preservation, historical edit saves, policy expiry calculations, report filters and calendar pickers.
4. Finish the remaining surface inventory before claiming full ecosystem parity. Do not merge or deploy without explicit approval.
