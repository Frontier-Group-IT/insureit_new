# INSUREIT — Internal VAPT & Cybersecurity Self-Audit Master Register

> **Document ID:** INS-SEC-IAV-001  
> **Version:** 0.5.0 (C03/C04 privileged function and storage policy triage)  
> **Created:** 2026-11-03 (Asia/Kolkata)  
> **Owner:** Sankalp Insurance Brokers Private Limited — designated internal audit owner **TBD**  
> **Target systems:** INSUREIT Customer App, Partner App, Operations Portal, APIs, database, storage, infrastructure, third-party integrations and related governance  
> **Status:** **P0 READ-ONLY DISCOVERY IN PROGRESS — DATABASE METADATA REVIEWED; 61 CONTROLS NOT YET PASSED**  
> **Classification:** Internal / Confidential — redact secrets, customer data and exploitable details before distribution  
> **Next review:** On each completed audit work session; formal periodic review cadence TBD
> **Latest checkpoint:** 2026-11-03: web production mapping corroborated; C03/C04 metadata and policy review started. See Sections 19–21 for evidence and review leads; NO functional authorization tests or confirmed exploit.

## 0. Essential boundaries and claims

This file is the **authoritative working register** for the internal security readiness assessment. It does **not** claim that a penetration test was run, that controls passed, or that INSUREIT is certified. The internal self-audit does not replace an independent assessment by an appropriately qualified/CERT-In-empanelled auditor, or any requirements specifically imposed by Go Digit or regulators.

**Do not publish this raw working file.** The eventual public/shareable *Internal Self-Audit Report* must be a redacted, reviewed derivative with a clearly stated internal-assessment scope and limitations. Do not describe it as a CERT-In certificate, an external VAPT certification or an IRDAI approval.

**Project separation:** This audit concerns INSUREIT; do not change Parts Connect, Deputation 3.0 or other projects. **No production modification, migration, API abuse test, active scan, deployment, pull request merge, or APK/AAB build without separate explicit approval.** Read-only code/configuration inspection is the starting phase. Never export production customer KYC, secrets, service role keys or credentials into audit notes or AI prompts.

## 1. Audit goal, questions and success criteria

**Goal:** Identify, document, prioritize, remediate and retest security issues before commissioning a third-party VAPT for Go Digit insurer API onboarding. Generate defensible evidence suitable for an official **internally approved** self-audit report.

**Key questions**
1. What are the actual production assets, owners, data flows and third-party trust boundaries?
2. Can any user, partner, RM, staff member or external caller access or alter records outside their authorized scope?
3. Are privileged database functions, exposed tables, policy documents and cloud credentials appropriately secured?
4. Are insurer-facing integrations designed to prevent credential leakage, unauthorized lookup, replay, enumeration and rate abuse?
5. Are vulnerabilities reproducibly closed without impairing valid portal/app workflows?
6. Can the organization show its control design, implementation, test evidence, residual risks and management sign-off?

**External-audit readiness gate (not equivalent to regulatory compliance):** signed scope, all applicable critical controls assessed, no open Critical/High findings, documented treatment of remaining findings, successful authorization/tenant-isolation tests, evidence indexed, remediation independently retested where feasible, and documented go/no-go approval.

## 2. Verified vs assumed context

The following is **project context supplied in prior discussions, not yet independently reverified as part of this audit**:

| Item | Working context | Audit verification required |
|---|---|---|
| Main codebase | `Frontier-Group-IT/insureit_new` | Confirm default branch, current commit, apps and deployment branches |
| Primary web domain | `https://portal.insureit.in/` | Confirm ownership, DNS, hosting, deployed commit and all subdomains |
| Platform | Operations Portal, Partner App, Customer App | Inventory production app IDs, versions and endpoints |
| Hosting | Vercel and other infrastructure mentioned in project history | Verify actual production hosting, gateways, CDN, edge services |
| Data platform | Supabase/PostgreSQL | Identify **correct production project** by corroborating deployment config; do not infer from a remembered project URL |
| Features involving sensitive information | Policy onboarding, KYC/OCR, claims, payments/commercials, documents, role-scoped records | Map live tables, role permissions, retention and providers |
| Insurer stakeholder | Go Digit requests VAPT/security assurance before production API documentation | Obtain written security checklist and exact acceptance criteria |

Record every claimed asset's **evidence source and verification date** before treating it as verified.

## 3. Legal, standards and audit-authority register

**To be independently verified and signed off by the internal compliance/legal owner:**

- [ ] Obtain the authoritative text of the currently applicable IRDAI Information and Cyber Security Guidelines and related circulars; record publication/effective dates, intermediary applicability, audit periodicities, scope and required annexures.
- [ ] Confirm the broker's classification and applicability of each control with compliance/legal; do not assume every insurer-only duty applies identically to brokers.
- [ ] Check current CERT-In directions and empanelment list; confirm firm eligibility, scope and validity before engaging a third-party auditor.
- [ ] Obtain Go Digit's written specification: required auditor type, report age, scope, production/staging, secure code review, retest, confidentiality and report submission format.
- [ ] Adopt OWASP ASVS (proposed Level 2 for sensitive authenticated workflows), OWASP API Security Top 10 and OWASP WSTG as **engineering references**, not claims of certification.
- [ ] Confirm privacy, consent, incident reporting, contractual data handling and evidence-sharing rules with legal/compliance.

**Primary starting references (verify currency):** https://www.irdai.gov.in/ ; https://www.cert-in.org.in/ ; https://owasp.org/www-project-application-security-verification-standard/ ; https://owasp.org/API-Security/ ; https://owasp.org/www-project-web-security-testing-guide/

## 4. Status notation and control instructions

