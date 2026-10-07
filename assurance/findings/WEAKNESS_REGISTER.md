# INSUREIT Internal Weakness Register

> Internal authorized production-assurance workstream. This file contains sanitized evidence only: no secrets, raw customer PII, access tokens, document contents, or exploit payloads.
>
> Audit started: 2026-10-07
> Production Supabase project assessed: `ilzhsfqqjyppzzvfscmh`
> Evidence rule: a finding is only marked VERIFIED when supported by direct configuration, source, or non-destructive runtime evidence.

## Status model

`OPEN -> REMEDIATION PLANNED -> FIXED -> RETEST PENDING -> VERIFIED CLOSED`

## Severity model

- **Critical** — unauthenticated/low-privilege path can materially alter privileged business/security state, or equivalent catastrophic exposure.
- **High** — material confidentiality/integrity/authorization weakness.
- **Medium** — meaningful weakness with constrained impact or additional conditions.
- **Low** — hardening issue with limited direct impact.
- **Observation** — noteworthy control state that is not currently proven vulnerable.

## Findings

### INS-SEC-001 — Public SECURITY DEFINER onboarding audit view exposes internal onboarding metadata
- **Severity:** Medium
- **Status:** OPEN
- **Component:** Supabase / PostgreSQL / Data API
- **Object:** `public.intermediary_onboarding_cutover_audit`
- **Evidence:**
  - View owned by `postgres`; Supabase advisor flags it as a Security Definer View.
  - `anon` and `authenticated` currently have SELECT.
  - Runtime validation under `SET LOCAL ROLE anon` returned **118 visible rows**.
  - Projection includes onboarding application identifiers, requested type, status, creation time, document/contact counts, historical-copy indicator and PAN-job indicator.
- **Impact:** unauthenticated disclosure of internal onboarding workflow metadata and identifiers; supports reconnaissance and violates least privilege.
- **Recommended remediation:** revoke direct `anon`/unnecessary `authenticated` SELECT; replace with explicit scoped RPC/view using `security_invoker=true` where user access is genuinely required.
- **Retest:** anonymous and unrelated authenticated principals must receive zero rows / permission denied; intended internal role must retain authorized access.

### INS-SEC-002 — Cleanup view is anonymously selectable and projects high-sensitivity customer fields
- **Severity:** High (latent/conditional; currently zero matching rows)
- **Status:** OPEN
- **Component:** Supabase / PostgreSQL / Data API
- **Object:** `public.intermediary_customer_cleanup_candidates`
- **Evidence:**
  - View owned by `postgres`; Supabase advisor flags it as a Security Definer View.
  - `anon` and `authenticated` currently have SELECT.
  - View definition projects customer contact name, company name, phone and PAN number.
  - Current anonymous aggregate test returned **0 rows**, so no live customer values were retrieved.
- **Impact:** if matching rows appear, unauthenticated callers can potentially receive customer phone/PAN-related information through an owner-executed view.
- **Recommended remediation:** revoke client roles immediately; keep this audit/cleanup surface service-role/internal-only or rebuild as a tightly scoped invoker view.
- **Retest:** anonymous/authenticated public clients must be unable to query the view.

### INS-SEC-003 — POSP document storage permits anonymous read and upload
- **Severity:** High; escalate to Critical if controlled classification confirms identity/KYC document content is downloadable anonymously
- **Status:** OPEN
- **Component:** Supabase Storage
- **Bucket:** `posp-documents`
- **Evidence:**
  - Bucket itself is marked private.
  - Storage policy `Allow anon read posp-documents` grants SELECT to `anon` for every object in the bucket.
  - Storage policy `Allow anon upload posp-documents` grants INSERT to `anon` for every object in the bucket.
  - Metadata-only runtime test under `anon` saw **9 objects** in this bucket; other tested private buckets returned zero.
  - Bucket has no configured file-size or MIME allow-list.
