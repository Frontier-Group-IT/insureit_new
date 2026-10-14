# Customer Android Firebase SMS-only OTP → existing Supabase Auth — controlled release gates
**2026-10-14 | PR #3132 | source-only / controlled production cutover NOT APPROVED**

## Architecture and non-negotiables

- Firebase Android Phone Auth **only verifies a recent SMS OTP**. No Firebase Data API, Storage or custom authenticated-role access is required or permitted in the new path.
- The existing **Supabase Auth user ID (UUID)** is permanent. Supabase issues the real access/refresh session through a one-use challenge; use the existing Customer RLS, documents, policies, claims, KYC and SecureStore account vault.
- Old 2Factor/Supabase SMS OTP remains the production login. Production EAS profile has `EXPO_PUBLIC_CUSTOMER_FIREBASE_OTP_SESSION_BRIDGE_ENABLED=false`; the internal Android test profile can set it true **only for an approved test build**. A source merge or OTA alone cannot install RNFirebase native packages.
- System Auth alias `c-{uuid}@customer-login.insureit.invalid` must NEVER be a customer email, password-recovery mailbox, or public login method. Client `customerContactEmail` now strips reserved aliases before signup/profile/onboarding fields; CI guards this.
- The new Firebase bind source verifies **both** `profiles.phone` and the existing same-UUID `auth.users.phone`, and never sets Firebase custom `authenticated` claims. The already-deployed historical binding implementation must be reviewed/replaced **separately** if a live test is authorized.
- The bridge uses the **same** verified Firebase `auth_time` for an atomic service-only cooldown and **single-use event** guarantee. Do not return a challenge if the migration/function is absent. Never store the Firebase ID token, SMS code, customer phone, or Supabase challenge in the rate table.

## Evidence — code and isolated CI (not a live device proof)