Each check below starts as **`[ ]` = Not assessed**. Change to `[x]` only after evidence has been reviewed and recorded in the evidence index. Use the control register to set detailed status:

`NOT_STARTED` | `IN_PROGRESS` | `PASS` | `FINDING` | `BLOCKED` | `NOT_APPLICABLE` (reason required) | `RETEST_PENDING` | `CLOSED`.

An item is never marked PASS merely because source code contains an apparent protection. Record the tested environment, identities/roles, input condition, expected and observed behavior. A genuine finding gets an ID and remediation owner. Avoid recording secret values, customer identifiers or exploit payloads in this broad-access document.

## 5. Full audit to-do list (61 controls)

### A — Asset inventory, scope and architecture (6)
- [ ] **A01** Inventory all production, staging and development domains/subdomains, DNS ownership and exposure.
- [ ] **A02** Inventory all applications, services, API endpoints, databases and storage buckets.
- [ ] **A03** Record hosting providers, regions, environments, account owners and trust boundaries.
- [ ] **A04** Document sensitive-data flows, third-party subprocessors and insurer integration paths.
- [ ] **A05** Produce architecture diagrams and a system/data-flow diagram with trust boundaries.
- [ ] **A06** Assign asset criticality, business owner, technical owner and explicit scope exclusions.

### B — Identity, authentication and authorization (6)
- [ ] **B01** Review customer, partner, RM, staff, super-admin and service-account login flows.
- [ ] **B02** Verify OTP/password/MFA protections, secure sessions, cookie settings and expiry.
- [ ] **B03** Test horizontal authorization using distinct authorized test users and records.
- [ ] **B04** Test vertical role escalation and privileged action authorization at backend/database.
- [ ] **B05** Verify user deactivation, refresh-token handling, session invalidation and recovery.
- [ ] **B06** Review privileged access inventory, least privilege, approval and access-review trails.

### C — Supabase, PostgreSQL and object storage (6)
- [ ] **C01** Enumerate all exposed schemas/tables and RLS state; confirm Data API grants.
- [ ] **C02** Review SELECT/INSERT/UPDATE/DELETE policies for tenant isolation and write integrity.
- [ ] **C03** Review security-definer functions, callable RPCs, views, grants and search paths.
- [ ] **C04** Review storage buckets, object ownership, signed URLs, expiry and document access.
- [ ] **C05** Review service-role key use, database privileges, sensitive columns and edge functions.
- [ ] **C06** Verify backup policy, restoration evidence, logs and privileged access trails.

### D — Web applications and APIs (7)
- [ ] **D01** Catalog routes and API endpoints by exposure, method, authentication and owner.
- [ ] **D02** Review/test injection, XSS, CSRF, redirects and template-related risks safely.
- [ ] **D03** Assess request validation, file upload, file download and content processing.
- [ ] **D04** Review rate limits, anti-automation, enumeration and safe error behavior.
- [ ] **D05** Test object-level authorization, cross-role and cross-tenant IDOR/BOLA scenarios.
- [ ] **D06** Verify CORS, cookies, HTTPS, TLS, CSP and relevant security headers.
- [ ] **D07** Review webhook signatures, replay prevention, idempotency, retries and auditability.

### E — Source code, dependencies and CI/CD (6)
- [ ] **E01** Conduct secrets scanning on active tree and history using approved tooling.
- [ ] **E02** Run dependency vulnerability checks on each app and backend package ecosystem.
- [ ] **E03** Run static analysis and manually review high-risk patterns and auth paths.
- [ ] **E04** Audit GitHub Actions permissions, third-party action pinning, triggers and tokens.
- [ ] **E05** Confirm protected branches, required checks, code review and deployment gates.
- [ ] **E06** Inspect build configuration, environment separation and release provenance.

### F — Cloud/edge infrastructure (6)
- [ ] **F01** Verify current Vercel/Cloudflare/Supabase assets, tenants, services and owners.
- [ ] **F02** Review secret handling, secret access, rotation runbook and environment segregation.
- [ ] **F03** Review publicly reachable services, database exposure and network access controls.
- [ ] **F04** Inspect DNS, TLS certificates, HTTPS routing, headers and caching of private data.
- [ ] **F05** Verify access to admin consoles, activity logs, change history and alerting.
- [ ] **F06** Review platform quotas, resilience, WAF/rate limiting and denial-of-service posture.

### G — Mobile app security (5)
- [ ] **G01** Assess customer and partner mobile authentication and session handling.
- [ ] **G02** Check secure local storage, cached sensitive content and device backup settings.
- [ ] **G03** Review network transport, certificate validation and release vs debug settings.
- [ ] **G04** Verify authorization enforced on server independent of mobile UI controls.
- [ ] **G05** Review mobile dependencies, signing, distribution and build pipeline controls.

### H — Privacy, third parties and insurer integrations (6)
- [ ] **H01** Identify PII/KYC/policy/claim/payment data, storage and external transfers.
- [ ] **H02** Document applicable notices, consent/legal basis and user-rights procedures.
- [ ] **H03** Review data minimization, retention, deletion, exports and access logging.
- [ ] **H04** Inventory third-party API processors, contracts, scopes and vendor risk assessments.
- [ ] **H05** Define Go Digit credential handling and backend-only insurer API architecture.
- [ ] **H06** Define end-user consent, request attribution, throttling and response-data controls for insurer calls.

### I — Monitoring, incidents and continuity (6)
- [ ] **I01** Inspect security event logs, privacy-safe logging and tamper-resistant retention.
- [ ] **I02** Verify alerts for login anomalies, authorization denials and unusual API activity.
- [ ] **I03** Review incident escalation ownership, contacts, containment and response playbooks.
- [ ] **I04** Confirm statutory/contractual reporting thresholds and notification timelines.
- [ ] **I05** Conduct approved restoration exercise and document RPO/RTO expectations.
- [ ] **I06** Review patching, periodic access recertification and staff awareness controls.

