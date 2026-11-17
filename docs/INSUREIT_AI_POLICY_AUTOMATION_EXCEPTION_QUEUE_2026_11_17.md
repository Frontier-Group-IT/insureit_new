# INSUREIT AI Policy Onboarding — unattended extraction, exception desk and one-click conversions

Status: **Implementation RFC + initial fail-closed eligibility module**, **NOT** a booking-system enablement. This document is deliberately explicit about unimplemented release steps. No migration or production booking is applied with this PR.

## Product goal

From `/development/ai-policy-onboarding`:
1. New/changed Policy Intakes are extracted by n8n automatically without selecting each row or clicking Process.
2. A durable per-Intake `Processing / Eligible / Exception / Not trained / Converted` result appears in the queue; status includes a last-processed time and active document version.
3. Each Exception cell identifies an actionable issue, with a **Resolve** button opening a focused INSUREIT modal. **Advanced options** link to the canonical customer, vehicle or policy-onboarding workflow.
4. **Convert to Policy** performs an explicit single-Intake conversion only for currently verified, exception-free, canonically preflighted records.
5. **Convert All Eligible** previews its exact scope and requires one final operator confirmation; runs a durable, bounded, idempotent batch. Exception rows are never included.

A successful n8n extraction is **not** an automatic policy booking. No conversion action may trust the browser's fields, stale preview, inferred customer IDs, or an existing PDF fingerprint.

## Verified existing architecture (2026-11-17)

- `SemiAutoPolicyWorkspace` currently invokes `previewSemiAutoN8nIntake` only after selecting a row; extraction is read-only and ephemeral.
- The list shows all open Intakes, paginated 75 at a time. Live read-only count at design time: **295 open**, **218 Motor**, **77 other/unclassified**, **205 Intakes across 20 shared-mobile groups**. These counts may change; never hardcode them in UI or tests.
- `INSUREIT_N8N_WORKBENCH_PRIMARY` enables an n8n-first review mode; the only confirmed trained layout is ICICI Lombard **Motor Product 3005**. Untrained insurer/business-line formats must stay `Parser not trained` instead of using an unvalidated Google OCR fallback.
- Existing n8n handoff re-extracts the current private document, verifies fingerprint, ownership/reviewer, insurer parser and 13 checks, and prepares a revisioned draft. It must not overwrite saved manual values.
- Current `bookSemiAutoIntake` **disables booking** in n8n-primary mode; it must not be bypassed until a dedicated, reviewed n8n conversion action exists.
- `onboardPolicyForVerifiedActor` is the canonical policy transaction. It handles customer candidates, ownership, policy conflicts, date OTP, duplicate and revision safeguards; the actual Intake booking uses `save_motor_policy_with_date_approval_v1` with `p_operation='intake'`. Do not create a parallel direct-INSERT booking path.
- Existing legacy `payloadFromDraft` sets `addOnPremium:'0'` and `issuanceDate` can be defaulted to the day of handoff. **Both are blockers for one-click automation** until exact n8n Basic OD/add-ons and independently verified PDF `Policy Issued On`/issuance date are carried through.

## Release architecture (separate flag-controlled phases)

### A. Persistent unattended extraction (read-only; no policy/customer write)
- Introduce private service-role-owned `policy_intake_ai_assessments` storage (migration, RLS enabled, no access to anon/authenticated). Hold only Intake ID, current-document ID, extraction fingerprint, verified-at timestamp, parser/version, premium validation indicators, issue codes, attempt/retry/lease metadata and opaque audit IDs. Do **not** store full PDF, signed URLs, contact/chassis/engine text or raw parser payload here. Keep full values only inside current protected policy/Intake data and re-extract on conversion.
- Trigger server-side n8n extraction from a trusted scheduler (new queue-claim endpoint called by scheduled job); never place a service secret or signed PDF URL in the browser. Avoid launching 75 n8n jobs on every page render.
- Use unique `intake_id + current_document_id` identity and atomic `SKIP LOCKED` / lease ownership for retries. Reprocess when document changes, parser version changes or an operator requests a recheck, not on every page view.
- Limit n8n concurrency and backoff failures; make the schedule explicit and configurable. Stale results, replaced PDFs and completed/rejected Intakes must not remain eligible.
- Restrict every list and action to the existing exact Development super-admin/IT admin permissions **and** per-Intake reviewer/finalizer checks. The service worker can extract; only the operator can convert.
- UI must show durable counts (`Eligible`, `Exceptions`, `Processing`, `Not trained`, `Converted`) covering the authorized entire queue, not the visible 75-row page.

### B. Exception engine and one-click resolutions
The pure initial classifier lives in `lib/ai-policy-onboarding-eligibility.ts`; treat every non-empty exception list as **blocking** for both row and bulk conversion. A separate read-only canonical preflight must pass before any row is labeled Eligible. Populate classifier inputs from trusted server lookups, not browser flags.

