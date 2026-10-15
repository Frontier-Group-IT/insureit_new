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


## 2026-10-15 addendum — production Gate 2 achieved with approved no-backup exception; Gate 3 restricted

- Owner explicitly approved *limited additive-only Gate 2* without an existing full backup. Project `ilzhsfqqjyppzzvfscmh`. Production migration recorded `20261015061234_customer_firebase_session_exchange_limit_20261015_gate2`; RLS ON; ordinary anon/authenticated table/RPC access denied; service-role RPC allowed; zero rate limiter rows at last read-only check.
- New `customer-firebase-session-bridge` Edge function deployed as version 1, with `verify_jwt=false` due in-function Firebase Admin verification and source guard requiring `CUSTOMER_FIREBASE_SESSION_BRIDGE_ENABLED === 'true'`. **Runtime environment flag and HTTP 503 response remain unverified**. Production historical bind/signup Edge functions were not overwritten.
- Owner confirmed Firebase Phone provider is enabled and Android signing SHA-1/SHA-256 registered, but they were not independently verified from Firebase console by this agent.
- The nominated Customer telephone (record suffix **1014** only) maps to **one active Customer** and **one active IT Super User**, two separate canonical Supabase UUIDs. The Customer has confirmed phone, no Auth email; staff has Auth email; **neither has a Firebase UID link for this phone**. Alias collision check is clear. Preserve cross-role deny; never derive a target identity by phone alone. Owner confirmed physical access to SMS device.
- Added shared-phone cross-role regression in commit `e5af1f82`. **New CI is not yet confirmed**; latest `main` continues moving, so final PR-head reconciliation/CI still required. Keep PR draft and no auto APK/AAB or OTA.
- **Gate 3 HARD STOP:** no signed, revocation-checked Firebase ID token/UID mapping for the nominated Customer, no protected recoverable Auth-state snapshot, and no independently demonstrated prevention of alternate email OTP/magic-link/recovery for the reserved Auth aliases. **Do not provision aliases or activate bridge.** The owner has not separately approved the exact alias Auth write. A bridge returning 503 on live POST still needs verification from a DNS-capable environment.
- After link verification and secure backup/recovery of the single target Auth identity, present exact proposed UID binding and alias mutation for a separate written approval. Never touch the IT Super User Auth identity and never treat shared SMS phone ownership as permission to do so.


## 2026-10-15 authoritative continuation and autonomy policy
**Owner directive:** Future agents must pursue completion without asking for routine go-aheads or stopping after every progress update. Stop only for owner-only manual actions or a required security/production authorization, and continue independent safe tasks. This does not lift explicit release gates, nor authorize merges/builds/Auth writes/deployments on its own.

**Gates as currently implemented / outstanding:**
- Gate 1: Latest PR #3132 CI at reconciled current-main HEAD **PENDING**. Previous local GoTrue/SQL/prebuild checks passed but new shared-phone test and final head checks **unverified**. Latest observed 2026-10-15: feature branch 43 commits behind main (verify again).
- Gate 2: Owner granted limited additive-only deployment despite no full backups. **DONE:** Supabase project `ilzhsfqqjyppzzvfscmh`, migration recorded `20261015061234_customer_firebase_session_exchange_limit_20261015_gate2`, limiter table and RPC present, RLS true, anon/authenticated grants denied, service_role granted, last count zero; new bridge v1 deployed, historical bind/signup kept unchanged. **NOT DONE:** independently prove bridge disabled env and live HTTP 503; no live Firebase sign-in.
- Gate 3: nominated Customer SMS **suffix 1014** owner-controlled; Phone provider and SHA-1/SHA-256 owner-confirmed. One active Customer and one separate active IT Super User share the phone. Customer is phone-confirmed, no Auth email, no Firebase identity link; reserved alias collision 0. Never operate on staff Auth or assume phone uniquely identifies an Auth UUID. Before one-user write, obtain signed Firebase ID token securely, verify Firebase Admin signature/revocation/UID/phone, create reviewed immutable UID↔Customer UUID binding with explicit consent, independently review reserved `.invalid` alias email OTP/recovery access, capture private recoverable Auth snapshot, run single-customer dry run, obtain **separate exact Auth-write approval**. JIT aliases disabled. No production canary yet.
- Gate 4: only after full canary, exact-HEAD CI and Android signing/device validation, seek separate approval C for **one internal AAB 0.3.2 (11)**; no APK, OTA, Play publish or prod track without explicit authorization.
- Gate 5: final merge/deploy/cutover requires separate approvals, retain rollback to existing 2Factor.
- Focus for autonomous agent: fix code/test/documentation, correctly integrate latest main, verify CI, review bridge disabled response and alternative Auth paths, plan secure owner-operated UID verification. Write factual evidence, blockers and next steps in `docs/CURRENT_CHAT_HANDOFF.md` and `AGENTS.md` without exposing complete phone, UUID, secrets or OTP. Never claim untested production behavior is verified.


