# INSUREIT Web Portal Production Readiness Audit

> **Audit date:** 2026-08-02 (IST)
>
> **Repository:** `Frontier-Group-IT/insureit_new`
>
> **Audited application:** `apps/web-portal`
>
> **Audit mode:** Source and repository configuration review. This report does not claim that Vercel, Supabase, AWS Lightsail, browser behavior, migrations, backups, or third-party production integrations were verified live.

## 1. Release recommendation

**Original 2026-08-02 recommendation: NO-GO for production.**

At the time of the audit, production release was blocked by the severity-4 security and data-integrity findings below. The remediation update records their later source status; deployment and live verification remain separate evidence gates.

A release is allowed only when every mandatory checkpoint in `docs/PRODUCTION_RELEASE_CHECKLIST.md` has evidence and no open severity-4 finding remains.

### Severity-4 remediation update (2026-08-12)

**IMPLEMENTED:** the five severity-4 source findings recorded by this audit are closed in the current release candidate. This status does not by itself prove deployment, live authorization behavior, migration state, or completion of the remaining release checklist.

- **PR-01:** intermediary workflow pages remove encrypted Aadhaar values before constructing client props and expose only last-four/existence state.
- **PR-02:** intermediary account review, workflow layout/page, document upload, document open, activation, and record mutations enforce application/intermediary hierarchy scope before privileged reads or writes.
- **PR-03:** the customer register resolves `getAccessibleCustomerIds(...)` and applies the resulting ID filter before the service-role query returns rows.
- **PR-04:** Partner activation uses the atomic, idempotent `finalize_partner_activation_v2(...)` database function and reports success only when a permanent Partner ID is returned.
- **PR-05:** the legacy `updateClaimStatus(...)` wrapper delegates to `advanceClaimWorkflow(...)`, which enforces claim-stage capability and canonical transition rules.

Regression evidence is maintained by `apps/web-portal/scripts/release-blocker-security-regression.mjs` and the compulsory GitHub verification workflow. A production decision still requires a green run for the exact release commit plus final Vercel and live-route checks.

## 2. Audit scope

The review covered representative and high-risk areas across:

- Authentication, browser sessions, middleware, route protection and role capabilities
- Service-role usage and record-level authorization
- Partner, POSP, MISP and legacy onboarding workflows
- Customer, vehicle, policy, claim and task registers
- Sensitive identity data and document handling
- Supabase functions, RLS patterns and migration governance
- iCall gateway, SSO, iframe and vendor dependencies
- UI structure, navigation, accessibility and responsive behavior
- Performance and data-loading patterns
- CI, deployment, rollback, observability, backup and release governance

The mobile application was not included in this website audit and needs its own release review.

## 3. Severity scale

- **Severity 4 — Release blocker:** credible risk of unauthorized access, sensitive-data exposure, financial/identity corruption, destructive workflow failure, or production outage.
- **Severity 3 — High priority:** major operational, compliance, reliability, accessibility or scalability risk that should normally be resolved before release.
- **Severity 2 — Important:** meaningful usability, maintainability or hardening issue that can be scheduled only with an explicit accepted-risk decision.
- **Severity 1 — Minor:** low-impact polish or documentation improvement.

## 4. Executive summary

### Confirmed release blockers

1. Full Aadhaar values are decrypted and serialized into client components; browser-side DOM masking is only cosmetic.
2. Privileged intermediary review, workflow, upload and activation paths use role-level authorization without verifying access to the requested application ID.
3. The customer register uses a service-role query without employee/hierarchy scoping even though scoped roles can view customers.
4. Partner activation is a multi-step privileged mutation that is not atomic and ignores errors from final state updates.
5. A legacy claim-status server action can change workflow state without calling the claim permission guard.

### Other high-priority release risks

- No enforced CI workflow, automated test suite or commit status gate is visible on `main`.
- iCall iframe SSO still depends on a vendor cookie change and final production-origin configuration.
- Raw Supabase/database/provider errors are rendered in several user-facing paths.
- Application pages inconsistently rely on explicit capability guards, RLS, service-role queries and organizational scope.
- File upload checks trust the browser MIME label and do not provide content-signature or malware scanning.
- Audit logging, security documentation and schema documentation have not kept pace with the live role/workflow model.
- Reports is an exposed but empty production route.
- Several registers fetch all accessible rows and filter/paginate in application memory.
- Production migration state, rollback, monitoring, alerting and restore capability remain unverified.

