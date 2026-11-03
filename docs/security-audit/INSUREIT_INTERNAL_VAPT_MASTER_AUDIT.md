# INSUREIT — Internal VAPT & Cybersecurity Self-Audit Master Register

> **Document ID:** INS-SEC-IAV-001  
> **Version:** 0.2.0 (P0 discovery initiated)  
> **Created:** 2026-11-03 (Asia/Kolkata)  
> **Owner:** Sankalp Insurance Brokers Private Limited — designated internal audit owner **TBD**  
> **Target systems:** INSUREIT Customer App, Partner App, Operations Portal, APIs, database, storage, infrastructure, third-party integrations and related governance  
> **Status:** **P0 READ-ONLY DISCOVERY IN PROGRESS — 61 CONTROLS NOT YET PASSED**  
> **Classification:** Internal / Confidential — redact secrets, customer data and exploitable details before distribution  
> **Next review:** On each completed audit work session; formal periodic review cadence TBD

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
- [ ] Corroborate actual production Supabase and hosting IDs from deployed configuration, without exposing secrets.
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
