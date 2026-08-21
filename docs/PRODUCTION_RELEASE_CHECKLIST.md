# INSUREIT Production Release Checklist

> Use this checklist for the web portal before every production release. A checkbox is not evidence by itself. Each PASS must identify the owner, exact release commit, environment, date and evidence link/output.

## Status values

- **NOT STARTED** — no evidence collected
- **IN PROGRESS** — work/testing is underway
- **PASS** — acceptance criteria met with attached evidence
- **FAIL** — acceptance criteria not met
- **BLOCKED** — external dependency or prerequisite prevents completion
- **ACCEPTED RISK** — accountable owner approved a written, time-bound exception; never allowed for severity-4 findings

## Release identity

- Release name/version:
- Exact Git commit SHA:
- Release owner:
- Security reviewer:
- Business/UAT approver:
- Planned release date/time:
- Vercel project/environment:
- Supabase project/environment:
- Previous known-good deployment/commit:
- Migration range included:
- Rollback owner:

---

## Gate 0 — Scope and change control

**Go/no-go:** No release begins without a frozen, reviewable scope.

- [ ] Release commit is fixed and recorded.
- [ ] All changes since the previous production commit are reviewed.
- [ ] No unrelated migration, debug code, temporary bypass, test credential or UAT-only behavior is included.
- [ ] The protected production workflow has not been dispatched before explicit deployment approval.
- [ ] The dispatch uses the successful feature-PR verification run ID and exact verified commit; no deployment-trigger commit/PR or duplicate full gate is created.
- [ ] Open severity-4 findings: **zero**.
- [ ] Open severity-3 findings have an explicit resolution or accepted-risk decision.
- [ ] Business owner confirms which routes/features are production-ready and which are hidden/feature-flagged.

**Required evidence:** commit comparison, reviewed file list, issue/PR links, approved release scope.

---

## Gate 1 — Build, CI and dependency integrity

**Go/no-go:** The exact release commit must pass reproducible automated checks.

- [ ] Clean install from the lockfile succeeds with Node version required by the repository.
- [ ] Web lint passes.
- [ ] Web TypeScript check passes.
- [ ] Production web build passes.
- [ ] Automated unit tests pass.
- [ ] Automated integration/authorization tests pass.
- [ ] Database migration validation passes.
- [ ] Secret scan passes, including Git history review for known exposed credentials.
- [ ] Dependency vulnerability review is completed and documented.
- [ ] License review is completed for production dependencies.
- [ ] CI status is required before production deployment can start.

**Required evidence:** immutable CI run URL tied to the release SHA, build output, test report, scan reports.

---

## Gate 2 — Authentication, authorization and session security

**Go/no-go:** Every route and action must enforce both capability and record scope.

- [ ] A route/action authorization matrix exists for all pages, server actions, APIs, RPCs, exports and document routes.
- [ ] Every protected page has an explicit server-side capability check.
- [ ] Every service-role query validates the requested record/application against the current user's allowed scope first.
- [ ] Customer, intermediary, claim, task, policy, vehicle, employee and document visibility matches the approved role matrix.
- [ ] Self, hierarchy and organization-wide access are tested for all relevant roles.
- [ ] Direct URL and crafted-request tests cannot bypass hidden navigation.
- [ ] Inactive, deleted, missing-profile and unsupported-role users are denied.
- [ ] Access and refresh cookie flags are verified in production.
- [ ] Session refresh, expiry, logout and password recovery are tested.
- [ ] Privileged account creation/role changes require approved controls and audit records.
- [ ] MFA policy for privileged users is approved and enabled where required.

**Mandatory negative tests:** unrelated intermediary application ID, unrelated customer, unrelated claim, unrelated document ID, direct server-action invocation, inactive account.

---

## Gate 3 — Sensitive data, privacy and application security

**Go/no-go:** Full Aadhaar/PAN/bank secrets must not leak to unauthorized users or the browser.

- [ ] Full Aadhaar is absent from HTML, RSC payloads, network responses, browser memory/state and logs after initial submission.
- [ ] Aadhaar/PAN/bank values are masked according to approved policy in every UI/export/report.
- [ ] Dedicated encryption key is configured; service-role key is not the long-term data-encryption fallback.
- [ ] Encryption-key rotation and recovery are tested.
- [ ] Logs, analytics, audit records and error messages are reviewed for PII/secrets.
- [ ] Raw SQL, provider, constraint and stack errors never reach users.
- [ ] CSP, HSTS, frame policy, referrer policy, no-sniff and permissions policy are verified on the deployed site.
- [ ] Internal portal and previews use approved `noindex/noarchive` behavior.
- [ ] CSRF/origin behavior is reviewed for session and mutation routes.
- [ ] Rate limits and abuse controls are enabled for login, invites, uploads, external APIs and costly operations.
- [ ] Legal/compliance owner approves data collection, consent, retention, deletion and document access policy.

**Required evidence:** browser network capture with safe test data, header scan, log samples, key-rotation result, compliance sign-off.

---

## Gate 4 — Database, RLS, migrations and data integrity

**Go/no-go:** Repository schema, live schema and business invariants must agree.