### J — Safe testing, remediation and final evidence (7)
- [ ] **J01** Authorize testing scope, environments, accounts, traffic limits, time window and rollback rules.
- [ ] **J02** Run non-destructive approved automated scans and retain sanitized outputs.
- [ ] **J03** Perform manual authenticated authorization and business-logic checks in safe test environments.
- [ ] **J04** Validate findings, determine impact and severity, remove false positives and log risks.
- [ ] **J05** Remediate in separate reviewed branches, test regressions and require approval before merge/deploy.
- [ ] **J06** Retest fixes against approved environments and preserve closure evidence.
- [ ] **J07** Complete signed internal audit report, risk acceptance and external-auditor readiness decision.

**Total: 61 tracked controls. Initial status: 0 tested, 0 passed, 0 findings, 61 not assessed.**

## 6. Planned execution stages and gates

| Phase | Workstream | Allowed activity by default | Completion evidence | Exit condition |
|---|---|---|---|---|
| P0 | Authorization + inventory | Read-only discovery | Scope, owners, asset list, architecture, access matrix | Assets reconciled and testing rules approved |
| P1 | Static/configuration review | Code/config/log metadata review with sensitive data minimized | RLS matrix, code/dependency findings, IAM findings | Critical unknowns triaged |
| P2 | Controlled validation | Test accounts, staging or specifically approved production-safe checks | Reproducible test records and redacted proofs | Findings validated and severity agreed |
| P3 | Remediation | Branch/PR changes only on approval; production changes only when separately approved | PRs, workflows, regression results, change approvals | No unresolved Critical/High |
| P4 | Retest | Approved verification | Before/after evidence, retest result | Controls re-evaluated |
| P5 | Report + sign-off | Evidence review and redacted release preparation | Signed internal report and action plan | Internal go/no-go for external VAPT |

**Proposed order of detailed work:** 1) inventory and role matrix; 2) Supabase RLS/storage/privileged SQL; 3) authentication and cross-tenant access; 4) APIs and documents; 5) secrets, code, CI/CD; 6) cloud; 7) mobile; 8) governance and resilience; 9) controlled testing; 10) remediation/retest and sign-off. Reorder as evidence requires.

## 7. Approved testing boundaries and stop rules

1. **No exploitation of third-party infrastructure** including Go Digit without their written authorization; do not run scans against insurer systems.
2. Start with repository/configuration inspection and non-destructive queries; use synthetic users/policies in controlled environments for authorization tests.
3. Before any active scanning: document target, authorization, rate/concurrency limits, timing, account identities, data impact, escalation contact, rollback and monitoring.
4. Do not extract, display or store actual production passwords, session tokens, KYC documents, customer identifiers, full policy records, private keys or service-role keys in evidence.
5. If suspected exposure of sensitive information, active abuse or a production-impacting issue is found, **stop testing that path**, preserve minimal metadata, notify the authorized owner promptly, and follow incident response.
6. Never disable security controls, relax RLS, change prod auth or run destructive database operations to make a test pass.
7. A finding does not justify unreviewed hotfixes. Use approved emergency process only if authorized by the owner.

## 8. Evidence standard and evidence index

All PASS/FINDING/CLOSED controls must link to evidence that supports the assertion. Evidence must be date-stamped, attributable, reproducible where safe, and environment-specific. Do not place raw sensitive proof of concept details in this broadly shared master file.

| Evidence ID | Control / Finding ID | Environment | Source / artifact (restricted path or reference) | Collected UTC / IST | Reviewer | Sanitized? | Notes |
|---|---|---|---|---|---|---|---|
| EVID-0001 | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | *Pending* | Placeholder — not collected |

**Evidence types:** relevant code snapshot/commit, SQL result showing policy *metadata* (not user records), sanitized logs, test case and expected/actual response, configuration export with secrets removed, dependency scan results, workflow run, signed decision/approval, restore test summary.

## 9. Live findings register

| Finding ID | Date | Asset | Control(s) | Severity | Finding summary | Evidence ID | Owner | Status | Due | Fix PR | Retest |
|---|---|---|---|---|---|---|---|---|---|---|---|
| — | — | — | — | — | **No findings recorded yet; not evidence of security.** | — | — | NOT_STARTED | — | — | — |

**Severity rubric (provisional):** Critical = likely systemic compromise/major unauthorized sensitive-data exposure; High = significant unauthorized access or privilege abuse; Medium = exploitable with constraints/limited impact; Low = defense-in-depth; Informational = observation. Use CVSS where applicable plus actual business, data protection and insurer-integration impact. Avoid automatic severity assignment from scanners without manual review.

For every finding, record: *preconditions; impact; authorization and tenant boundaries; affected version; confirmed vs potential; owner; containment; fix recommendation; proposed corrective and preventive action; test of fix; closure sign-off*. Keep exploit details in restricted evidence.

## 10. Remediation and change control

Workflow: **FINDING → TRIAGED → FIX_IN_PROGRESS → PR_OPEN → CI_PASS → REVIEWED → APPROVED_FOR_MERGE → DEPLOYED (approved) → RETEST_PENDING → CLOSED**. Use BLOCKED/RISK_ACCEPTED only with documented justification and approving authority.

- One finding may require several PRs; one PR may address several findings. Maintain traceability.
- Do not merge until relevant security, build and regression checks pass and the user/authorized owner approves.
- Capture changed files, migrations (if any), environment change, test results, reviewer and deployment identifier.
- Validate the fix in the affected environment; do not close based solely on code review.
- Record residual risk and compensating controls separately from remediation status.

