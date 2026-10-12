# Customer Home permanent Start New Claim — 2026-10-12

## Cause
PR #3093 used `openClaims.length` to choose *either* Start a claim or Track your claim within a single slot. Any existing open claim therefore hid the create-claim shortcut.

## Fix
The Customer Home "Your next steps" section now exposes two independent, persistent account-scoped links:
- **Start New Claim** always routes to `/customer/start-claim`.
- **Track Existing Claims** always routes to `/customer/claims`, with contextual progress count or history helper text.
The Insure a vehicle shortcut remains. Existing claim creation, auth/session, account scope, persistence, RLS and services are untouched.

## Testing / release
Added `scripts/customer-home-start-claim-regression.mjs` in Verify web portal CI. Verify with customers having zero and positive open claims, mobile layout and claim creation link before production release. No DB migration or APK/AAB. Reversible by reverting this PR. **Branch committed; CI/merge/deployment/runtime verification pending.**