- **Impact:** anonymous visibility/upload surface on an onboarding-document bucket; confidentiality, storage abuse, malware/content abuse and cost risks.
- **Recommended remediation:** remove blanket anonymous SELECT/INSERT; require application/session-scoped object paths, short-lived upload authorization where pre-login onboarding is necessary, size/MIME restrictions, and server-side content validation.
- **Retest:** anonymous object listing/read must fail; only authorized scoped upload token/session may write approved types/size.

### INS-SEC-004 — Accounting reconciliation RPC is anonymously executable without session authorization
- **Severity:** Critical
- **Status:** OPEN
- **Component:** PostgreSQL privileged RPC
- **Object:** `public.post_accounts_excel_reconciliation(...)`
- **Evidence:**
  - `SECURITY DEFINER`.
  - EXECUTE currently available to `anon` and `authenticated`.
  - Function body does not bind `p_actor` to `auth.uid()` and only checks that `p_actor` is non-null.
  - Function performs privileged inserts/updates across invoices, receivables, receipts, TDS and partner payments via service-privileged execution.
  - No mutation was executed during the audit.
- **Impact:** privilege boundary is callable without proven authentication; if valid identifiers/payload are supplied, financial/accounting state can be changed under elevated database privileges.
- **Recommended remediation:** revoke PUBLIC/anon/authenticated EXECUTE unless required; expose only through an authorized server-side action or add strict `auth.uid()` binding + capability/role validation inside the RPC. Keep low-level financial helper RPCs non-client-executable.
- **Retest:** anonymous/unprivileged direct RPC execution must be denied before any write path; authorized Accounts role must succeed through intended application path.

### INS-SEC-005 — Partner identity activation/creation RPCs trust caller-supplied actor and are anonymously executable
- **Severity:** Critical
- **Status:** OPEN
- **Component:** PostgreSQL privileged RPC
- **Objects:** `issue_partner_identity`, `issue_legacy_partner_identity`, `ensure_legacy_partner_record`
- **Evidence:**
  - Functions are `SECURITY DEFINER`.
  - EXECUTE currently available to `anon` and `authenticated`.
  - Reviewed definitions do not require `p_actor_id = auth.uid()` and do not perform an equivalent authenticated-capability check before privileged partner activation/creation.
  - Functions update onboarding status and create/link canonical partner/intermediary records.
  - No mutation was executed during the audit.
- **Impact:** direct privileged workflow manipulation risk, including unauthorized partner activation/identity creation.
- **Recommended remediation:** revoke client EXECUTE and/or require authenticated session binding plus explicit approval capability inside each public entry-point. Keep internal helper functions private from PostgREST roles.
- **Retest:** anonymous and unauthorized authenticated callers must be rejected before row locks/writes; approved internal role must pass.

### INS-SEC-006 — Intermediary application queue RPC exposes onboarding records to anonymous callers
- **Severity:** High
- **Status:** OPEN
- **Component:** PostgreSQL privileged reporting RPC
- **Object:** `get_intermediary_application_queue(...)`
- **Evidence:**
  - `SECURITY DEFINER`, executable by `anon`.
  - Definition has no session/role authorization predicate.
  - Return schema includes applicant phone, applicant name, city, external onboarding ID, status and document counts.
  - Runtime aggregate validation under `anon` returned **118 visible rows**.
  - No PII values were retrieved or stored in audit evidence.
- **Impact:** unauthenticated access to onboarding/application information and likely PII.
- **Recommended remediation:** revoke anonymous execute; bind queue access to authenticated approved internal roles and enforce server-side scope.
- **Retest:** anonymous call must fail/return no data; unrelated authenticated roles must fail; intended Operations roles must receive scoped rows.