- [ ] Supabase migration history is compared with the repository migration directory.
- [ ] All required migrations are applied in staging and production in the approved order.
- [ ] Schema drift report is reviewed, including constraints, defaults, indexes, triggers, functions and policies.
- [ ] RLS is enabled and tested for every sensitive table and storage object path.
- [ ] `SECURITY DEFINER` functions use a safe fixed `search_path` and explicit authorization.
- [ ] Partner/POSP/MISP one-linked-account invariant is enforced by database constraints/transactions.
- [ ] Partner activation and linked-account creation are atomic and idempotent.
- [ ] Claim workflow transitions are validated against the canonical transition model.
- [ ] Duplicate and rapid-submit tests create no duplicate identities, registrations, profiles, documents or tasks.
- [ ] Foreign keys, unique indexes and high-traffic query indexes are verified.
- [ ] Migration rollback/forward-fix plan is documented for the release.
- [ ] Data repair/backfill scripts are rehearsed on a production-like copy.

**Required evidence:** migration history export, schema diff, RLS test matrix, transaction/failure-injection tests, integrity SQL results.

---

## Gate 5 — Documents, storage and file security

**Go/no-go:** Uploaded identity and claim documents must remain private and safe to open.

- [ ] All sensitive buckets are private.
- [ ] Document read/open routes validate capability and record scope.
- [ ] Signed URLs are short-lived and not logged or reused.
- [ ] Server validates file signature, size, extension, MIME and allowed document type.
- [ ] Malware/quarantine workflow is enabled and tested.
- [ ] Unsafe PDF/image content policy is approved.
- [ ] Replaced/deleted files are cleaned without deleting files still referenced elsewhere.
- [ ] Filename/path handling prevents traversal, collision and header injection.
- [ ] Upload interruption, retry and duplicate behavior are tested.
- [ ] Storage retention, deletion, backup and restore are documented.

**Required evidence:** storage policy export, malicious/spoofed upload tests, signed URL test, cleanup/restore test.

---

## Gate 6 — Business workflow correctness

**Go/no-go:** Each critical business journey must pass with normal, partial and failure states.

### Partner/POSP/MISP

- [ ] Individual Partner can create only one linked POSP.
- [ ] Business Partner can create only one linked MISP.
- [ ] Partner pages show only primary details and Partner documents.
- [ ] POSP and MISP both follow training, exam, agreement and IIB stages.
- [ ] Normal onboarding generates canonical IDs correctly.
- [ ] Legacy onboarding preserves manual Partner and registration IDs.
- [ ] Partial legacy stages remain partial and do not become active automatically.
- [ ] Registered IIB state cannot regress.
- [ ] Document requirements are consistent across edit, review, portal and activation checks.
- [ ] Rapid repeated actions remain idempotent.

### Customer/fleet/policies

- [ ] Customer create/edit/search and ownership scope pass.
- [ ] Vehicle create/edit/register and expiry fields pass.
- [ ] Policy create/edit/renewal dates and insurer linkage pass.
- [ ] Duplicate identifiers and invalid relationships are blocked safely.

### Claims/tasks

- [ ] Claim creation/intimation and every allowed stage transition pass.
- [ ] Disallowed and out-of-order transitions fail safely.
- [ ] Required document verification/rejection/re-upload passes.
- [ ] Claim history and audit trail remain complete after failures.
- [ ] Task assignment, overdue logic and completion pass by role/scope.

**Required evidence:** signed UAT scripts/results with record IDs and cleanup plan.

---

## Gate 7 — External integrations

**Go/no-go:** Required integrations must work in production configuration, not only UAT.

### iCall

- [ ] Final production portal origin is approved and present in vendor `frame-ancestors`.
- [ ] Vendor session cookie is verified as `SameSite=None; Secure; HttpOnly` where applicable.
- [ ] Production endpoint, token, IP allowlist and environment separation are confirmed.
- [ ] UAT credentials exposed during setup are rotated.
- [ ] AWS Lightsail gateway code matches the approved release and service is restarted successfully.
- [ ] Gateway health, TLS renewal, firewall, rate limit, logs and alerts are verified.
- [ ] SSO URLs are always fresh and never reused.
- [ ] Iframe and new-tab training flows both pass through completion/status sync.

### Email/auth delivery

- [ ] Invite, resend, recovery and expiry behavior pass with the production sender/domain.
- [ ] Bounce/failure handling and support recovery procedure are documented.

**Required evidence:** vendor confirmation, production-like test captures, gateway status/logs with secrets redacted.

---

## Gate 8 — UX, accessibility and responsive quality

**Go/no-go:** All critical journeys must be understandable and operable without a mouse.