## 5. Detailed findings

### PR-01 — Full Aadhaar data reaches the browser

- **Severity:** 4
- **Area:** Sensitive data / privacy
- **Locations:**
  - `apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx`
  - `apps/web-portal/components/aadhaar-mask-normalizer.tsx`
- **Evidence:** The workflow page decrypts `aadhaar_number_encrypted`, adds the full value to `editProfile`, and passes it to client components. A global client-side mutation observer later changes visible `<dd>` text to the last four digits.
- **Impact:** The complete Aadhaar value can exist in the React Server Component payload, browser memory, component props, developer tools or transient DOM before/independent of masking. Visual replacement is not data minimization.
- **Required fix:** Never serialize full Aadhaar to the client after initial collection. Send only last four digits and a boolean indicating whether a value exists. Replace edits through a dedicated server action that accepts a newly entered number, validates/encrypts it server-side, and never returns it. Any exceptional reveal flow must require explicit business approval, step-up authentication, authorization and audit logging.
- **Acceptance test:** Browser network responses, page source, React payloads, DOM, logs and client state contain no complete Aadhaar number for review/edit pages.

### PR-02 — Record-level intermediary authorization is bypassed

- **Severity:** 4
- **Area:** Authorization / service-role access
- **Locations:**
  - `apps/web-portal/app/intermediaries/applications/[id]/page.tsx`
  - `apps/web-portal/app/intermediaries/applications/[id]/workflow/page.tsx`
  - `apps/web-portal/app/api/intermediary-documents/upload/route.ts`
  - `apps/web-portal/app/api/intermediary-documents/finalize/route.ts`
- **Evidence:** These paths call `requirePospMispManager()` and then use the Supabase service-role client against an application ID supplied by the route or request. The repository already has `requireApplicationReviewer(applicationId)`, which validates employee/hierarchy scope, but these paths do not use it.
- **Impact:** A user with a permitted role may be able to enumerate or act on an intermediary application outside their assigned scope by changing an ID.
- **Required fix:** Resolve the application ID first, call `requireApplicationReviewer(id)` before every service-role read or mutation, and repeat ownership/scope validation inside high-impact server actions and route handlers. Add negative authorization tests for self, hierarchy, organization-wide and unrelated records.
- **Acceptance test:** Every unauthorized cross-scope read, upload, finalize or linked-account action returns access denied and creates no side effect.

### PR-03 — Customer register bypasses employee/hierarchy scope

- **Severity:** 4 pending confirmed business access matrix
- **Area:** Customer privacy / authorization
- **Location:** `apps/web-portal/app/customers/page.tsx`
- **Evidence:** The page checks `view_customers`, then uses the service-role client to load the complete customer register including phone numbers. Other registers such as vehicles and policies explicitly apply `getEmployeeAccessScope()`.
- **Impact:** Relationship managers, agents or other non-organization-wide roles may see customers outside their ownership or reporting hierarchy.
- **Required fix:** Approve a written role-to-record visibility matrix. Apply the same employee/hierarchy scope helper to customer reads, counts, search, export, detail pages and mutations. Do not use UI filtering as authorization.
- **Acceptance test:** Test accounts for every role can see exactly the approved customer set and cannot retrieve unrelated records through direct URLs, server actions, API calls or exports.

### PR-04 — Partner activation is not atomic

- **Severity:** 4
- **Area:** Data integrity / identity issuance
- **Location:** `apps/web-portal/app/api/intermediary-documents/finalize/route.ts`
- **Evidence:** The route issues a Partner identity, synchronizes the intermediary register, then updates profile and application rows in separate calls. The final update results are not checked.
- **Impact:** A timeout or partial failure can issue an identity while leaving profile, application and register states inconsistent. Repeated requests may duplicate or incorrectly advance records.
- **Required fix:** Move the complete activation into one idempotent PostgreSQL function/transaction with row locking, invariant checks, deterministic result handling and an audit record. Return success only after every state is committed.
- **Acceptance test:** Forced failures at every internal step roll back all changes. Repeated identical requests return the existing result without duplicate IDs or rows.