### INS-SEC-007 — Business reporting RPC exposes production portfolio/financial summary to anonymous callers
- **Severity:** High
- **Status:** OPEN
- **Component:** PostgreSQL privileged reporting RPC
- **Object:** `get_policy_business_report_v4(...)`
- **Evidence:**
  - `SECURITY DEFINER`, executable by `anon`.
  - Function definition performs no authenticated-role authorization check.
  - Anonymous runtime probe successfully returned a report payload with summary/filters/trend/register/insurer/RM sections.
  - Aggregate evidence showed **1,117 policies visible to the report scope** and confirmed `gross_premium` is present in the anonymous summary payload.
  - No policy-level details were retained in audit evidence.
- **Impact:** unauthenticated business-confidential portfolio and financial information disclosure.
- **Recommended remediation:** revoke anonymous/public execute; authorize report access in the function based on authenticated role/scope rather than trusting optional caller-supplied scope arrays.
- **Retest:** anonymous direct call denied; limited-role calls cannot broaden scope; management/report roles receive only authorized portfolio.

### INS-SEC-008 — Excessive anonymous surface across SECURITY DEFINER functions
- **Severity:** High systemic weakness / audit umbrella
- **Status:** OPEN
- **Component:** PostgreSQL function grants
- **Evidence:** current production catalogue contains **327 SECURITY DEFINER functions**, of which **153 are executable by anon** and **222 by authenticated**.
- **Impact:** materially increases privileged attack surface and makes individual authorization mistakes high-impact.
- **Recommended remediation:** inventory every SECURITY DEFINER function, classify trigger/helper/public RPC, revoke default PUBLIC EXECUTE, explicitly grant only required entry points, bind identity inside privileged functions, and move internal helpers to a non-exposed schema.
- **Retest:** zero unintended anon-executable privileged functions; every remaining client RPC has explicit identity/scope tests.

### INS-SEC-009 — Mutable search_path warnings remain on privileged/supporting functions
- **Severity:** Medium hardening
- **Status:** OPEN
- **Component:** PostgreSQL functions
- **Evidence:** current Supabase security advisor reports **20 `function_search_path_mutable` warnings**.
- **Impact:** unpinned name resolution can increase risk in privileged function execution depending on function body/permissions.
- **Recommended remediation:** pin safe `search_path` and schema-qualify referenced objects, prioritizing privileged functions.
- **Retest:** Supabase advisor warning count reduced to zero or documented justified exceptions.

## Control observations

### INS-OBS-001 — Many RLS-enabled/no-policy tables are intentionally service-role-only
The current advisor reports 102 `rls_enabled_no_policy` notices. Review showed a substantial subset have grants only to `postgres` / `service_role`, making RLS-with-no-client-policy an intentional deny-by-default control rather than a vulnerability.

A second subset still has table grants to `anon` / `authenticated`, but with RLS enabled and zero policies direct row access is denied. These should be cleaned up for least privilege, but must not be misreported as proven data exposure without a bypassing view/function.

## Next audit queue
1. Complete classification of all 153 anon-executable SECURITY DEFINER functions.
2. Validate exposed storage buckets and pre-login onboarding design.
3. Audit table/RPC grants against PostgREST exposed schemas.
4. Audit authenticated cross-tenant Customer/Partner access using synthetic test identities.
5. Run current Supabase performance advisor and query hot-path review.
6. Add SAST/SCA/secret-scan/SBOM evidence pipeline.
7. Build deterministic E2E/smoke and controlled load harnesses.


### INS-PERF-001 — Current database advisor backlog can constrain load-test readiness
- **Severity:** Medium performance / certification blocker
- **Status:** OPEN
- **Component:** Supabase PostgreSQL
- **Evidence (2026-10-07 current advisor):**
  - 154 unindexed foreign-key findings.
  - 95 RLS init-plan warnings.
  - 73 multiple-permissive-policy warnings.
  - 176 unused-index notices.
  - 3 duplicate-index warnings.
