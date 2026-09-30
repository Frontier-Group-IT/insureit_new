# Customer Policy Filter/Card Refinement — 2026-09-30

## Requested change
- Replace the Customer app's separate top category KPI strip `All | Motor | Non-Motor | Health | Life` with a compact dropdown built into the existing lower `All` filter control.
- Default closed state: `All (count) ▾`.
- Dropdown options: `All`, `Motor`, `Non-Motor`, `Health`, `Life`.
- Keep `Active | Renewal Due | Expired` as separate status pills immediately beside the category dropdown.
- Selecting a category resets the status view to `All` while preserving the existing search/category/status filtering logic.
- Previous Life/Health card refinements remain unchanged: Premium Amount, PPT - Premium Paying Term, Product Name, Payment Frequency, PD - Policy Duration, navy LIFE/HEALTH badge, and the protection strip.

## Prior root cause confirmed
Production inspection confirmed the reported issued Health policy already has the expected `Half Yearly`, `10 Years`, and `15 Years` values in `life_health_policy_details` as well as the corresponding Life/Health case. The display problem was access, not missing saved data: `life_health_policy_details` has RLS enabled but previously had no authenticated SELECT policy, so the Customer app could not read those display values even though the web editor had saved them correctly.

## Current implementation
- Removed the dedicated category KPI/segmented row above the search field.
- The lower `All` control is now a compact category dropdown trigger and displays the selected category plus its count, for example `All (6) ▾` or `Health (1) ▾`.
- The dropdown exposes exactly `All`, `Motor`, `Non-Motor`, `Health`, and `Life`, including category counts.
- Choosing a category updates `categoryFilter`, resets status filtering to `All`, and closes the menu.
- `Active`, `Renewal Due`, and `Expired` remain separate pills and their counts continue to respect the selected category.
- Search, policy cards, policy navigation, and Life/Health data rendering are unchanged.
- The Customer Life/Health regression now enforces the dropdown contract and prevents the old category KPI strip from returning.

## Existing Life/Health data contract
- Customer Policies reads `policies.premium_amount` for the Life/Health Premium Amount display.
- Life/Health PPT, policy duration, and Payment Frequency use the issued-policy detail relation.
- A narrowly scoped RLS policy allows authenticated users to read a `life_health_policy_details` row only when the linked parent `policies` row is already visible under the existing policy RLS. `life_health_cases` remains private to customer sessions.
- The RLS policy is deployed and verified by `.github/workflows/apply-customer-life-health-policy-details-read.yml` using `supabase/release-sql/20260930_customer_life_health_policy_details_read.sql`.

## Safety boundary
- Customer app JavaScript/React Native presentation/filter refinement only for this change.
- No schema, migration, RLS, auth, API/RPC, policy data, or write-path changes.
- Existing `policies` RLS remains the authorization boundary for customer access.
- No native dependency/config/runtime change.
- No APK/AAB build is authorized.
- Production Customer app publication must only use the established GitHub Actions OTA workflow after merge.

## Release state
- Branch: `ui/customer-policy-category-dropdown`
- **IMPLEMENTED; PR/CI/merge/OTA pending.**
- Merge only after mandatory Verify mobile app and Verify web portal workflows pass.