## 11. Role/tenant authorization test matrix (seed)

| Actor | Allowed target | Forbidden target to verify | Core risk |
|---|---|---|---|
| Customer A | Own policy / vehicle / claim / documents | Customer B's records | BOLA / data leakage |
| Partner A | Authorized policies and branches | Partner B's records | Tenant isolation |
| RM A | Assigned tickets/portfolio | RM B's restricted objects | Scope bypass |
| Sales Executive | Approved assigned workflows | Admin or unrelated policies | Privilege escalation |
| Accounts | Accounts workspace | Operations / IT admin actions | Role bypass |
| IT / Super User | Explicitly privileged resources | Unapproved production data export | Excessive privilege |
| Unauthenticated visitor | Public data only | Private document URLs / API actions | Missing authentication |
| Disabled user | No newly authorized access | Old session/refresh token reuse | Session revocation |

Extend this matrix with actual roles and endpoint-specific permissions verified from repository and database. **Never run these tests on real customer objects.**

## 12. Go Digit API readiness annex (pre-integration)

- [ ] Obtain written security onboarding requirements and evidence acceptance format.
- [ ] Confirm whether VAPT certificate, full report, closure letter, secure code review, infrastructure review and/or IRDAI assurance annexures are required.
- [ ] Record allowed data fields, purpose, consent, retention and audit provisions of the insurer contract.
- [ ] Design server-side credentials only, scoped access, secret rotation, IP allowlisting if required, rate limits, replay protection and idempotency.
- [ ] Define approval and audit trail for every insurer lookup or policy transaction.
- [ ] Threat-model quotation, proposal, issuance, payment, policy fetch, KYC and claim data flows as applicable.
- [ ] Establish sandbox test plan without using production customer identifiers.
- [ ] Securely transmit only the approved audit package to Go Digit after sign-off.

## 13. Final official **internal** report specification

At completion publish a separately versioned and approved document titled **“INSUREIT Internal Cybersecurity Self-Audit & VAPT Readiness Report”**. Suggested sections:

1. Cover page: organization, document ID, audit dates, assessor names/roles, classification, version and approval.
2. Executive summary and overall internal readiness decision.
3. Scope, asset list, environments, exclusions and assumptions.
4. Governance, applicable standards and regulatory mapping (signed off by compliance).
5. Methodology, authorization boundaries, testing limitations and tooling.
6. System architecture and sensitive-data-flow summary.
7. Control testing results, coverage metrics, evidence index and deviations.
8. Vulnerability findings by severity, business impact and remediation status.
9. Remediation/retest evidence and unresolved/residual risks.
10. Go Digit API security readiness assessment.
11. Incident/BCP and operational controls summary.
12. Internal opinion/limitations (NOT third-party certification).
13. Management approvals and action owners.
14. Annexures: sanitized checks, approval records, report version history, restricted evidence cross-references.

**Publication policy:** Create two editions if needed: (a) confidential full internal report with restricted references; (b) insurer-shareable summary after confidentiality and legal review. Public internet publication is **not automatic**. Do not include raw vulnerability reproduction paths, access tokens, private endpoint details or customer PII. Obtain owner and legal/compliance sign-off before publication.

**Example conclusion wording (only after completion and supported by actual results):** “An internally directed cybersecurity self-assessment of the documented INSUREIT assets was carried out between [dates]. The assessment evaluated [scope] under the stated methods and limitations. Findings and remediation status are summarized herein. This is not an independent CERT-In-empanelled VAPT certificate.”

## 14. Report metrics (baseline; populate only from verified audit activity)

| Metric | Current |
|---|---:|
| Total checklist controls | 61 |
| Assessed with evidence | 0 |
| Passed | 0 |
| Findings opened | 0 |
| Findings closed by retest | 0 |
| Not assessed | 61 |
| N/A with approval | 0 |
| Critical / High open | Unknown — no testing completed |
| Formal readiness decision | NOT DETERMINED |

## 15. AI-agent continuity and handoff protocol

**Read this document FIRST** for every new audit chat or agent. Then read root `AGENTS.md` and relevant repository-specific security/testing instructions before interacting with any code or service. This file can be maintained in `docs/security-audit/INSUREIT_INTERNAL_VAPT_MASTER_AUDIT.md` in the repository when the owner approves a documentation-only PR. Do not assume a local downloaded copy automatically updates the repository or remains writable in a future session.

### Required procedure for every agent/session
1. Read the latest document version and history; recover previous confirmed findings and pending work.
2. Confirm which repo/project/environment is genuinely production before reading sensitive metadata; never assume a similarly named project is correct.
3. State whether activity is **planning**, **read-only observation**, **authorized safe testing**, **remediation**, or **production deployment**.
4. Prioritize next unassessed control using risk, dependencies and available authorization.
5. For every check, record **control ID, method, date, target environment, code commit/config version, evidence ID, observed result, status, owner and next action**.
6. For findings, add a stable `VAPT-YYYY-NNN` ID and update both the findings and remediation registers; never mark closed without retest evidence.
7. Update the metrics and session log. Clearly distinguish verified facts from hypotheses and pending validation.
8. Summarize session outcome, blockers, changes (if any), exact next steps and approvals needed.
9. Before editing the master file in GitHub, inspect current version/commit to avoid overwriting another agent's changes. Prefer PR review, with no automatic merge or deployment.
10. Keep this baseline file and the approved report synchronized by references, **not** by copying confidential raw evidence into general-purpose documents.