## 2026-10-15 CRITICAL production deployed bind v2 independently audited
- Read deployed `customer-firebase-bind` Edge v2 directly from Supabase project `ilzhsfqqjyppzzvfscmh` via get_edge_function. Contrary to the newer GitHub proposed bind source, **deployed v2 lacks the extra matching `auth.users.phone` guard**, **auto-inserts a row with `is_approved:true,is_active:true`** after matching a single Customer `profiles.phone`, and subsequently runs `firebase.setCustomUserClaims(uid,{...customClaims,role:"authenticated"})`. These behaviors violate the OTP-only migration target (Firebase must not authorize data or provide a role); they require a separate reviewed production endpoint remediation plan.
- No Auth accounts, endpoint deployments, configuration or production data changed while auditing. The guarded new Customer login branch has removed the legacy automatic bind call in `39e58816` with source regression `ce6f8939`, but **the independently callable deployed endpoint remains and is not mitigated by merely merging mobile app code**.
- Before approving the production canary, obtain explicit scope approval to replace the legacy endpoint with audited, fail-closed UID binding, without automatically approving mappings or setting Firebase role claims. Identify existing consumers of the old endpoint and plan compatibility/rollback. This is a security-sensitive live behavior change; never silently deploy it. Keep old Customer 2Factor login intact.


## 2026-10-15 verified gate addendum and safe build bootstrap
- Two-parent PR head `b9c3a107` reconciled original latest main without losing unrelated files; newer main commits may need another reconciliation. **Do not merge PR #3132** without explicit approval.
- Gate 2 Edge bridge disabled HTTP response **verified (503 `session_bridge_disabled`)** from GitHub runner `38719936406`; bind v3 unauthenticated 401 verified. Production existing UID mappings preserved, canary lacks UID link.
- All 23 audited active Customer Auth accounts have nonempty password hashes, including selected Customer phone suffix 1014. The internal Auth email alias can expose an alternate password route; treat previous alias threat review as **incomplete until credential rotation, protected hash recovery and independent authorization**. JIT alias writes removed from current PR source. Manual script requires separate credential rotation approval and generates a fresh random password. No prod password/email changed.
- Expo Android native prebuild-only workflow `38720570142` **PASS**. Internal Customer AAB can be built through new **manual-only, approval-token-guarded** `.github/workflows/build-customer-firebase-internal-aab.yml` once the owner separately authorizes one 0.3.2(11) Internal Testing candidate; no auto build, no APK, no Play publication. Note AAB needs Play Internal Testing for device installation.
- Canary bootstrap sequencing: a signed native Firebase-enabled candidate may be needed to obtain a real verified Firebase UID before the session link/alias can be provisioned. A build requires separate approval; backend must remain disabled until strict identity canary, and existing production 2Factor login remains unchanged. See `docs/CUSTOMER_FIREBASE_OTP_CANARY_RUNBOOK_2026_10_15.md`.