- Synthetic local GoTrue: existing phone-only IDs preserved across Admin alias provision, `generateLink`, `verifyOtp`, `getUser`, `refreshSession`, A/B separation, replay denial, including an unconfirmed-phone synthetic account: Actions #38518326907, #38518695363.
- Disposable SQL/GoTrue stack: [run #38541053188](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/38541053188) passed; exercised migration, service-only grant, duplicate `auth_time` rejection, concurrency, anon denial and cooldown.
- Production **read-only** audit: 24 active Customer Auth profiles, all without Auth email; 22 have a confirmed phone and 2 do not. Customer profile phone is unique among these 24. Customer Firebase links have PK `(firebase_project_id,firebase_uid)`, UNIQUE `profile_id`, FK to profile and RLS ON; ordinary clients have no SELECT grant. No production account changed.
- **NOT present in production:** `customer_firebase_session_exchange_limits` and `customer_firebase_session_exchange_consume(text,bigint,integer)`; the `customer-firebase-session-bridge` Edge endpoint is not deployed. Existing production Firebase bind/signup Edge functions belong to an older implementation.
- Client and native Android prebuild checks must be green **at the final reconciled PR head**. A passing prebuild is not a signed-device OTP test.

## Gate 1 — current-main reconciliation / branch CI

Resolve any new divergence from `main`; keep Customer document reader, Start Claim header/vehicle selector, Web/Partner changes intact. Require Mobile, Web, Partner, dependency, Firebase readiness, disposable GoTrue/SQL, and Android *prebuild-only* checks to pass. Keep PR draft if any security/release gate remains.

## Gate 2 — backend preparation (separate approval, no Auth user changes)

1. Approve only the additive service-role-only SQL migration `supabase/migrations/20261014130000_customer_firebase_session_exchange_limit.sql`. Confirm a verified production DB backup/restore option first; apply exactly once with migration history, no direct UI/user-table edits.
2. Read back database grants, RLS, function signature, and concurrent/rate behavior safely. Migration does not affect existing Customer 2Factor login.
3. Review Firebase Admin service-account project ID **server side** (`insureit-customer-auth`). Do not paste a private key in chat, GitHub or public Expo env.
4. Separately approve deployment of `customer-firebase-session-bridge`, `customer-firebase-bind`, and `customer-firebase-signup` with Edge Gateway `verify_jwt=false` ONLY because the functions themselves enforce Firebase Admin signature **and revocation** verification. First deploy them **disabled** and verify 503 from disabled bridge/signup, as well as non-mutation on invalid requests. Do not switch existing bind endpoint until scoped compatibility is audited.
5. Leave `CUSTOMER_FIREBASE_SESSION_BRIDGE_ENABLED=false`, `CUSTOMER_FIREBASE_SESSION_ALIAS_JIT_ENABLED=false`, `CUSTOMER_FIREBASE_SIGNUP_AUTH_ALIAS_ENABLED=false` through this gate. Do not release `FIREBASE_SERVICE_ACCOUNT_JSON` to a client.

## Gate 3 — canonical customer identity canary (separate explicit approval)

1. Owner selects a **consenting test Customer** already in production because INSUREIT has NO staging database, or provisions an explicitly approved sacrificial test identity. Do not disclose phone, credentials or tokens in PR/CI logs.
2. Check live profile/Auth UUID and phone, role, activity/ban, Firebase verified phone/UID, existing approved identity mapping, alias collision, active policies/claims/KYC. Capture a strictly protected Auth metadata restore record **outside GitHub**.
3. Never overwrite a real Auth email with an alias and never promote `profiles.email` into Auth; verify reserved `.invalid` email cannot be externally delivered, used as a normal email address or exposed through contact UI. Confirm email sign-in/recovery routing is blocked or provably undeliverable for aliases.
4. Approve a single-customer, same-UUID alias change using the reviewed dry-run-first script only; keep automatic JIT alias provisioning **disabled** until independently security-reviewed. Verify phone-confirmed state, UUID, memberships, Customer master/policy/claims counts remain unchanged.
5. On a signed Firebase Android device, complete genuine OTP → Firebase Admin verification → approved UID link → single-use Supabase Auth challenge → actual refreshable Supabase session, `auth.getUser` exact UUID. Verify replay, wrong UID/phone, staff, inactive, duplicate, A/B and revoked-token denial.
6. Check RLS and Storage for two *consenting* Customer identities: each may read only their own policy, claim, document and account context. Verify existing normal 2Factor OTP still works and optional fallback works after errors.
7. On any anomaly: leave flags OFF, stop, investigate. Never auto-delete or overwrite a preexisting Customer identity. Manual restore needs separately authorized and rehearsed safety procedure.

## Gate 4 — Android Internal Testing (separate approval)

1. Owner verifies **Firebase Console → Authentication → Sign-in method → Phone** and app `com.insureit.mobile`, Android signing SHA-1/SHA-256 for the correct EAS upload certificate and (if Play-delivered) Google Play App Signing certificate, quota/anti-abuse and real India SMS delivery. These cannot be confirmed just by committing `google-services.json`.
2. Owner selects internal testers and a real compatible Android device/phone; confirm Play Console Internal Testing distribution if an **AAB** is used.
3. After gates 2–3 and CI, expressly approve **one** 0.3.2 (11) Android internal AAB, never an APK or auto-build. Do not upload to production track or publish without subsequent approval.
4. Verify login/signup, logout, refresh after app restart, multiple Customers, policy, vehicles, claims, KYC, documents, camera, native header, fallback and OTA runtime version boundaries. A screenshot/mock CI is not installed-device evidence.

## Gate 5 — final PR and production cutover (separate approval)

After all previous gates have real evidence, reconcile with latest `main` again, run every required CI on head, explicitly authorize merge, and independently authorize production deployment and any Play Store release. Keep 2Factor OTP as rollback until an independently agreed observation period completes.

## Exact actions needed from INSUREIT owner

- **Approval A:** authorize an additive, service-only production throttle migration and disabled Edge staging **only**, with no Customer Auth/account changes, or decline.
- **Approval B:** later authorize and nominate a protected consenting single production canary Customer Auth UUID for *dry run and then separately approved same-UUID alias write*; do not send the phone/OTP/private key in chat.
- **Firebase/Android:** confirm Phone sign-in enabled, matching SHA-1/SHA-256 configured in project `insureit-customer-auth`, and provide an Android test device/internal tester under your control.
- **Build approval C:** later explicitly authorize the one Android AAB (0.3.2 build 11) for Internal Testing only. Do not approve a Play Production release at this stage.

**Current result:** nothing in this document authorizes merging, applying production SQL, modifying Auth user email/phone, activating an Edge function, OTA, APK/AAB or Play release on its own.