### Handoff format
```text
AUDIT SESSION HANDOFF
Date/time (IST):
Agent/operator:
Audit phase:
Repository and reviewed commit:
Environment / authorization:
Controls reviewed:
Evidence added:
Findings opened/updated/closed:
Code/DB/deployment changes (or explicitly NONE):
Tests and observed results:
Blockers/uncertainties:
Approvals still required:
Next exact actions:
Master document version:
```

## 16. Session activity log

| Date (IST) | Actor | Phase | Work performed | Evidence / changes | Outcome | Next action |
|---|---|---|---|---|---|---|
| 2026-11-03 | Planning assistant | P0 planning | Created initial master audit checklist and handoff/report structure from user-approved plan | This document only. **No system inspection, audit test, repo commit or deployment.** | Planning baseline ready, 61 controls unassessed | Verify live project inventory; appoint audit owner; approve read-only discovery scope |

## 17. Immediate next work package — P0 read-only discovery

- [ ] Confirm owner/approver and written scope for internal read-only assessment.
- [ ] Read `AGENTS.md` and repository architecture/security files at a pinned commit.
- [ ] Inventory web/mobile apps, public domains, API routes, edge functions and data stores.
- [x] Corroborate actual production Supabase and hosting IDs from deployed configuration, without exposing secrets. (2026-11-03; see P0-018–P0-020, Section 20; still inventory other environments).
- [ ] Extract **metadata-only** RLS policy inventory and identify critical assets to review first.
- [ ] Create initial data-flow and role-permission matrices; list unknowns explicitly.
- [ ] Record first verified evidence entries and update A01–A06 status individually.
- [ ] Propose P1 security-review order for approval; **no active scanning or production modification**.

---

**Maintenance reminder:** At the end of each audit session, update the checklist, evidence index, findings/remediation registers, metrics, handoff and session log. Do not erase historical findings or silently mark untested controls as complete. Review/version the finished internal report independently before any external sharing.

## 18. P0 discovery update — 2026-11-03 (read-only)

**Scope and evidence limitations:** These observations are repository and database-metadata facts only. They do not establish vulnerability absence, production deployment identity, authorized-user isolation, or control compliance. **All 61 controls remain unassessed** until individually tested and recorded with sufficient evidence.

| Evidence ID | Read-only observation | Source / limitations |
|---|---|---|
| P0-001 | Main repo exists and `AGENTS.md` includes explicit role-isolation rules, a Policy Intake super-admin exception, PR testing requirements, and several unresolved live verification caveats. | GitHub `Frontier-Group-IT/insureit_new`, main, `AGENTS.md` inspected 2026-11-03; file evolves and must be pinned to a commit in the formal report. |
| P0-002 | Workspace directories declared: `apps/web-portal`, `apps/mobile-app`, `apps/partner-app`, `packages/*`. | Main branch root `package.json`; presence/configuration of individual apps still needs further verification. |
| P0-003 | `.github/workflows/verify-web-portal.yml` runs pull-request checks including authorization and partner-branch isolation regression scripts; it declares repository `contents: read`. | Workflow definition inspected; checks have **not** been run during this audit, and source checks alone do not prove deployment security. |
| P0-004 | Connected Supabase organization lists project `Insureit_Web` (`ilzhsfqqjyppzzvfscmh`, region ap-northeast-2) and a separate Parts Connect project. | Supabase connected project list, 2026-11-03. INSUREIT production binding must be corroborated against deployed configuration before treating this project as authoritative. |
| P0-005 | In the `Insureit_Web` project, 180/180 `public` base tables currently have RLS **enabled**; none are disabled. | Metadata-only query against `pg_tables`; RLS enabled is **not** proof policies are correct or complete, or that views, RPCs, grants and storage are safe. No customer rows accessed. |
| P0-006 | No pre-existing `docs/security-audit/INSUREIT_INTERNAL_VAPT_MASTER_AUDIT.md` was found on `main` at the start of this work. | GitHub contents lookup; audit file added via separate documentation PR. |

### Immediate verified next steps

1. Identify and pin current repository commit and verify deployed production commit, domain routes and cloud project mapping.
2. Obtain metadata-only inventories for RLS **policies** (not just enabled flags), privileged functions, view security modes, grants and storage bucket policies; redact security-sensitive payloads from any shareable report.
3. Inventory relevant role-routing and authorization source files, API routes, edge functions and trust boundaries; mark controls pass/fail only after a defined test case and evidence.
4. Prepare authorized **staging** role-isolation test users and explicit testing rules before any active endpoint testing.
5. Request Go Digit's written acceptance requirements for the external audit and record them separately from regulatory assumptions.

### Session log amendment

| 2026-11-03 | GitHub/Supabase read-only discovery | P0 | Read `AGENTS.md`, root `README.md`, `package.json`, web portal verification workflow and aggregate Supabase project/RLS metadata. | Evidence P0-001 through P0-006; no production configuration or data writes. | P0 started; 61 controls unassessed. | Review RLS definitions, source authorization boundaries and deployment mappings. |

**Git discipline:** This document is introduced on a separate documentation-only branch and PR. Do not merge or deploy without explicit user approval. Update this file on each audit session; keep chronological evidence and report history intact.


## 19. P0 database security metadata and role-boundary review — 2026-11-03

