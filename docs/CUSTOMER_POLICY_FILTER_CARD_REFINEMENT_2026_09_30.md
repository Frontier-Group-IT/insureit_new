# Customer Policy Filter/Card Refinement — 2026-09-30

## Requested change
- Move the Customer app category filters `All | Motor | Non-Motor | Health | Life` immediately above the search box.
- Render those five filters as one joined segmented control rather than five separated cards.
- In Life/Health cards, replace the right-side `Policy No.` value with `Premium Amount`.
- Rename `PPT - Premium Payment Term` to `PPT - Premium Paying Term`.
- Ensure Payment Frequency shown in the Customer app reflects the value saved from the Life/Health policy editor.

## Root cause confirmed
The web Life/Health issued-policy editor reads and writes Payment Frequency from `life_health_cases.payment_frequency`. The Customer app policy list was reading Payment Frequency only from `life_health_policy_details.payment_frequency`. Older or partially synchronized policies can therefore show `-` in the Customer app even though the web editor correctly shows a saved frequency. The web editor also persists premium amount to `policies.premium_amount` and the Life/Health case.

## Implementation
- Customer Policies now reads `policies.premium_amount` for the Life/Health card.
- It also reads the latest converted `life_health_cases` record for each policy and uses its `payment_frequency`, `premium_paying_term`, and `policy_duration` as the canonical Life/Health display values, with the policy detail row as a fallback.
- The five category KPIs are one joined segmented control placed between the Find-your-policy header row and the search box.
- The Life/Health right summary now shows `Premium Amount` and `PPT - Premium Paying Term`.

## Safety boundary
- Customer app presentation/data-read refinement only.
- No RLS, auth, schema, migration, or write-path changes.
- No APK/AAB build is authorized.
- Production OTA must only be published through the established GitHub Actions release workflow after merge.
