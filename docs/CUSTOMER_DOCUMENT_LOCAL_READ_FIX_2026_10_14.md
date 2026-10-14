# Customer Claim Document Local Read Fix — 2026-10-14

## User evidence
After customer production OTA from PR #3134, selecting a JPG in Claim Intimation returns: `img-XYZ.jpg could not be read from this device. Please download it locally and try again.`

## Diagnosis (source grounded)
This exact message is shown when the Claim Intimation screen fails to execute `fetch(file.uri).arrayBuffer()`. The client has not yet attempted Supabase Storage upload at that point. Existing Customer KYC already reads picker-cache documents through the installed native `expo-file-system` `File.bytes()` API. The local fetch shim attempts to bridge picker file URIs with XHR, which can fail on React Native Android. Actual per-device exception has not been captured, so the precise native error remains unconfirmed.

## Implementation
- Add `readClaimDocumentBytes(uri)` in `lib/claim-document-upload.ts` using `new File(uri)` with existence check and `await file.bytes()`; return a true ArrayBuffer to Supabase.
- Replace `fetch(file.uri)` in Claim Intimation single and multi uploads, self-managed claim documents, and customer document vault.
- Enhance existing `customer-document-upload-regression.mjs` to guarantee native file reading is used and picker-URI fetch is not reintroduced.

## Verification and release
Run `node apps/mobile-app/scripts/customer-document-upload-regression.mjs`, then full mobile CI. Physical Android upload of a gallery JPG, camera JPG and PDF is still necessary to confirm end-to-end success; local-read fix does not prove Storage policy acceptance. No SQL, schema, permissions, native dependency changes, APK/AAB, merge or OTA in this branch. Expo FileSystem 19.0.23 is already on the 0.3.0 native baseline.

## Rollback
Revert PR if necessary. No database migration.