**Assessment type:** read-only SQL metadata, Supabase Security Advisor, and narrowly scoped database function/policy definition inspection. **System:** connected Supabase project \`Insureit_Web\` (\`ilzhsfqqjyppzzvfscmh\`). **Environment status:** associated with INSUREIT by project naming and prior context; production application-to-project mapping **NOT YET independently corroborated** using deployed configuration. No real customer, policy, claims or file records were queried. No endpoint scans, auth test requests, changes or deployments performed.

### Verified observation register (metadata only)

| Evidence ID | Observation | Evidence source | Interpretation and next validation |
|---|---|---|---|
| P0-007 | Current \`public\` schema has **181/181 base tables with RLS enabled**; **64** tables have at least one policy, **117** have no policy; **252** policies total. Prior snapshot P0-005 counted 180/180, so record both time-dependent results. | Read-only \`pg_tables\` + \`pg_policies\` aggregate SQL, 2026-11-03 | Enabled RLS does not validate policy logic. No-policy tables may intentionally be service-only; inspect actual grants, RPCs and intended access. |
| P0-008 | Supabase Security Advisor returns four security lint categories: **117 \`rls_enabled_no_policy\` (INFO), 178 \`authenticated_security_definer_function_executable\` (WARN), 1 \`anon_security_definer_function_executable\` (WARN), 1 \`auth_leaked_password_protection\` (WARN)**. | Connected Supabase \`get_advisors(security)\`, 2026-11-03 | Lint counts are review leads, **not** 297 confirmed exploitable vulnerabilities. [Advisory: no policy](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy), [authenticated definer](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable), [anonymous definer](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). |
| P0-009 | **434** public-schema functions; **380** are \`SECURITY DEFINER\`; of those **178** are callable by \`authenticated\` and **1** by \`anon\` (current effective \`EXECUTE\` privileges). | Read-only \`pg_proc\`, \`pg_namespace\`, \`has_function_privilege\` aggregates | Prioritize access-path + caller-auth checks, sensitive data/function ownership, and cross-tenant authorization. Presence of \`SECURITY DEFINER\` is not in itself proof of a bug. |
| P0-010 | All **4** public ordinary views use \`security_invoker=true\`; none of the 4 was classified as a non-invoker view. | \`pg_class\` view reloptions | Favorable view setting; view definitions and authorization behavior still require review. |
| P0-011 | **9** storage buckets; **2** public asset buckets (\`insurer-assets\`, \`manufacturer-assets\`); claims, policy, customer, POSP, support, partner-profile and exchange buckets marked private; **35** storage-object RLS policies recorded. | \`storage.buckets\` public flag and \`pg_policies\` aggregate | Bucket privacy metadata only; verify signed URL flows, file ownership, object policies and upload/download authorization with test accounts. Public asset buckets should hold only intended public material. |
| P0-012 | **56** public base tables grant effective SELECT privilege to \`anon\`, **64** to \`authenticated\`; **0** base tables have disabled RLS and effective \`anon\` SELECT. Some sensitive tables have \`anon\` table grants but RLS conditions constrain rows; these layers must be assessed together. | \`has_table_privilege\` aggregate + targeted table-policy metadata | SQL GRANT permits reaching a table, but RLS still filters rows. No unauthorized data access verified. |
| P0-013 | Sensitive policy/customer/claim tables use non-trivial ownership/role helper predicates rather than an unrestricted \`USING true\` rule in sampled SELECT policies. Six literal-true SELECT/ALL policies were observed on reference/lookup tables (banks, India locations, insurer directory, vehicle manufacturer reference tables). | \`pg_policies\` targeted read-only review | Sample only, **not a proof of all policy correctness**. Validate reference data classification and helper functions. |
| P0-014 | Exactly one \`anon\`-executable \`SECURITY DEFINER\` function was observed: \`customer_firebase_data_api_pre_request()\`. Static review shows conditional issuer handling, a delegated Firebase profile resolver, \`search_path\` fixed to empty, and transaction-local claim context. | \`pg_proc\` function definition + grants, 2026-11-03 | Review intended pre-request hook exposure and security of delegated resolver; **not classified as exploitable** based on static review alone. |
| P0-015 | A claims-document SELECT policy and claims SELECT policy use the \`is_claim_portal_user()\` role predicate. The predicate permits certain active staff roles without an additional row-specific scope inside that policy. | Targeted \`pg_policies\` and \`pg_proc\` definitions, 2026-11-03 | **Authorization-design review required:** verify that role-wide claim and document visibility is intended and documented; do not assume a breach or change the policy without role-owner approval and regression tests. |
| P0-016 | Security Advisor warns that Supabase Auth leaked-password protection is not enabled/configured to suppress this warning. | Security Advisor \`auth_leaked_password_protection\` warning | Confirm live Auth setting and email-password applicability; propose enabling with compatibility tests and separate authorized change request. |
| P0-017 | Documentation PR head \`f86b075cbfe4944c4204a819f1a6cae0fcbf7881\` completed \`Verify web portal\` workflow #7866 successfully. | GitHub Actions run #41584046169, 2026-11-03 | Confirms that run's checks passed; **not** a substitute for VAPT, staging authorization tests or production login verification. |

### Open review leads — no confirmed exploit, no remediation authorized

| Review lead | Priority | Control(s) | Question to answer | Decision / status |
|---|---|---|---|---|
| REV-2026-001 | High investigation priority | C03, B03, B04 | Do authenticated-callable privileged functions consistently authorize correct roles, customer/partner ownership and tenant boundaries? Audit in risk-ranked batches. | OPEN — static/metadata only |
| REV-2026-002 | High investigation priority | C02, B03 | Is role-wide claims and claim-document access explicitly authorized for the listed staff roles? If not, prepare scoped hardening proposal. | OPEN — business role-owner confirmation and test required |
| REV-2026-003 | Medium investigation priority | C03, B01 | Is anonymous execution of the Firebase pre-request function essential and safely bounded by the full identity resolver and gateway configuration? | OPEN — no exploit claimed |
| REV-2026-004 | Medium / configuration | B02 | Should leaked-password protection be enabled for password sign-ins, and what is its current dashboard setting? | OPEN — advisor warning to confirm |
| REV-2026-005 | Normal inventory | C01, C04 | Are the 117 RLS/no-policy tables intentionally private, and are the 2 public buckets restricted to non-sensitive assets? | OPEN — grants/storage review incomplete |
| REV-2026-006 | Normal inventory | A03, C01 | Does the production deployment definitely use this Supabase project and what explains the one-table count change during these snapshots? | OPEN — deployed environment mapping not confirmed |

**Risk-handling discipline:** Do not create numbered \`VAPT-YYYY-NNN\` confirmed vulnerability entries solely from automated warnings. Promote a review lead to a finding only after confirming an actual misconfiguration or policy violation, recording sufficient evidence, severity and an owner. Store any exploit-sensitive details in a restricted evidence location rather than here.

### Step-by-step continuation queue

1. **P0.1 — Bind deployed environment:** corroborate INSUREIT production website deployment, verified branch/commit and Supabase project reference using permitted read-only configuration views; capture only project identifiers, never secret values.
2. **P0.2 — Inventory high-risk functions:** risk-rank the 178 authenticated-executable definer functions and inspect authorization and tenant checks. Review delegated Firebase identity resolver. Mark C03 as PASS only after defined coverage and validation.
3. **P0.3 — Role design:** have system owner decide whether staff-wide claims/claim-document SELECT is intended. Prepare dedicated synthetic Customer A/B, Partner A/B and role-test cases in staging; no production exploitation.
4. **P0.4 — Storage review:** inspect \`storage.objects\` RLS policy predicates, bucket asset classifications, and source code for signed URL issuance. No user files opened.
5. **P0.5 — Auth config:** confirm leaked-password protection setting and applicability, then stage a risk-aware recommendation. Do not modify live Auth settings without approval.
6. **P0.6 — Evidence traceability:** update control status individually only upon completed and reproducible testing, include deployed commit/config identifier and reviewer in the evidence index.

### Session 2 log

| 2026-11-03 | Read-only audit assistant | P0 | Reviewed actual public RLS/table grant, function, view, bucket metadata; examined sampled policy and function definitions; retrieved security advisor summaries and prior documentation-PR CI status. | P0-007 through P0-017; six review leads, no confirmed exploit and no production mutation. | **All 61 checklist controls remain not yet passed.** Discovery expanded, P0 not complete. | Validate production binding; risk-rank definer functions and confirm claim-staff access design. |

**Documentation handling:** This is an internal register and must not be posted publicly without confidentiality review. No third-party certification or independent attestation is claimed.


## 20. P0 production deployment corroboration — 2026-11-03

**Activity classification:** read-only Vercel project/domain/deployment inspection and **a single browser-public** project environment-variable reference lookup. The encrypted credential variables themselves were **not** decrypted, copied or written to this document. This supersedes the "production mapping not verified" caveat in earlier P0 sections for the currently mapped web portal. The broader app/mobile/cloud inventory remains incomplete.

| Evidence ID | Observation | Evidence source | Limitation / next step |
|---|---|---|---|
| P0-018 | The Vercel project named \`insureit_new\`, ID \`prj_OLXA2UB1LwMd0UidP8MNa1O9MLuq\`, is in team \`team_DsOUqnF8Pbd7YGNt8RCE8NgA\`; its project domain listing includes verified \`portal.insureit.in\`. | Connected Vercel project/domain metadata, 2026-11-03 | Establishes project association, not all external DNS/CDN/data flows or mobile deployments. |
| P0-019 | The production domain \`portal.insureit.in\` resolves in connected Vercel deployment metadata to READY deployment \`dpl_FzyuogLHfiN6x1hQUBiz8wM2FULH\`, GitHub \`Frontier-Group-IT/insureit_new\`, ref \`main\`, commit \`202d90b2d0e3c89e64374c42f9e92ab34addad28\` at inspection. | Connected Vercel get-deployment by domain with Git source details, 2026-11-03 | Point-in-time mapping. Compare with subsequent deployed commits on future audit days. |
| P0-020 | Production variable **\`NEXT_PUBLIC_SUPABASE_URL\` only** (a client-public Supabase URL) resolves to project reference \`ilzhsfqqjyppzzvfscmh\`, matching the Supabase project audited in P0-005, P0-007–P0-016. | Vercel environment variable listing (\`decrypt=false\`) followed by a single exact public URL variable lookup, 2026-11-03 | Other configuration/secret values were **not** retrieved. Does not prove every server-side or mobile data path uses that project. |
| P0-021 | Production Vercel environment-variable metadata includes a server service-role key **name**; no value read. The repository's historical README cautions against exposing it in browser code. | Vercel env metadata (\`decrypt=false\`); repository README, 2026-11-03 | Existence of a server secret is **not itself a flaw**. Review server-only usage, runtime exposure boundaries and least privilege through source inspection; never print/commit key values. |
| P0-022 | \`AGENTS.md\`, root \`package.json\`, and \`.github/workflows/verify-web-portal.yml\` were independently fetched at exact currently inspected production commit \`202d90b2d0e3c89e64374c42f9e92ab34addad28\`. | GitHub fetch-file with pinned commit, 2026-11-03 | Records reproducible code baseline; deeper architecture and access-control source review remains pending. |

### Revised P0 disposition

- **Complete (narrow subtask):** Corroborate the production web application's Vercel project, domain, GitHub commit and client-public Supabase project reference.
- **In progress:** The 61 control checklist remains unpassed. A01–A06 still need comprehensive asset inventory/owners; C01–C05 still need policy/function logic review and approved functional verification.
- **Not started:** synthetic cross-role testing, safe dynamic scans, mobile build review, code remediation and third-party VAPT.
- **Approval still needed:** designated internal audit owner, formal read-only assessment scope confirmation, and any future active testing plan.

### Next prioritized read-only work package (P0/C03-C04)

1. Inventory and classify the **178 authenticated-executable \`SECURITY DEFINER\` functions** by sensitive operations, read/write privileges, explicit caller checks and tenant-scoping design; begin with customer, policy, claim, onboarding and finance related functions, and record sampled evidence before extending.
2. Confirm intended role-wide access to claims and claim documents with the authorized business/technical owner; validate via synthetic staging identities before any policy change.
3. Inspect \`storage.objects\` authorization logic and signed-document URL issuers without fetching actual customer documents.
4. Confirm Supabase Auth breached/leaked-password protection setting, password-login exposure and change risk. Propose a fix, but **do not modify settings** without approval.
5. Expand infrastructure inventory (production/preview environments, secrets' **names only**, edge middleware and data-flow architecture). Never retrieve secret values.

### Session 3 log

| 2026-11-03 | Read-only audit assistant | P0 | Inspected Vercel project/domain/deployment and selected client-public Supabase URL, pinned GitHub source files, confirmed web-production binding. | P0-018 through P0-022; no sensitive env values fetched or production modifications. | Web production mapping verified; P0 scope remains open; 61 controls unpassed. | Continue C03 risk-ranked function/source authorization review and C04 object storage policy review. |

**Pending CI check at writing:** The prior documentation update commit \`7220382cb1943497d99b5ce613b9d9411735d9b2\` had Verify web portal run #7898 in progress. A new documentation commit will trigger/check its own PR workflow; record the final result after it finishes, do not assume success.


## 21. C03/C04 first-pass function and storage policy triage — 2026-11-03

**Method:** Only read-only Postgres catalog and RLS policy-definition queries against the production-linked Supabase project, \`ilzhsfqqjyppzzvfscmh\`. No user objects, credentials or document bytes accessed; no RPCs executed or dynamic permission probes. This is **partial** verification of controls C03 and C04, not a PASS.

| Evidence ID | Verified observation | Interpretation / further testing |
|---|---|---|
| P0-023 | All **380** public-schema \`SECURITY DEFINER\` functions have an explicit function-level \`search_path\` setting; **0/178** authenticated-executable definer functions lack that setting. | Positive static hardening property; a configured search path alone does **not** prove safe function resolution, authorization or tenant scoping. Review search-path values, schema CREATE grants, caller/argument validation and delegated functions. |
| P0-024 | Coarse **name-based** triage of 178 authenticated-executable \`SECURITY DEFINER\` functions: **55 other**, **51 partner/branch**, **45 policies/claims/finance**, **27 identity/customer**. | Category assignment is heuristic (function name only), and the totals are not vulnerabilities. Use this as the prioritized manual review queue, starting with finance/policy/claims and identity/customer pathways. |
| P0-025 | \`storage.objects\` has 35 RLS policies; role/operation breakdown includes **public-role SELECT (2), INSERT (2), DELETE (1)**. The customer-document public-role rules check a customer/profile-and-folder relationship. | \`roles={public}\` can still be constrained by RLS predicates; there is no demonstrated anonymous document access. Test only with synthetic authorized roles, owners and filenames. |
| P0-026 | A claims-document storage SELECT rule and INSERT rule depend on the claim-portal staff-role predicate and target the claim-documents bucket, without a per-claim/path ownership predicate in those **specific** rules. Paired claims-table/document policies allow certain active internal claims staff roles broad access under the same predicate. | **Potentially overbroad authorization versus the intended business model**, not confirmed vulnerability. Obtain written policy-owner validation of which staff roles should see/upload any claim file; document expected restrictions. If narrower access is required, propose surgical per-claim scoping and staging-only negative tests before any change. |

### Actionable triage notes

- **REV-2026-002 expanded:** include claim-documents bucket read/upload behavior and determine whether each listed claims staff role is entitled to portfolio-wide access, including other staff/branches/partners. Do **not** infer that customer or anonymous users have this access.
- **REV-2026-001 narrowed:** explicit search-path presence is confirmed for all 380 definers; functional privilege/tenant checks remain to inspect.
- **Do not apply RLS patches yet.** Several policy paths support legitimate claims processing; altering them without authorized business rules and regression testing could disrupt policy/claim operations.

### Next controlled examination

1. Document expected claim-portal role visibility in a signed role-permission matrix; separately distinguish claim record view, document metadata view, object download and upload permissions.
2. Continue function static review by function family, using a reproducible coverage register and capturing *counts/behavior*, not raw private customer data.
3. Before test execution: establish synthetic cross-role/tenant fixtures in approved isolated staging, expected allow/deny outcomes, rate limits and a rollback/contact procedure.
4. Inspect secret usage paths in server code without decrypting Vercel environment variables; verify client bundles and browser code cannot access privileged keys.
5. Maintain **all 61 control checkboxes unchecked** until complete test coverage and documented evidence justify marking a specific control as passed.

### Session 4 log

| 2026-11-03 | Read-only audit assistant | P0 / C03 / C04 partial | Inventoried function search-path settings, grouped privileged functions by function-name pattern, reviewed the structure of storage object RLS policies and claim-portal access predicates. | P0-023 through P0-026; REV-2026-002 expanded; no real data accessed. | One priority authorization design review, no confirmed exploit, no changes to live policies. | Obtain business-owner scope, continue source/routine review, design synthetic staging tests. |

**Current metrics:** Total controls 61; controls fully passed 0; independently validated security exploits 0; open **review leads** 6. The six review leads must not be presented as six confirmed defects. All identified risks remain subject to owner confirmation, threat analysis and authorized testing.
