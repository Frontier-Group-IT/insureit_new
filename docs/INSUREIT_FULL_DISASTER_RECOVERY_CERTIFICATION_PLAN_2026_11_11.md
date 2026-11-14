# INSUREIT — Full Disaster Recovery Certification Plan

**Baseline:** 11 November 2026, India Standard Time (UTC+05:30).
**Document status:** Working certification plan. **INSUREIT full application/service disaster recovery is NOT certified.**
**Source of truth for the drill history:** [Existing R2 backup and restore handoff](./INSUREIT_SUPABASE_R2_STORAGE_BACKUP_HANDOFF_2026_10_31.md). Do not replace or duplicate its complete chronological investigation.

## 14 November 2026 — scoped rehearsal requested by operator (does not reduce certification standard)

The immediate drill is now **full PostgreSQL schema, SQL and row-data restoration** with exact-v2-snapshot parity, complete reviewed role/owner/RLS/managed-service compatibility, and **up to 500,000,000 bytes of selected representative Storage file content** tested via the isolated project's Storage service. Any individual sampled file is limited to 50,000,000 bytes under the published Free file-size ceiling. The SQL backup may include the entire `storage.objects` metadata set: it is NOT proof that non-selected actual file bytes exist. Never directly mutate managed Storage metadata to simulate recovered objects.

This is a **bounded recovery drill**, and the narrower Storage exercise deliberately **does not meet Gate B full Storage service/file-set restoration** or permit the label `FULL INSUREIT DR CERTIFIED`. The unchanged Gate A–F acceptance criteria below remain the future full-service standard; record `DATABASE_FULL_SQL_PARITY` and `STORAGE_500MB_SAMPLE_PASS` **separately**, only when their actual restore and functional/API tests complete. Continue the staged stop-on-error R0–R8 path in [the authoritative handoff](./INSUREIT_SUPABASE_R2_STORAGE_BACKUP_HANDOFF_2026_10_31.md). The sample selection/planning code is in draft PR #4433; **no managed target writes authorized by the planning PR**.

## 1. Defined recovery objective and evidence boundaries

The plan certifies an independently restorable **INSUREIT operational service**, not merely successful SQL imports or stored ciphertext. Scope includes the production PostgreSQL database, Supabase Auth user identities and configuration, Storage metadata AND binary files, original PostgreSQL roles/owners/RLS/SECURITY DEFINER, Realtime, Edge Functions, required secrets and integrations, and production-equivalent app/API smoke tests on a safely isolated target.

Never attempt to certify a self-hosted Supabase service using only the single-container PG17 disposable restore. The test must use a separately provisioned, version-compatible Supabase service stack and a recovery-only Storage backend; it must be isolated from production. The live database is not a staging database.

| Existing validated evidence | Proven | Explicitly not proven |
| --- | --- | --- |
| [Encrypted PostgreSQL R2 v2 backup](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/42965931610) | 231 table definitions, 230 table-data targets, 287 RLS policies, 20 sequences; authenticated encrypted archive and readback | Application startup or role/owner semantics |
| [Real isolated PG17 restore](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/42978088652) | All 230 archived data targets reconciled, zero row-count mismatches, strict schema/data/ACL replay | Two local NOLOGIN placeholders; --no-owner, so actual login/membership/owner parity not established |
| [Actual full Storage manifest byte verification](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/42981463054) | All 3,534 entries decrypted and SHA-256/size verified; 1,673,527,245 bytes; 8 populated and 1 empty bucket | File inventory completeness at live source, functional Storage download or file permissions |
| Daily encrypted backup schedules on main | Storage 19:00 IST (`30 13 * * *` UTC); PostgreSQL v2 03:15 IST (`45 21 * * *` UTC, preceding UTC calendar day) | The *first unattended scheduled PostgreSQL run* and alert delivery need real operational verification |
| GitHub backup monitor | Scheduled workflow metadata, stale/missed-run checks, GitHub Issue creation/closure by code | Repository notification recipients or protected environment approval are not yet independently verified |

### Fresh production metadata observations (read-only)