### PR-05 — Legacy claim-status action lacks a permission guard

- **Severity:** 4 until removed or proven unreachable and guarded
- **Area:** Workflow authorization
- **Location:** `apps/web-portal/app/actions.ts` (`updateClaimStatus`)
- **Evidence:** Newer claim workflow actions call `requireClaimStagePermission()`, but `updateClaimStatus` reads the current profile ID and updates claim status/history without calling the role/capability guard.
- **Impact:** Any remaining form, imported binding or future reuse can expose an unrestricted workflow transition path, subject only to RLS behavior.
- **Required fix:** Remove the obsolete action or add the same explicit permission, record-scope and allowed-transition enforcement as the canonical workflow action. Search the complete repository and generated bundles for references.
- **Acceptance test:** Unauthorized roles cannot invoke any claim transition action, including by crafting a direct Server Action request.

### PR-06 — Authorization strategy is inconsistent across routes

- **Severity:** 3
- **Area:** Defense in depth
- **Examples:** Claims, claim details and tasks rely primarily on the authenticated Supabase client/RLS, while other pages use explicit capability checks; privileged pages use service-role clients; some registers apply hierarchy scope and others do not.
- **Impact:** Security behavior depends on scattered assumptions and is difficult to test or reason about. A future RLS or page change can silently broaden access.
- **Required fix:** Create a route/action authorization inventory stating required capability, record scope, RLS policy and service-role justification. Require explicit server-side capability checks for protected pages/actions and RLS as a second layer.
- **Acceptance test:** The inventory covers every page, route handler, server action, RPC and storage operation, with automated positive and negative tests.

### PR-07 — Encryption key separation is incomplete

- **Severity:** 3
- **Area:** Cryptographic key management
- **Location:** `apps/web-portal/lib/sensitive-data.ts`
- **Evidence:** Decryption attempts keys derived from both `POSP_MISP_DATA_ENCRYPTION_KEY` and `SUPABASE_SERVICE_ROLE_KEY`.
- **Impact:** A database administrative secret can also become a data-encryption secret, increasing blast radius and complicating rotation/revocation.
- **Required fix:** Require a dedicated versioned encryption key, document rotation, re-encrypt legacy data, verify recovery, and remove the service-role fallback after migration.
- **Acceptance test:** Production decrypts all valid records using dedicated managed key material; removing/rotating the service-role key does not affect encrypted data.

### PR-08 — Uploaded files are not verified by content

- **Severity:** 3
- **Area:** Document security
- **Location:** `apps/web-portal/app/api/intermediary-documents/upload/route.ts`
- **Evidence:** The route checks the browser-provided MIME type and size, but does not inspect magic bytes, normalize images/PDFs, scan malware or reject active PDF content.
- **Impact:** A renamed or crafted file can be stored as a trusted identity document and later opened by staff.
- **Required fix:** Validate content signatures server-side, scan files, define safe PDF/image handling, quarantine until scanning completes, use safe download headers, and log rejection without exposing scanner internals.
- **Acceptance test:** EICAR/test malware, MIME-spoofed files, oversized/decompression-bomb files and unsupported content are rejected or quarantined.

### PR-09 — Raw technical errors reach users

- **Severity:** 3
- **Area:** Error handling / information disclosure
- **Examples:** Login displays Supabase auth/profile messages; vehicles, policies, claims and users render database errors; account review and the global success popup decode/render `error` query values; upload/finalize paths return underlying database messages.
- **Impact:** Users receive confusing recovery guidance and may see provider names, schema details, constraint names or internal implementation text.
- **Required fix:** Use stable error codes and user-safe messages. Keep raw errors in structured server logs with correlation IDs. Never put arbitrary provider/database text in query strings.
- **Acceptance test:** Simulated auth, constraint, network, storage and RPC failures show safe messages and a support reference without SQL/provider internals.

