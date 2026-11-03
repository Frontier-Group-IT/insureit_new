# Vehicle RC complete optional details — 2026-11-03

## Scope
Expand Operations Add/Edit Vehicle with optional AuthBridge RC data fields and a saved, expandable snapshot of the RC display sections (up to the existing server limit of 160 fields). Reuse existing public.vehicles columns for RTO, category, body, color, emission, capacities, permit information. Add only missing owner, RC-insurance and snapshot columns through migration `20261103160000_vehicle_rc_optional_details.sql`.

## User validation contract
**Never add new mandatory fields.** Existing requirements stay unchanged: Customer, Manufacturer, Vehicle Class, Registration Number for registered vehicles, and Chassis + Engine for unregistered. All new fields optional; manual entries continue without RC lookup. No insurer/policy-register mutation from RC-reported insurance values.

## Files
- `apps/web-portal/components/forms.tsx` — additional optional sections and form fields
- `apps/web-portal/components/vehicle-registration-fields.tsx` — apply matching fields returned by lookup
- `apps/web-portal/components/vehicle-rc-snapshot.tsx` — retain/review the RC display snapshot
- `apps/web-portal/app/vehicles/vehicle-master-actions.ts` — store structured inputs and bounded snapshot
- `apps/web-portal/app/vehicles/[id]/edit/page.tsx` — load additional persisted data
- `supabase/migrations/20261103160000_vehicle_rc_optional_details.sql` — new nullable columns

## Deployment / verification
This branch must not be deployed or merged without explicit approval. Apply reviewed migration before deploying web code that selects the new columns. Test manual registered and unregistered create, Edit without fetch, API fetch + Apply + Save, reload and persistence, unmatched/missing API fields, invalid dates, registered vehicle ID/associations, restricted viewer permissions, and full web portal Verify CI. No APK/AAB.
