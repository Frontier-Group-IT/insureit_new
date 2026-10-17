# INSUREIT Firebase Customer — Production safety gates and sign-off
17 October 2026 | PR #3216 | source-only, production unchanged

## Decision
**NOT READY for expanded production enrollment or 2Factor retirement.**
All achievable read-only inspections and extra isolated shape tests below are complete. Do not confuse local tests, secure-bucket flags or source reviews with live signed-token two-account acceptance or recoverability.

## Verified live read-only controls
- Project: ilzhsfqqjyppzzvfscmh (PostgreSQL 17). No production migration, Auth write or file download performed during review.
- RLS enabled on Customer profiles, customers, memberships, onboarding applications, vehicles, policies, claims, Firebase links and storage.objects. Firebase UID link table additionally has FORCE RLS; client SELECT policies are intentionally absent.
- Customer, policy and claim document Storage buckets are all **private**. This is metadata verification, not HTTP signed URL or path-isolation proof.
- Existing production customer-firebase-session-bridge Edge Function is ACTIVE v7, not replaced by PR #3216.
- Live Firebase document-read Edge v2 uses Firebase Admin token verification with revocation, approved UID link, Customer/profile ownership and active Customer membership checks, and issues 60-second signed download URLs. Live upload-url Edge v1 uses the same UID approval/ownership protections and requests non-upsert path-bound signed upload tickets. These are source reviews, NOT end-to-end signed-token outcomes.
- Production read-only aggregate: **23 active Customer profiles, 0 missing Auth users, 22 without Auth email, 2 with unconfirmed Auth phone, 2 with approved Firebase links**. Categories overlap and may change.
- Security advisor finding [anon_security_definer_function_executable](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable): the existing `public.customer_firebase_data_api_pre_request()` can be executed by `anon`. A targeted authorization review is required; do not revoke its execute privilege blindly, as PostgREST pre-request and legacy Firebase support may depend on execution context. Other broad advisor findings are outside this Firebase release scope.
- The latest PR #3216 proposed helper is source-only and preserves the old Firebase issuer path while allowing a signed Supabase UUID session path. No live policy/helper update is approved or applied.

## Additional disposable checks
- Original synthetic Firebase RLS helper A/B, revoked/duplicate link and rollback: PASS GitHub #39014051988 and later #39014863284.
- Representative live-style permissive OR Customer record policies and private Storage path checks for Customer A/B, staff sharing Customer phone, membership grant/revoke and anonymous denial: PASS GitHub #39014863232 (PostgreSQL 17 synthetic). Script `apps/mobile-app/scripts/customer-firebase-policy-storage-shape-local.sh`.
- This representative fixture does NOT clone the entire live schema, all staff hierarchies, all policies, signed JWTs or real Storage objects. Actual production parity remains open.

## Gate matrix
| Gate | Status | Evidence / required next step |
|---|---|---|
| Project/access metadata | VERIFIED | Live read-only Supabase queries |
| Customer tables protected by RLS | VERIFIED (configuration) | Live catalog metadata |
| Customer, claim and policy buckets private | VERIFIED (configuration) | storage.buckets private flags |
| Disposable A/B database isolation | PASS | Synthetic RLS + GoTrue tests |
| Disposable Customer file RLS policy-shapes | PASS | CI #39014863232 |
| Firebase Edge privileged endpoint source review | REVIEWED, NOT E2E | Source retrieved from active v7/v2/v1 |
| Production encrypted Auth backup | BLOCKED | Owner-controlled privileged DB connection, recipient-held age key, encrypted offsite copy required |
| Production Auth restore verification | BLOCKED | Decrypt to disposable matching GoTrue schema; test original credentials/identities and exact UUID; never restore against production |
| Independently approved ownership & consent | BLOCKED | Review each Customer; shared staff phone needs second independent IT reviewer |
| Signed Android A/B Data API & Storage access | BLOCKED | Two consenting approved accounts, genuine signed sessions and private-object GET denial tests |
| Automatic refresh after actual expiry | BLOCKED | Device-based, no mocked expiry proof accepted |
| Replay/revocation after actual deployment | BLOCKED | Controlled signed-token and one-use challenge tests |
| Privileged pre-request / anon EXECUTE review | REVIEW REQUIRED | Preserve existing working adapter; assess RPC exposure and compatibility |
| Production SQL / cohort activation / merge / OTA / AAB | NOT PERFORMED | Only after all gates and explicit release sign-off |

## Owner-controlled recovery execution (secrets must never enter ChatGPT or GitHub)
1. From an owner-trusted workstation with `pg_dump`, `age`, `sha256sum`, create an age public/private keypair. Keep the private key in a secured vault/offline; never store it in the repo, CI, or chat.
2. Obtain privileged direct project PostgreSQL access out of band. In a trusted shell configure `INSUREIT_BACKUP_DB_URL`, `INSUREIT_BACKUP_AGE_RECIPIENT`, `INSUREIT_BACKUP_DIR` pointing **outside** repository, then execute `scripts/customer-firebase-auth-encrypted-backup.sh`. Confirm that the encrypted output and SHA-256 manifest exist and store independent offsite copies. Do not publish their contents.
3. Prepare a disposable *matching* Supabase Auth/GoTrue database on loopback with empty `auth.users`; configure `INSUREIT_BACKUP_FILE`, `INSUREIT_BACKUP_AGE_IDENTITY`, `INSUREIT_RESTORE_TEST_DB_URL`, run `scripts/customer-firebase-auth-restore-rehearsal.sh`. Confirm original synthetic/consenting account login, full identity record consistency, same Auth UUID, and rollback; an imported row count ALONE does not constitute success.
4. Record only artifact digest, encrypted offsite storage attestation, matching-schema restore results, reviewer names/sign-off in the secure release register; never raw Auth rows, encrypted passwords, private keys, JWTs or customer documents.
5. Independently collect Customer account ownership proof and consent, especially where staff/customer phone overlaps. Before a production Android test, document two exact authorized Customer UUIDs in the *private* reviewer register; do not infer identity from OTP possession alone.
6. Execute genuine Android internal canary sign-in, A/B profile, vehicle, policy, claim and document isolation, signed URL expiry, session refresh after real expiry, replay, revocation and rollback. Stop immediately on cross-account access or original UUID changes.

## Safeguards
No new APK/AAB/OTA, Edge deployment, Auth write, production DDL, merge, owner credentials export, recovery secret handling or Customer account enrollment was performed in this phase. Existing Supabase/2Factor Customer and staff authentication must remain available. Do not mark all gates green without the confidential operator and real-device evidence.
