# Partner Home reference redesign — 2026-10-14

## Branch and state
- Branch: `ui/partner-home-reference-preserve-icons-20261014`
- No PR, merge, OTA, APK or AAB authorized or created.
- Primary file: `apps/partner-app/app/(tabs)/index.tsx`

## Implemented
- Retained existing `PartnerScreen` blue hero banner, brand, search, greeting, and existing five-tab bottom navigation.
- Compact MTD business overview with the original Policies Sold and Commission Earned icon components, existing growth icon, and a small six-month bar trend from the **already-authorized** `partner_app_business_performance` RPC.
- Retained the four original Quick Action icons and their *existing working* action labels/routes (Policy Intake, Renewals, Claims, Customers). The reference's Quote and Calculator buttons were **not fabricated**, as corresponding verified routes/workflows do not exist in this Home implementation.
- Pending Tasks: three actual partner-scoped counts available in `partner_app_home`: renewals within 30 days, policy intakes requiring attention, and active claims. Each row navigates to its real list.
- Renewals Due Soon: existing 30-day expiry count and Renewals navigation.
- Recent Activity: first three entries from existing access-controlled `partner_app_activity`; names/timestamps/routes are taken directly from returned records, and unavailable data is labeled as such.
- Removed Home Story Rail, matching the reference (stories functionality is not deleted from the app).
- `getPartnerHome` stays mandatory; secondary activity and chart reads use Promise.allSettled so their outage does not blank the Home page.

## Deliberate data and design boundaries
- The existing headline remains **Net Premium**, not an unverified Motor-only metric; it is labeled `Business Generated (Net Premium)` to avoid claiming unsupported product filtering.
- Mini trend uses existing scoped premium monthly totals (not fabricated Motor-only series).
- Recent activity API has no monetary amount field in its current typed contract, so no made-up ₹ values are shown.
- Existing branded image/icons are unchanged in the asset catalog; additional activity/renewal/task rows reuse available assets. No shared header/tab component changed.
- Main quick actions continue to work; no placeholder buttons.

## Remaining verification
- Partner Expo TypeScript/lint/visual regression CI, installed Android small-screen visual comparison, mobile touch tests, and scoped record verification are not yet run in this branch.
- No production database schema, auth, RLS or write operations performed.