- At the time of this plan the live source held **3,608 Storage object metadata rows**; **78 were created after** the R2 Storage manifest timestamp `20261110T203147Z`, leaving **3,530 currently live records created earlier**. The older encrypted manifest held **3,534** files. This is a **time-mismatched observation**; deletions, updates or API listing differences can account for counts. **It is NOT proven that any file was omitted or that four historical items were deleted.**
- **15** non-`pg_*` roles; **9 LOGIN** roles, **1 superuser**, **5 BYPASSRLS** roles.
- **19** role-membership edges, including **8 admin**, **14 inherit**, and **19 SET** options.
- **393 SECURITY DEFINER functions** across **3 owner identities**. These require role/ownership and authorization testing rather than a row-count check alone.
- Current owner distribution of table/view/sequence metadata includes: `public` predominantly `postgres` (203 objects), `auth` `supabase_auth_admin` (28), `storage` `supabase_storage_admin` (10), `realtime` `supabase_realtime_admin` (10) plus `supabase_admin` (1), `vault` `supabase_admin` (2), and `supabase_migrations` `postgres` (1).
- Earlier read-only observation: 86 Auth users and 90 identities. These are live counts at different moments, not protected restored snapshots. This report intentionally contains no customer identities, document names, role passwords or application secrets.

### 11 November 2026 — source-parity audit timeout and guarded remediation