### PR-10 — Audit logging is incomplete and documentation is stale

- **Severity:** 3
- **Area:** Compliance / traceability
- **Locations:** `docs/security-notes.md`, `docs/database-schema.md`, workflow actions
- **Evidence:** Security notes say application-level audit insertion still needs to be added. Security/schema documentation lists only the original role set and does not reflect current Partner/POSP/MISP, hierarchy and integration workflows.
- **Impact:** High-impact changes may not be reconstructable, and operators may make decisions from obsolete security documentation.
- **Required fix:** Define mandatory audit events for authentication administration, role changes, identity issuance, workflow transitions, sensitive-data changes, document verification, portal invitations and integration handoffs. Update docs from the current schema and enforce audit writes transactionally.
- **Acceptance test:** A production-like end-to-end journey produces a complete immutable actor/time/action/before/after trail without storing prohibited full sensitive values.

### PR-11 — No enforced CI or automated test gate is visible

- **Severity:** 3
- **Area:** Engineering quality
- **Evidence:** Package scripts include build, lint and typecheck but no test suite. No general CI workflow or commit status was found for the audited `main` commit. The production workflow only requests a Vercel deploy.
- **Impact:** A commit can reach the production trigger without automated compile, type, lint, security, migration or behavior checks.
- **Required fix:** Add required CI for install lockfile integrity, lint, typecheck, production build, unit tests, integration tests, migration checks, secret scan, dependency audit and critical authorization tests. Protect production deployment so it accepts only a validated commit SHA.
- **Acceptance test:** A deliberately broken type, lint rule, authorization test and migration all block merge/deployment.

### PR-12 — iCall production handoff is incomplete

- **Severity:** 3; severity 4 if embedded training is mandatory at launch
- **Area:** External integration
- **Evidence:** The iframe renders, but SSO authentication is not retained because the vendor cookie uses `SameSite=Lax`. Final production origin, production endpoint/token behavior and vendor allowlisting remain unresolved.
- **Required fix:** Obtain vendor confirmation and verify `SameSite=None; Secure`, final `frame-ancestors` origin, production API credentials/endpoints, IP allowlisting and fresh single-use SSO behavior. Rotate exposed UAT credentials and verify gateway patching/TLS/service monitoring.
- **Acceptance test:** A fresh production-like user opens training in iframe and new tab, remains authenticated through the journey, returns safely, and syncs status without reusing URLs.

### PR-13 — Reports is an exposed empty route

- **Severity:** 3
- **Area:** Product completeness
- **Location:** `apps/web-portal/app/reports/page.tsx`
- **Evidence:** The page renders only an empty labelled div while navigation exposes the Reports workspace to multiple roles.
- **Impact:** Users encounter a dead product area and cannot trust navigation completeness.
- **Required fix:** Implement the approved reports scope or hide/feature-flag the route and navigation until ready.
- **Acceptance test:** Every visible navigation destination has meaningful loading, success, empty, error and permission states.

### PR-14 — Large registers use unbounded in-memory filtering

- **Severity:** 3
- **Area:** Performance / scalability
- **Examples:** Claims and tasks load all accessible rows before search/filter; customer register loads all rows; claims pagination is applied after the full query.
- **Impact:** Response time, memory use and database transfer grow with the entire dataset and can expose more data to the application layer than needed.
- **Required fix:** Use database-side search, filters, indexed sort and range pagination. Set maximum page sizes and include total counts separately. Load only required columns.
- **Acceptance test:** Load testing with expected three-year data volume remains within agreed latency, memory and database thresholds.

### PR-15 — Production deployment proves request acceptance, not release success