| Exception | Default one-click action | Advanced / hard stop |
| --- | --- | --- |
| Same mobile used for **different** insured names | **Resolve Customer** modal with exact existing candidate identities and explicit `Create new customer` / `Link existing`; recheck phone, name and any duplicate before transaction | Full Customer Onboarding; never overwrite an unrelated customer or auto-use first phone match |
| Multiple customer candidates / name mismatch | Select a verified matching record, or explicit new-customer decision if no matching identity | Canonical Customer Register; no silent merges |
| Duplicate Policy Number / earlier Intake | View existing policy/intake | **Never bulk-convert** or override |
| Current PDF missing/changed, parser untrained, invalid extraction or insufficient confidence | Re-extract or open training/review | Manual Intake, no Google fallback |
| Vehicle already belongs to another customer | View owner/vehicle history | Existing audited **Transfer Vehicle** workflow; cannot transfer ownership inside automatic conversion |
| Manufacturer, class, RTO, kW, policy product or issue date missing | Open focused field correction in canonical draft | Edit full Policy Onboarding; no guessed details |
| Premium calculation, OD add-ons, TP/CPA expiry or policy validity mismatch | Review exact breakdown and signed PDF | Stop booking until approved corrections reconcile |
| Active policy, coverage overlap/gap, earlier policy history | Review coverage decision | Existing canonical conflict flow; privileged approval as required |
| Earlier-month policy issuance date | Date Approval dialog | Existing email OTP flow; cannot auto-approve |
| Reviewer ownership conflict, stale draft or changing PDF | Reassign/recheck | Existing reviewer takeover dialog or refresh/revision CAS |
| Unexpected database/timeout or ambiguous booking response | **Check Policy Register** before retry | Idempotent transaction, audit log, no duplicate on repeat |

A mobile number repeated on several policies for **one verified customer** is not by itself a customer-identity conflict. Different verified insured names under that phone, or no unique approved matching customer, are blocking and require a human decision.

### C. Deterministic single and bulk conversion
- Add a read-only **canonical preflight** that shares customer candidate, vehicle owner, coverage, document, OTP, master, issue-date and premium checks with the transaction engine. A green n8n parser result **alone must never label a row Eligible**.
- Carry verified policy issuance date, Basic OD, add-on OD total, TP/CPA expiry, optional customer resolution and exact source document into the canonical `PolicyOnboardingPayload`. Never use today's date unless it is verified in the PDF. Preserve the original `PolicyIntakeDraft` and revision.
- Single conversion must be two steps: row **Convert** → custom confirmation popup → server re-verifies the current PDF and canonical preflight → existing transactional RPC. Re-extract/compare fingerprint, do not accept browser values. Never create an unsupported or duplicate policy.
- Bulk conversion uses exact server-side eligible IDs, with summary preview; individual failure is isolated and recorded. Bounded batches (e.g. 5–10 policies per execution; job queue continues until completed), proper retry leases, progress and per-policy result. Do not bulk-run a client `Promise.all` of booking RPCs.
- Force every conversion to be idempotent by Intake ID and current document+draft revision and check existing linked policy before retrying after timeouts. Require server-side exact role/reviewer/finalizer permissions on each item.
- Before enabling conversion, verify source parity, add-on reconciliation, TP/CPA dates, original PDF policy issuance date and user-facing error handling. Do not bypass email OTP or policy history decisions.

## Acceptance tests
1. Two different insurers / an untrained policy category: `Not trained`, never eligible.
2. Chetak C2501 and CHETAK 3503: n8n extraction correct; class, Bajaj, fuel, kW, RTO, premium, issuance and bundled TP/CPA dates all verified.
3. Same mobile, same verified person across multiple policies: no false customer conflict if one unique exact customer match.
4. Same mobile, two different insured names: blocking identity exception; popup can choose a *new* customer only after explicit confirmation, with canonical transaction.
5. Duplicate policy, mismatched chassis, customer ownership, coverage overlap or wrong source: blocked; cannot enter bulk selection.
6. Stale fingerprint, replaced PDF, changed draft revision or another operator's reviewer assignment: recheck instead of booking.
7. Missing Basic OD add-on, CPA consent, unverified issuance date or date OTP: no one-click eligibility.
8. Double-click, parallel bulk workers, timeout and retry: at most one registered policy per Intake; uncertain outcomes are reconciled from the register.
9. 295+ Intake queue paging: full authorized totals correct, no 75-row-only count; parser processing is bounded and durable.
10. Each succeeded booking is auditable with actor, Intake ID, PDF version, decision and policy ID; no PII/secret is written to job logs.

## Rollout gates
1. Code review and CI on a separate PR; no merge until requested.
2. Apply private queue migration **only after explicit approval**. Production is the only available DB; never run speculative customer/policy writes for QA.
3. Enable extraction worker behind an opt-in flag, inspect safe queue metrics; no booking allowed.
4. Verify the read-only canonical preflight and exception resolver with synthetic fixtures, then enable one-at-a-time booking behind a separate flag after real authorized review.
5. Only after successful single-item transactional tests, enable confirmed bulk conversion with strict per-item rechecks.
6. Manual GitHub Actions deployment; confirm exact commit and full authenticated user journey rather than relying only on CI or a deployment status.

**Current PR scope:** exception vocabulary + pure fail-closed test gate and this implementation specification. It deliberately does not schedule n8n, write an assessment table, enable conversion, or change current production behavior. This prevents accidentally automating policy creation before the canonical conflict/approval path has been integrated.