- **Impact:** avoidable query/RLS overhead and schema complexity can amplify latency under concurrency. Counts alone do not justify adding/removing indexes.
- **Recommended remediation:** prioritize hot paths using query evidence and controlled `EXPLAIN (ANALYZE, BUFFERS)`/load tests; add only proven covering indexes; rewrite expensive RLS auth calls safely; consolidate overlapping policies only after authorization-parity tests; remove duplicates after dependency verification.
- **Retest:** advisor delta documented; hot-path p95/load metrics demonstrate improvement without authorization regression.

### INS-ASSURE-001 — Standard security/supply-chain evidence gates are absent from the repository
- **Severity:** Medium process/control gap; blocks internal certification
- **Status:** OPEN
- **Component:** GitHub CI / software supply chain
- **Evidence:** repository-wide searches on 2026-10-07 returned no implementation hits for CodeQL, Semgrep, Gitleaks, TruffleHog, OWASP ZAP, Trivy, Syft, CycloneDX/SBOM, npm audit or GitHub dependency-review action.
- **Impact:** current custom regressions are valuable but do not provide standard evidence for source scanning, dependency CVEs, committed-secret detection, SBOM inventory or DAST.
- **Recommended remediation:** add reviewed/pinned CI gates for SAST, secret scanning, dependency/SCA + SBOM and authenticated DAST in a non-destructive environment. Preserve existing business regressions.
- **Retest:** tools run on the exact certification commit and produce retained machine-readable + human-readable artifacts with policy-defined pass/fail thresholds.


### INS-SEC-010 — Motor Policy Intake finalization trusts caller-supplied actor metadata
- **Severity:** Critical
- **Status:** OPEN
- **Component:** PostgreSQL privileged RPC / Policy Intake
- **Object:** `finalize_policy_intake_motor_v1(...)`
- **Evidence:**
  - SECURITY DEFINER and executable by `anon`.
  - Actor is derived from `p_payload.meta.requestedBy`, not `auth.uid()`.
  - Authorization only compares the caller-supplied actor UUID to `assigned_to_profile_id`.
  - On success the RPC books a policy, links the policy copy, completes the intake and deletes the draft.
- **Impact:** knowledge of an assigned reviewer UUID plus intake context may allow unauthorized finalization under elevated DB privileges.
- **Recommended remediation:** require authenticated session; derive actor only from `auth.uid()`; verify active profile + policy-create/finalize capability and intake assignment server-side; revoke anon EXECUTE.
- **Retest:** anonymous call rejected before locks/writes; mismatched authenticated reviewer rejected; assigned authorized reviewer succeeds.

### INS-SEC-011 — Group customer link/unlink authorization trusts an arbitrary supplied manager profile ID
- **Severity:** Critical
- **Status:** OPEN
- **Component:** PostgreSQL privileged RPC / Group relationships
- **Objects:** `link_customer_to_group`, `unlink_customer_from_group`, helper `assert_group_relationship_manager`
- **Evidence:**
  - Entry points and helper are anonymously executable SECURITY DEFINER functions.
  - Helper only looks up `profiles.role` for caller-supplied `p_actor_profile_id`; it does not require `p_actor_profile_id = auth.uid()`.
  - Link/unlink functions change active customer relationship state.
- **Impact:** a caller able to supply the UUID of any privileged profile can potentially alter Group customer relationships.
- **Recommended remediation:** bind actor to `auth.uid()`, validate active profile and explicit group-management capability, verify scope over both parent and child customers, and revoke anon execute.
- **Retest:** anonymous and unrelated-role callers rejected; authorized manager only within permitted scope can link/unlink.

### INS-SEC-012 — External claim stage synchronization is anonymously executable without caller authorization
- **Severity:** High
- **Status:** OPEN
- **Component:** PostgreSQL privileged RPC / Claims
- **Object:** `sync_external_customer_stage_to_operations(...)`
- **Evidence:**
  - SECURITY DEFINER; executable by `anon`.
  - No session authorization or ownership check.
  - Function can update `claims.current_status` and insert status history based on current external-claim milestone state.
  - `p_changed_by` is optional and not authenticated.
