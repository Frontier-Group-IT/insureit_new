# Customer Policy Filter/Card Refinement — 2026-09-30

## Requested change
- Move the Customer app category filters `All | Motor | Non-Motor | Health | Life` immediately above the search box.
- Render those five filters as one joined segmented control rather than five separated cards.
- In Life/Health cards, replace the right-side `Policy No.` value with `Premium Amount`.
- Rename `PPT - Premium Payment Term` to `PPT - Premium Paying Term`.
- Ensure Payment Frequency shown in the Customer app reflects the value saved from the Life/Health policy editor.

## Root cause confirmed
Production inspection confirmed the reported issued Health policy already has the expected `Half Yearly`, `10 Years`, and `15 Years` values in `life_health_policy_details` as well as the corresponding Life/Health case. The display problem was access, not missing saved data: `life_health_policy_details` has RLS enabled but previously had no authenticated SELECT policy, so the Customer app could not read those display values even though the web editor had saved them correctly.

## Implementation
- Customer Policies reads `policies.premium_amount` for the Life/Health Premium Amount display.
- Life/Health PPT, policy duration, and Payment Frequency continue to use the issued-policy detail relation.
- A narrowly scoped RLS policy allows authenticated users to read a `life_health_policy_details` row only when the linked parent `policies` row is already visible under the existing policy RLS. `life_health_cases` remains private to customer sessions.
- The RLS policy is deployed and verified by `.github/workflows/apply-customer-life-health-policy-details-read.yml` using `supabase/release-sql/20260930_customer_life_health_policy_details_read.sql`.
- The five category KPIs are one joined segmented control placed between the Find-your-policy header row and the search box.
- The Life/Health right summary shows `Premium Amount` and `PPT - Premium Paying Term`.
- The Customer Life/Health regression was updated so CI enforces the new Premium Amount / Premium Paying Term contract.

## Safety boundary
- Existing `policies` RLS remains the authorization boundary for customer access.
- `life_health_cases` is not exposed.
- No auth or write-path changes.
- No APK/AAB build is authorized.
- Production Customer app publication must only use the established GitHub Actions OTA workflow after merge.

## Release state
- PR: #2629
- Branch: `ui/customer-policy-segment-premium-frequency`
- Merge only after mandatory Verify mobile app and Verify web portal workflows pass.
- On merge, the dedicated schema workflow applies/verifies the RLS read policy; Customer production OTA publication follows through the established production OTA workflow.
