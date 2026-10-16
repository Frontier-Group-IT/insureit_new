# Firebase Customer OTP migration — handoff, 16 October 2026

## Objective and references
Replace 2Factor OTP with Firebase Phone Auth for Customers, preserving existing Supabase Auth UUID, session refresh, RLS, policies and vehicles. Repo Frontier-Group-IT/insureit_new. Follow AGENTS.md, docs/CUSTOMER_FIREBASE_OTP_RELEASE_GATES_2026_10_14.md and docs/CUSTOMER_FIREBASE_MIGRATION_ENGINEERING_2026_10_16.md. PR #3132 contains initial session bridge; draft PR #3199 on branch fix/firebase-migration-session-diagnostics-20261016 is stacked on that work, not main.

## Production boundaries
Supabase project ilzhsfqqjyppzzvfscmh. Firebase project insureit-customer-auth. Edge customer-firebase-session-bridge v4 ACTIVE as verified from Supabase read-back; v4 includes the corrected new Uint8Array(32) secure random password generator (64 hex characters). No global cutover, main merge, APK/AAB, OTA, or 2Factor removal.
Owner approved only two disposable Customer test accounts: suffix 1634 (approved UID link) and 1014 (no approved UID link). Each phone is also associated with an independent staff identity. Never use a phone number alone to select an Auth UUID. Staff accounts are excluded. Customer 1634 had an authorized same-UUID Auth email alias and random password provisioned on the latest v4 test.

## Verified incident chronology, UTC
- Initial Edge v1 failed 503, with disabled guard as leading cause.
- v2 had sign-in event consumed before provisioning, making failed provisioning retries reject 429.
- v3 reordered event consumption after alias provisioning.
- 12:02:53: Customer 1634 Admin update failed 400; GoTrue log explicitly said password cannot be longer than 72 characters. Earlier generator made 96 hex characters.
- GitHub commit fea66d00 corrected generator to 64 hex characters. Deployed manually through connected Supabase tool as v4; verified corrected source is live.
- 12:53:35–12:53:37: on real Android attempt, Customer 1634 exact UUID Admin GET HTTP 200; Admin PUT HTTP 200 (alias and confirmed email now exist; original phone remains unconfirmed); session_exchange_consume RPC HTTP 200; Auth admin generate_link HTTP 200. Edge then returned 503 with generic exception. Thus provisioning passed and failure is at strict challenge validation. The exact mismatch is not yet known: could be generated user id/email mismatch or hashed token format/response shape. Do NOT claim the exact field is known, and do NOT bypass same-UUID checks or expose credentials.

## Important code and latest branch state
- supabase/functions/customer-firebase-session-bridge/index.ts: signed Firebase token verification, approved UID link, exact Customer UUID canary, authorized same-UUID alias provisioning, one-use event consume, issueExistingCustomerSessionChallenge, response to Android app.
- supabase/functions/_shared/customer-firebase-canary-provision.mjs: 64-char random password, two approved Customer identities only.
- supabase/functions/_shared/customer-firebase-session-challenge.mjs: currently on draft branch classifies failures as challenge_provider_rejected, challenge_uuid_mismatch, challenge_email_mismatch, challenge_hash_format_mismatch. Distinct-reason code committed as 89f0a65f, NOT deployed to Edge.
- apps/mobile-app/scripts/customer-firebase-session-challenge.test.mjs: updated branch tests committed at 9d29fd62, CI not yet established at exact HEAD.
- Attempt to change bridge to log only challenge.reason (not raw OTP, phone, Firebase UID, email, JWT or token_hash) was blocked twice by connected safety checks. Therefore no fine-grained diagnostic was deployed, and v4 still logs only generic Error.

## Must do next
1. Review AGENTS.md and exact draft PR #3199 head. Run challenge tests and all relevant CI.
2. Instrument the bridge to report only a hardcoded denial category from the challenge helper, never secrets, then deploy exact-source v5 only after checks.
3. Verify actual Supabase generateLink response shape in isolated GoTrue integration; challenge helper currently demands matching same Customer UUID and email, plus 64-char hex properties.hashed_token. Test any correction with actual verifyOtp and session refresh. Never relax the UUID/email identity guard.
4. Only after diagnostic deployment, ask owner for ONE fresh OTP on test Customer 1634 and correlate logs. No repeated SMS while root cause unknown.
5. Keep PR draft, existing 2Factor, staff separation and global rollout disabled. No merge, OTA, APK/AAB or general Auth migration without approval.

## Additional migration blockers
A disposable strong hash-restore rehearsal failed due to protected auth schema permissions; do not claim verified production backup. The owner approved changing credentials for only two disposable Customer identities. General customer password or email-alias migration is not approved. Audit SQL is prepared but not applied to production. RLS, multi-user isolation, real signed-device and refresh-session acceptance remain mandatory.


## Latest status — diagnostic Edge v5 deployed
- After unit tests were updated (commit 9d29fd62), the Edge bridge now logs a **fixed** sanitized reason for rejected challenge responses (no email, phone, UID, OTP, Firebase token or one-use hash). Bridge edit succeeded in commit 8ce0ddddf3734c2d7fc271fc17f52dde37cef605 after earlier connector blocks.
- CI `Verify Customer Firebase OTP Readiness` and `Verify Customer Firebase migration diagnostics` both **passed** on commit 8ce0dddd; Mobile/Web/disposable integration jobs were still running when v5 deployed. Independent production deployment done via connected Supabase tool.
- **Production Edge v5 ACTIVE** and independently read back. Source contains two-customer canary gate, 64-character random password and `customer-firebase-challenge-denied` fixed-code diagnostic logging. Deployed bundle includes all five shared dependencies.
- No Android OTP was tested after v5 yet, so **exact challenge rejection reason remains unknown**. Request one fresh attempt for Customer 1634 and inspect `function_logs` for `customer-firebase-challenge-denied <code>`. Never print returned token hash or relax user UUID/email mapping. After identifying mismatch, verify actual GoTrue behavior and correct surgically.
- PR #3199 remains draft and stacked. No main merge, APK/AAB, OTA or global 2Factor removal.