- **Impact:** unauthorized triggering of shared claim-stage changes where prerequisite milestone state exists.
- **Recommended remediation:** make this internal-only/trigger-owned or bind invocation to authenticated claim owner/authorized Operations actor; revoke anon execute.
- **Retest:** direct anonymous call impossible; intended internal transition path remains functional.

### INS-SEC-013 — Corporate onboarding contact synchronization allows anonymous privileged contact replacement
- **Severity:** Critical
- **Status:** OPEN
- **Component:** PostgreSQL privileged RPC / Customer onboarding
- **Object:** callable overload `sync_group_corporate_onboarding_contacts(p_application_id, p_draft_data)`
- **Evidence:**
  - SECURITY DEFINER; executable by `anon`.
  - No auth/session/ownership validation.
  - Deletes existing CEO/Admin/SPOC contact rows, inserts caller-supplied names/phones/emails, and updates application phone/email metadata.
- **Impact:** unauthorized modification of Corporate onboarding/login contact identities and application contact state.
- **Recommended remediation:** revoke client execute; route through authenticated onboarding workflow with ownership/role/capability validation; derive application ownership server-side; keep trigger overload separate/internal.
- **Retest:** anonymous/unrelated users cannot modify contacts; intended onboarding owner/internal reviewer path succeeds.

### INS-SEC-014 — Customer activity event insertion is anonymously executable without authorization
- **Severity:** High
- **Status:** OPEN
- **Component:** PostgreSQL privileged RPC / Customer activity
- **Object:** `insert_customer_activity_event(...)`
- **Evidence:** SECURITY DEFINER, executable by `anon`, and function directly inserts caller-supplied customer/activity/title/message/metadata with no authorization check.
- **Impact:** integrity/spam/audit-trust weakness; arbitrary customer activity may be injected if valid identifiers are supplied.
- **Recommended remediation:** revoke public execute and make the function internal-only; if a public entry point is necessary, derive customer/source context from authenticated server-side state and constrain allowed event types.
- **Retest:** direct client invocation denied; trusted triggers/server workflows continue to create valid activity.

### INS-SEC-015 — Legacy intermediary migration/sync functions are anonymously executable privileged mutators
- **Severity:** Critical
- **Status:** OPEN
- **Component:** PostgreSQL privileged RPC / Intermediary migration
- **Objects reviewed:** `sync_existing_intermediary_migration`, `repair_legacy_partner_record_link`, `ensure_legacy_partner_record`, `sync_partner_details_to_linked_accounts`
- **Evidence:**
  - Anonymous SECURITY DEFINER execution is enabled.
  - Reviewed definitions contain no authenticated-session binding.
  - Functions update canonical Partner IDs, intermediary IDs, registrations, onboarding profiles, copied shared identity fields and linked-account state.
- **Impact:** unauthorized canonical identity/workflow mutation if record identifiers and valid payload context are supplied.
- **Recommended remediation:** make migration/repair/sync entry points service-role/internal-only; remove default PUBLIC execute; where interactive admin use is required, expose a separately authenticated approval RPC with `auth.uid()` + capability + scope checks.
- **Retest:** no migration/repair helper callable by anon/authenticated client unless explicitly designed; approved administrative workflow passes.

### INS-OBS-002 — Web portal already implements a substantive HTTP/session hardening baseline
- **Type:** Positive control
- **Evidence:** `apps/web-portal/next.config.mjs` defines CSP, HSTS in production, DENY framing default, nosniff, strict-origin referrer policy and Permissions-Policy. Middleware cookies are HttpOnly, SameSite=Lax and Secure in production; route authorization re-resolves the active profile rather than trusting the cached role cookie.
- **Follow-up:** verify actual production response headers and cookie flags during smoke/DAST; source configuration alone is not runtime certification.