- [ ] Every visible navigation destination is implemented or intentionally hidden.
- [ ] Loading, empty, success, validation, error, retry and offline/timeout states are present.
- [ ] High-impact actions have pending states, duplicate-submit protection and confirmation where appropriate.
- [ ] Dialogs have initial focus, focus trap, Escape, return focus and background blocking.
- [ ] Forms have labels, instructions, field-level errors and a recoverable summary.
- [ ] Journey/status components use semantic ordered structures and current-step state.
- [ ] Keyboard-only and screen-reader journeys pass.
- [ ] Contrast, focus visibility, touch targets and text sizing pass.
- [ ] 320px mobile, tablet, desktop, 200% zoom and long-content tests pass.
- [ ] Reduced-motion behavior is verified.
- [ ] Terminology is consistent: Partner, POSP, MISP, customer, claim and status labels.
- [ ] Account-review findings F3, F4, F5, F6, F7, F9, F10 and F11 are closed.

**Required evidence:** browser/device matrix, accessibility report, screenshots/video, issue links.

---

## Gate 9 — Performance, scale and concurrency

**Go/no-go:** Expected production volume and concurrency must stay within agreed limits.

- [ ] Large registers use database-side search/filter/sort/range pagination.
- [ ] Query plans and indexes are reviewed for critical pages.
- [ ] Dashboard RPC/fallback behavior is load-tested.
- [ ] Upload and PDF/Excel workflows are measured for memory and timeout limits.
- [ ] Server Action/API body limits are minimized to the routes that need them.
- [ ] Bundle analysis identifies oversized client dependencies and routes.
- [ ] Core Web Vitals and server response targets are defined and met.
- [ ] Concurrent rapid submissions and retry storms do not duplicate or corrupt data.
- [ ] External integration timeouts/retries/circuit behavior are tested.

**Required evidence:** load-test report, database explain plans, bundle report, Vercel/Supabase metrics.

---

## Gate 10 — Observability, support and incident response

**Go/no-go:** The team must know when production is failing and how to respond.

- [ ] Structured server logs include correlation/request IDs and redact secrets/PII.
- [ ] Error monitoring captures frontend, Server Action, API, Supabase and integration failures.
- [ ] Uptime checks cover login, authenticated smoke route, Supabase and iCall gateway health.
- [ ] Alerts route to named owners with escalation rules.
- [ ] Audit logs cover privileged and sensitive business actions.
- [ ] Dashboards track error rate, latency, auth failures, upload failures and integration status.
- [ ] Incident severity, communication, containment and recovery runbooks exist.
- [ ] Support can identify a failed action using a user-safe reference ID.

**Required evidence:** test alert, dashboard links, redacted log sample, incident drill result.

---

## Gate 11 — Backup, restore and disaster recovery

**Go/no-go:** A backup is accepted only after a restore is proven.

- [ ] Supabase backup/PITR configuration and retention are documented.
- [ ] Storage/document backup and retention are documented.
- [ ] Encryption keys and required configuration have secure recoverable backups.
- [ ] RPO and RTO are approved by the business owner.
- [ ] Database restore is rehearsed in an isolated environment.
- [ ] Restored database and storage references are reconciled.
- [ ] Partner/registration identity sequences remain correct after restore.
- [ ] AWS gateway rebuild procedure is tested from source/configuration.

**Required evidence:** dated restore drill report, integrity checks, measured RPO/RTO.

---

## Gate 12 — Deployment, smoke test and rollback

**Go/no-go:** A deploy-hook response alone is never a successful release.

- [ ] Production deployment is triggered only after all previous mandatory gates pass.
- [ ] Vercel final state is `Ready` for the exact release SHA.
- [ ] Production environment variables are present, correctly scoped and secret values are not client-exposed.
- [ ] Required Supabase migrations are confirmed applied before traffic uses new code.
- [ ] Smoke tests pass for login, dashboard, core registers, one read-only detail and one safe mutation.
- [ ] CSP/headers and robots policy are verified on the deployed origin.
- [ ] iCall/gateway health is verified if included in the release.
- [ ] Previous known-good deployment and rollback command/process are ready.
- [ ] Database changes have a compatible rollback or forward-fix plan.
- [ ] Release notes, known issues and support contacts are published internally.

**Required evidence:** Vercel deployment URL/status, smoke report, migration evidence, header capture, rollback target.

---

## Gate 13 — Final business UAT and release approval

**Go/no-go:** Technical readiness does not replace business acceptance.

- [ ] Named representatives test each role they own.
- [ ] Normal and legacy Partner/POSP/MISP journeys pass.
- [ ] Customer/fleet/policy and claims journeys pass with realistic data.
- [ ] Reports/navigation scope matches the approved launch scope.
- [ ] Data/privacy/compliance owner signs off.
- [ ] Operations owner signs off on support and incident readiness.
- [ ] Release owner records final GO/NO-GO decision.

### Final decision

- Decision: GO / NO-GO
- Decision time:
- Approved by:
- Conditions/accepted risks:
- Release SHA:
- Migration state:
- Deployment result:
- Post-release monitoring owner:

---

## First 24 hours after release

- [ ] Monitor authentication, error rate, latency, database load and document failures.
- [ ] Monitor duplicate identity/registration creation and failed workflow transitions.
- [ ] Monitor iCall gateway/SSO errors and vendor responses.
- [ ] Review audit logs for unexpected privileged activity.
- [ ] Confirm backups/PITR remain healthy after migrations.
- [ ] Hold a release review and record only validated outcomes and reusable learnings.