- **Severity:** 3
- **Area:** Deployment / rollback
- **Location:** `.github/workflows/deploy-production.yml`
- **Evidence:** The workflow calls a Vercel deploy hook and explicitly states that this only proves Vercel accepted the request.
- **Impact:** A failed build or unhealthy deployment can be mistaken for a successful release. No automated smoke test or rollback gate is shown.
- **Required fix:** Tie deployment to a validated commit, poll final deployment state, execute smoke tests, record artifact/commit/migration versions, and document one-command rollback plus database forward-fix strategy.
- **Acceptance test:** A deliberately failing Vercel build and failing smoke test both mark the release failed and preserve/restore the previous production version.
- **PARTIALLY REMEDIATED 2026-08-22:** deployment now validates and reuses one successful feature-PR verification run for an exact commit merged into the current `main` snapshot, eliminating repeated full CI gates. The workflow still stops after Vercel accepts the hook; final Vercel polling, automated smoke tests and rollback remain open under this finding.

### PR-16 — Monitoring, alerting, backup and restore evidence is missing

- **Severity:** 3 release gate; source defect not asserted
- **Area:** Operations / disaster recovery
- **Evidence:** No production observability, alert routing, backup/restore rehearsal or incident runbook was established by the inspected repository configuration and documentation.
- **Impact:** Authentication failures, permission denials, integration outages, data corruption or deployment regressions may go undetected or be unrecoverable within an acceptable time.
- **Required fix:** Define logs, metrics, traces, uptime checks, alert owners, retention/redaction, Supabase backup/PITR policy, storage backup approach, RPO/RTO and a tested restore procedure.
- **Acceptance test:** A staged outage generates the correct alert; a restore drill meets documented RPO/RTO and validates record/document consistency.

### PR-17 — Previously identified account-review UX/accessibility defects remain open

- **Severity:** 3
- **Area:** UX / accessibility / error prevention
- **Evidence:** The durable handoff records unresolved findings for workflow-truth calculation, document inventory/status, pending and confirmation states, keyboard-complete dialogs, safe errors, navigation, journey semantics and text/control sizing.
- **Required fix:** Implement the approved F3, F4, F5, F6, F7, F9, F10 and F11 groups without changing business-state rules, then run focused desktop/mobile/keyboard verification.
- **Acceptance test:** Complete the matrix in `docs/CURRENT_CHAT_HANDOFF.md`, including legacy/normal records, GST/no-GST, repeated submissions, long content and dialog keyboard behavior.

### PR-18 — Document review visuals can misrepresent state

- **Severity:** 2
- **Area:** Recognition / trust
- **Location:** `apps/web-portal/components/document-visual-card.tsx`
- **Evidence:** Aadhaar back maps to a PAN image; a stored file defaults to “Uploaded” regardless of verification state; static cards lift/zoom like links; filename/meta props are not rendered; badge text is very small.
- **Required fix:** Use accurate visuals, explicit pending/verified/rejected/changes-requested states, file details and non-clickable presentation for static cards.
- **Acceptance test:** Users can identify document type, actual status, filename/date and available action without hover or inference.

### PR-19 — Navigation and typography need production accessibility pass

- **Severity:** 2
- **Area:** Accessibility / responsive UI
- **Evidence:** Several navigation/dashboard labels are approximately 9–10.5px; nested navigation buttons lack clearly visible expanded-state semantics; labels include “Intermediatory” and “All Partner”; active navigation is partly inferred from page-title text and Claims passes dashboard as active navigation.
- **Strength:** Global CSS includes strong focus styling and a `prefers-reduced-motion` fallback.
- **Required fix:** Meet approved minimum text/touch sizes, add `aria-expanded`/relationships, correct terminology, derive active navigation from route metadata, and verify zoom/contrast/reflow.
- **Acceptance test:** Keyboard-only, screen-reader, 200% zoom and 320px width tests pass without clipped controls or ambiguous navigation state.

### PR-20 — Internal portal indexing policy is not explicit

- **Severity:** 2
- **Area:** Privacy / discoverability
- **Evidence:** Root metadata defines title/description, but no explicit `robots` metadata/route was found during this audit.
- **Impact:** Authentication pages and route names may be indexed or cached by search engines even though data remains protected.
- **Required fix:** Add `noindex, nofollow, noarchive` headers/metadata for the internal portal and confirm Vercel preview environments are protected.
- **Acceptance test:** Production and preview responses expose the approved robots policy and no private content is cacheable publicly.

### PR-21 — User creation controls are below production policy

