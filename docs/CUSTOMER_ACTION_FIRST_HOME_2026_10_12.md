# Customer Home action-first redesign — 2026-10-12

Branch: `ui/customer-action-first-home-20261012`.

## Scope
Replace redundant fleet summary + five KPI strip + oversized quick actions + duplicate support channel links with:
- Personalized navy Protection Hub hero showing covered/total and percent from the existing customer-scoped data, retaining the existing fleet illustration.
- Action Center with individual uncovered vehicle links (max three visible) and expiring policy links (max two visible), a clear zero-attention state and links to full registers.
- Two next-step cards for quote and claim actions. Claim card routes to existing claim register when there are open claims, otherwise to Start Claim.
- Compact Everyday Services tiles (Vehicles, Policies, Exchange, Quote, Challan).
- Small Claims Progress overview and a single honest Support link rather than mock Call/WhatsApp buttons.

## Data and access boundaries
Reuse `resolveCustomerWebScope`, `loadCustomerWebVehicles`, `loadCustomerWebPolicies`, and `loadCustomerClaimListContext` unchanged. Preserve existing customer account query scope and the existing completed-claim predicate. No new RPC, migration, RLS, write, elevated access, or mobile native change. Display values are dynamic, not screenshot fixture data.

## Verification / reversibility
Added `scripts/customer-action-first-home-regression.mjs` to Verify web portal GitHub Actions. The PR requires successful CI and real browser testing for desktop/mobile layouts, multi-account switching, policy/vehicle deep links, and zero/positive attention cases before a release is considered verified. Revert the PR to restore old Home UI; no database rollback. No automatic authorization to merge or deploy.
