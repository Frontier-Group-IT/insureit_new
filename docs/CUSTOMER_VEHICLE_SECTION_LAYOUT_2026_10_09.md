# Customer Vehicle Sections Redesign — 2026-10-09

Branch: `ui/customer-vehicle-onboarding-sections-2026-10-09`. PR #3013.

## Scope
Customer Portal only. Uses user reference image of Operations Vehicle Onboarding as visual specification. **No changes to Operations or Partner code/functionality**.

## Changed
- `/customer/add-vehicle`: full-width compact Vehicle Onboarding header, 3-section navigation strip, Vehicle Ownership / Vehicle Specification / Compliance & Permit field groups, compact 5-column layout on desktop, compact Save Vehicle action. Existing customer-owned `create_customer_vehicle_v2` RPC and authenticated RC lookup retained.
- `/customer/vehicles/[id]`: detail view follows identical 3-section visual structure, with read-only fields and a compact linked insurance history table. Existing account-scoped detail query preserved.
- Customer account name is shown using `customer_name` / `contact_name` from the actual session type.

## Boundaries
- This is a Customer-only presentation change; no Operations pages, migrations, auth/RLS changes, or mobile build.
- Reference shows Registered/Unregistered toggle, but Customer Web's existing registered-only server action remains unchanged; do NOT introduce an inert toggle that incorrectly promises unregistered creation.
- Reference includes class-specific fields; Customer Web retains all its currently supported capacity fields without inventing new persistence contracts.
- Full visual parity and live RC lookup/save flows require authorized runtime testing.

## Release
Draft PR #3013; do not merge or deploy before checks and user's explicit approval. No APK/AAB.