- **Severity:** 2
- **Area:** Account administration
- **Locations:** `apps/web-portal/app/users/page.tsx`, `supabase/functions/create-user/index.ts`
- **Evidence:** The function accepts six-character temporary passwords and commonly confirms email immediately. Deactivation/reactivation lacks a strong confirmation step. Some function logs include user/profile context.
- **Required fix:** Use invite/reset-first activation instead of administrator-known permanent passwords, enforce an approved password/MFA policy, confirm destructive role/status changes, and redact PII from logs.
- **Acceptance test:** New users set their own secret through an expiring invite; privileged changes are audited and cannot be performed accidentally.

### PR-22 — Intermediary portal completion can be misleading

- **Severity:** 2
- **Area:** Workflow truth
- **Location:** `apps/web-portal/app/intermediary-portal/page.tsx`
- **Evidence:** Document completion is derived from whether any document exists, not whether all required documents and verification states are complete. Primary information is always displayed as completed.
- **Required fix:** Reuse one canonical requirement/status helper across staff review, customer portal and activation validation.
- **Acceptance test:** Portal progress exactly matches server-side eligibility for normal, legacy, GST and non-GST records.

## 6. Strengths to preserve

- Centralized roles and capabilities provide a good base for explicit authorization.
- `getEmployeeAccessScope()` models organization, hierarchy and self access and is already used by vehicles/policies.
- The repository contains a record-level `requireApplicationReviewer()` helper ready for broader adoption.
- Service-role client and sensitive-data crypto modules are marked `server-only`.
- Private claim documents are opened through short-lived signed URLs.
- Security headers include CSP, HSTS in production, frame denial, no-sniff and a restrictive permissions policy.
- Login and several forms include visible pending/disabled states.
- File uploads enforce a 4 MB size limit and a small declared type allowlist.
- Some migrations demonstrate careful user-owned RLS policy design.
- Global styling includes visible focus states and reduced-motion handling.
- Production deployment is intentionally explicit and batched rather than triggered by every ordinary commit.
- Repository context correctly distinguishes a committed migration from an applied migration.

## 7. Required remediation order

### Phase A — Security and integrity blockers

1. Remove full Aadhaar from every client payload.
2. Enforce application/record scope on every privileged intermediary path.
3. Apply and test the approved customer/claim/task visibility matrix.
4. Make Partner activation and other identity/registration operations atomic and idempotent.
5. Remove or guard legacy workflow mutation paths.

### Phase B — Release engineering and operational safety

1. Add CI, automated authorization tests and required status checks.
2. Reconcile/apply migrations on a production-like clone.
3. Implement audit logging and safe error handling.
4. Add document content scanning.
5. Establish observability, backup, restore and rollback evidence.

### Phase C — Product and integration readiness

1. Resolve and verify iCall production SSO.
2. Implement or hide incomplete routes such as Reports.
3. Move register search/filter/pagination into the database.
4. Complete the approved account-review UX/accessibility work.
5. Execute full role-based UAT and production rehearsal.

## 8. What this audit did not verify

The following require environment access and evidence before release:

- Actual Supabase migration history, constraints, RLS policies, function definitions and storage policies
- Production/preview Vercel environment variables and final deployment health
- Secret rotation status and absence of leaked credentials in history/logs
- AWS Lightsail patch level, firewall, TLS renewal, service restart and monitoring
- iCall vendor cookie/origin/IP/production-token configuration
- Browser behavior on supported devices and assistive technologies
- Load, concurrency, race-condition and failure-injection behavior
- Supabase backups, point-in-time recovery and storage restore
- Email delivery, invite/recovery links and domain configuration
- Legal/compliance approval for Aadhaar/PAN/bank/document handling and retention

## 9. Production decision rule

Production is **GO** only when:

- every severity-4 finding is closed with test evidence;
- every mandatory checklist item is marked PASS with an owner and evidence link;
- accepted severity-2/3 risks are written, time-bound and approved by the accountable owner;
- the exact release commit, migration set, environment configuration and rollback target are recorded;
- a final production-like UAT and restore rehearsal pass;
- the final Vercel deployment is verified healthy after release.
