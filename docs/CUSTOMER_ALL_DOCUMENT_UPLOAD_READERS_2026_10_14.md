# Customer App — comprehensive document upload local reader audit (2026-10-14)

## Incident
Android Customer app previously showed a local-file-read error in Claim Intimation. PR #3136 switched selected surfaces from `fetch(file.uri)` to `expo-file-system` `File.bytes()`, and the production Expo OTA was published. User subsequently reproduced the same error on the **Work Approval** step, because not all upload paths were migrated.

## Audit findings and changes
The Customer Expo app includes document upload on:
- Claim Intimation (single and bulk) — already fixed in PR #3136
- Claim stage action documents including **Work Approval**, Estimate/approval documents and related internal managed claim steps — **now fixed** (`components/internal-claim-stage-one.tsx`)
- Spot Intimation / claim stage tracker — **now fixed** (`components/internal-claim-stage-one-tracker.tsx`)
- Self-managed claim stage documents including stage uploads — **now fixed** (`app/customer/self-managed-claim.tsx`)
- Self-managed claim documents and customer claim document vault — already fixed in PR #3136
- Customer policy onboarding policy copy — **now fixed** (`app/customer/add-policy.tsx`)
- Customer onboarding corporate KYC — **now fixed** (`app/customer/kyc/corporate.tsx`)
- Customer onboarding dealership KYC — **now fixed** (`app/customer/kyc/dealership.tsx`)
- Individual KYC — already uses `prepareCustomerDocument` and `readPreparedCustomerDocument` (`File.bytes()`); intentionally unchanged
- Customer profile photo and uploaded profile documents — **now fixed** (`app/customer/profile.tsx`)

All affected reader sites use the existing `readClaimDocumentBytes()` helper, native Expo `File.bytes()`, and return an `ArrayBuffer` suitable for Supabase Storage. No schema, RLS, bucket policies, native dependencies or stored records modified.

## Regression and verification
`node apps/mobile-app/scripts/customer-all-upload-readers-regression.mjs` checks all 10 affected entry points and the KYC exception. Included in mobile GitHub CI.

Remaining: Android physical-device test across Work Approval, Claim Intimation, Spot Intimation, Self-managed, policy copy, KYC, profile photo/document; then verify Storage authorization and metadata insertion. The actual native Android error was not captured; this source-level correction resolves the known unreliable local-file-read pattern but cannot by itself guarantee end-to-end upload.

## Release
Branch only until CI and explicit merge request. Merging to main triggers Customer production Expo OTA automatically. **Do not build APK or AAB.**
