# Work Approval upload error investigation — 2026-10-14

## Evidence
After broad customer native file reading fixes and production OTA, user reports Work Approval image upload: “image could not be uploaded, please try again.”

The managed claim upload path in `apps/mobile-app/components/internal-claim-stage-one.tsx` swallows an exception in the outer catch and reports the generic message. It can be thrown by storage transport, metadata insert, cleanup or other operations. The local file read already uses Expo FileSystem; therefore the new message alone cannot prove local file-read regression.

A read-only query of production Supabase project `ilzhsfqqjyppzzvfscmh` verified the claim-documents storage bucket's INSERT policies include customer/hierarchy access and claim_documents metadata INSERT policies. **This does not prove the affected logged-in customer's JWT passes RLS** and the policies must not be broadened speculatively.

## Change in branch
- Preserve the final Storage API error after retries; display a safe, categorized message for authorization, unsupported MIME/size, retryable network and general Storage rejection.
- Categorize outer exception as Storage versus metadata based on whether the object was committed.
- Best-effort cleanup cannot hide initial failure.
- Add regression assertions for stage-specific failure handling.

## Outstanding
Need actual device diagnostics/error category and account context to prove the cause and confirm successful uploads. No RLS/database changes, no merge, OTA, APK or AAB in this branch. Run mobile CI and device tests before merging.