- The first manually launched source coverage run [#43011426945](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/43011426945) was **cancelled at its 45-minute timeout** before any reconciliation result. This was **not** a corrupt file finding, nor did it pass Gate B. The original source scanner used two serial recursive per-folder Storage HTTP listing sweeps with no intermediate progress; the exact blocking HTTP call was not visible in logs.
- **Targeted remediation:** only the manual source-parity audit is changed to query `storage.buckets`/`storage.objects` through **source-allowlisted, authenticated PostgreSQL connections**, each in read-only repeatable-read transactions. The tool filters archived versions and delete markers, maps SQL metadata into the original manifest comparison, prints aggregate phase/timing markers, normalizes timestamp encodings, and uses a 20-minute job timeout plus bounded SQL statement timeout.
- Daily PostgreSQL and Storage backups, R2 encryption/readback, all-file Storage verifier, and isolated PostgreSQL restore workflows are **unchanged**. This fix must pass repository CI and be merged before a fresh protected manual source audit can be claimed as executed. The audit still cannot reproduce exact historical source state without an aligned snapshot.

## 2. Certification gates, in required order

### Gate A — Prove unattended backup operations (OPEN)

**Action:** Observe at least **two successful scheduled** executions of each independent workflow on `main`. The PostgreSQL v2 schedule was newly added on 11 November; its first expected nominal time is **12 November 2026 03:15 IST**. Storage runs daily at 19:00 IST.

**Pass evidence:** job event is `schedule` (not `workflow_dispatch`), protected environment did not block awaiting a reviewer, encrypted manifest/readback success, no plaintext artifacts, no production SQL writes, GitHub monitor closes or avoids duplicate alert issues and raises a deduplicated issue on a failed or missed schedule. Confirm a real human/team actually receives notifications from repository Issues.

**Failure action:** treat missing approval, GitHub cron delay and incorrect permissions as operational faults; repair via reviewable PR/authorized environment settings, not by removing secrets protection or rerunning the old workflow ref.

### Gate B — Storage source-to-backup completeness and file serving (OPEN)

**Action:** Run [the protected manual source-manifest audit workflow](../.github/workflows/insureit-r2-storage-source-parity-audit.yml) only after its PR has been merged. It authenticates the latest immutable R2 manifest; performs two separate **read-only, repeatable-read PostgreSQL Storage metadata snapshots** via the already-protected production `DATABASE_URL`, compares bucket/object identity/updated_at/size coverage, logs *only aggregate counts*, and labels concurrent drift/incomplete metadata as `REVIEW`. No Storage HTTP recursive LIST requests are made; no Supabase source SQL writes are permitted.

**Pass evidence:** zero pre-snapshot stable source identities missing from the manifest, zero old stable metadata mismatches and complete bucket coverage, plus a fresh 100%-byte verifier result tied to the correct manifest snapshot. This **still does not prove a historic transactionally consistent source snapshot**; for rigorous certification, capture a same-period source inventory at backup start and finish, reconcile object generations/updated_at, changed/deleted objects and Storage metadata rows, and verify no unsupported file families.

**File restore test:** copy a *synthetic, approved* small representative fixture from the encrypted R2 archive into a **recovery-only Storage endpoint**, check content hash/type, private bucket authorization, download URL expiration and audit logs. No production overwrites, file publishing, or customer documents in public artifacts. A real customer's document must not be used without separate authorization.

### Gate C — PostgreSQL roles, ownership, schema and RLS equivalence (OPEN)

**Action:** Provision **version-compatible isolated PostgreSQL 17** with all required extensions, and capture **read-only** source role attribute+membership and object ownership inventories via controlled, private tooling. Reconstruct each source role's approved attributes, memberships (`admin_option`, `inherit_option`, `set_option`), memberships and object owner(s), not just placeholder names. Preserve generated roles as non-login except where a real isolated service needs a distinct credential; **no source password hashes** are exported. Do NOT give unrestricted superuser/BYPASSRLS to an ordinary recovery app role.

**Pass evidence:** comparable role identity/attribute and membership matrices, exact schema/class/function/sequence ownership and 393-source SECURITY DEFINER function equivalence (counts may change with application migrations); all archived COPY destinations and source/target row counts still match; sequence values/identity writes, representative FK/unique/check constraints, RLS denial and permitted-case tests pass for anon, authenticated, service and configured managed roles. Test a non-admin user's forbidden write to confirm access cannot escalate. Restore run timestamp / source snapshot and target checks must be linked.

**Stop:** any missing managed role, unexpected privilege escalation or incomplete object ownership prevents role/RLS certification. A successful `--no-owner` dump replay is insufficient.

### Live platform service inventory (read-only, 11 November 2026)

- Connected Supabase project is `Insureit_Web` / `ilzhsfqqjyppzzvfscmh`, region `ap-northeast-2`, database version **PostgreSQL 17.6.1.164** reported by the project metadata API. The successful standalone restore used the pinned `supabase/postgres:17.6.1.136` image; a live service stack must verify version and managed-service compatibility before signoff.
- Eight installed database extensions were observed: `hypopg` 1.4.1, `index_advisor` 0.2.0, `pg_stat_statements` 1.11, `pg_trgm` 1.6, `pgcrypto` 1.3, `plpgsql` 1.0, `supabase_vault` 0.3.1 and `uuid-ossp` 1.1. A genuine replacement target must support all extensions required by restored SQL, not merely the ones present in a generic image.
- **12 ACTIVE Edge Functions** in the managed project: `create-user`, `profile-context`, `send-sms-2factor`, `part-location-action`, `guest-service-enquiry`, `customer-firebase-bind`, `customer-firebase-signup`, `customer-firebase-doc-read`, `customer-firebase-upload-url`, `customer-firebase-registration-check`, `customer-firebase-session-bridge`, `customer-firebase-operator-preview`. The service metadata reports `verify_jwt=true` on **4** and `false` on **8**. This does **not** by itself establish an authorization vulnerability: functions with JWT verification disabled can implement another authorization method. Every route, especially the eight, requires explicit source review and safe synthetic authorization testing before recovery certification.
- No live production Auth/OAuth/SMTP JWT secret values were retrieved, logged, or copied into source control. The recovered stack must obtain fresh scoped credentials and reconstruct external integrations via a secure operator-approved procedure.

### Gate D — Supabase Auth and service-layer recovery (OPEN)

**Action:** Build a **separate recovery Supabase stack**, with isolated network, fresh service secrets, recovered DB/Storage wiring, pinned versions of GoTrue/Auth, Storage API, Realtime, API gateway/PostgREST, and Edge Functions. Treat external services (SMS/email/payment/webhooks/OAuth) as **disabled/sandboxed** unless expressly approved. Supply JWT secrets, OAuth credentials, redirects, SMTP, external endpoints and encryption keys through a secure operator-controlled secret vault; none should be committed or copied to GitHub logs.

**Pass evidence:** synthetic user signup/login/logout, access token refresh and expiry, JWT/RLS permissions, email/password recovery in sandbox, correct auth.users/auth.identities relationships, provider callback configuration for *approved sandbox identities*, PostgREST CRUD rules for test rows, protected Storage list/read/write on the isolated recovery Storage service, Realtime connection/event tests and Edge Function route tests, with no real customer notifications.

**Explicit caveat:** Platform-issued JWT tokens may not work with a newly configured recovery signing key. Production users may need to authenticate again after failover. Do not claim existing sessions remain valid without testing.

### Gate E — INSUREIT application/business continuity (OPEN)

**Action:** Point a **temporary recovery build only** of the website and authorized test clients to the *recovery* Supabase services. Keep live Cloudflare site and Supabase production unchanged; do not publish customer app OTA, mobile binaries, DNS cutovers or prod data changes.

**Pass evidence:** synthetic-role login for Customer/Partner/RM/Operations/Admin, role-specific policy and vehicle access, policy PDF viewing, claim and service-enquiry workflows, Storage document downloads, intake checks, notification/realtime behavior and operation permissions. Verify RLS prevents cross-customer/partner data leakage. Avoid real payments, OTP deliveries, WhatsApp, SMS, emails, insurer API calls and policy mutations in production.

### Gate F — Retention, ownership, incident playbook and signoff (OPEN)

**Action:** Authorize an accountable owner and alternate for each of Supabase, GitHub Actions, R2, encryption key escrow, app DNS/deployments, Auth providers, alerts and customer communication. Validate that keys can actually be recovered by a *different* authorized operator without exposing them in PRs. Test a safe failure injection in **synthetic CI**, not production; verify alert delivery and issue closure after recovery.

**Decisions needed from owners:** desired recovery-point objective (RPO) and recovery-time objective (RTO), retention days/immutable window, acceptable cross-service clock difference, encrypted archive geographical isolation and account compromise scenario, R2 quota/cost alerts, rotation/recovery policies and escalation contacts. **Do not turn on R2 pruning or key rotation** until owner approval and ability to decrypt older archives are both proven.

**Suggested targets for discussion, NOT agreed SLA:** database and files RPO no greater than 24 hours each; full core service RTO within one business day for the initial rehearsal. Since PostgreSQL and Storage run at **different times**, no combined cross-service 24h consistency guarantee follows automatically; use a matching snapshot strategy or reconciler before declaring an aggregate RPO.

## 3. Release-day drill and certification criteria

1. Freeze/record GitHub `main` commit, exact PostgreSQL and Storage R2 manifest snapshots, backup key escrow IDs (never values), source schema/app versions and approved recovery exercise scope.
2. Bring up a new isolated recovery stack with restrictive network routes and disabled outbound customer notifications. Verify target cannot write to production database or production R2 bucket.
3. Restore PostgreSQL roles and original ownership and full R2 v2 data; verify strict schema/COPY count parity and full Auth/Storage managed metadata.
4. Restore all required encrypted Storage files to recovery-only Storage using a controlled operator-approved transfer and verify checksum/type, bucket policies and object download.
5. Configure fresh service credentials/redirects from the secure vault and complete Auth, RLS, Edge Function, Realtime and test-user application smoke tests.
6. Record actual start/finish and latest recoverable source transaction/object timestamps; calculate **measured** RPO and RTO rather than estimating from cron schedules.
7. Require evidence review and sign-off by service/DB owner, security/privacy owner and business continuity owner. Distinguish `PASS`, `FAIL` and `INCONCLUSIVE` by gate. **Only then** declare “FULL INSUREIT DR CERTIFIED”.

## 4. Recovery test frequency and fail conditions

- Daily: automatic PostgreSQL v2 and Storage backups (independent), encryption/upload/readback and GitHub missed/failure monitor; no automatic restoration to a live target.
- Weekly (suggested): read-only manifest/source identity audit and sample verification review after the actual workflow is proven; retry only when error evidence warrants it.
- Monthly (suggested): independent encrypted manifest complete readback and restore verification for PostgreSQL in a disposable environment, via approved protected manual workflows. Storage's 3,534-file test consumed ~49 minutes; plan operator time and R2 download cost.
- Quarterly (suggested): full isolated service stack functional recovery with synthetic accounts and business workflow smoke tests.
- After any major Auth/Storage/PG upgrade, RLS/role migration, encryption-key change or provider/endpoint change: run appropriate certification gates before claiming continuity.
- Fail closed for missing archive objects, TOC mismatches, privilege escalation, unexpected RLS access, wrong secrets or target hostname, wrong source/target project ID, or unapproved outgoing notifications. Never mask failures by skipping tables or turning off access checks.

## 5. GitHub entry points and safety

- [PostgreSQL v2 daily and manual backup](../.github/workflows/insureit-postgres-r2-v2-manual.yml)
- [PostgreSQL v2 isolated restore](../.github/workflows/insureit-postgres-r2-v2-restore-verify.yml)
- [Storage daily backup](../.github/workflows/insureit-supabase-storage-r2-backup.yml)
- [Storage all-file immutable manifest verifier](../.github/workflows/insureit-r2-storage-complete-verify.yml)
- [Storage source-to-manifest read-only audit](../.github/workflows/insureit-r2-storage-source-parity-audit.yml)
- [GitHub backup freshness and issue monitoring](../.github/workflows/insureit-r2-backup-monitor.yml)

**Operator rules:** Production Supabase access stays read-only for investigation. Do not use production as a test target. No R2 DELETE, customer-data publishing, unrestricted privileges, secrets in repository/logs, DNS change, app/OTA deployment or webhook/OTP delivery without narrowly approved operational plans. Work on reviewable branches; run repository CI; merge only when approved; record actual run links and verification markers in the original handoff.
