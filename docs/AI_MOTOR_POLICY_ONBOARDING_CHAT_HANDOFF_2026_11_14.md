# INSUREIT — AI / Semi-Automated Motor Policy Onboarding: Complete Chat Handoff

**Prepared:** 14 November 2026 (IST)  
**Repository:** [Frontier-Group-IT/insureit_new](https://github.com/Frontier-Group-IT/insureit_new)  
**Operations portal:** https://portal.insureit.in/  
**First-workflow route:** /development/ai-policy-onboarding  
**Current UI menu:** Operations Portal → Development → AI Policy Onboarding (Pilot)  
**Snapshot main at handoff drafting:** 7bdd9deb49a0217af0f2320bdfce1132eace0ff8 (14 Nov 2026, 10:20 UTC)  
**Purpose:** Preserve the decisions, investigation, designs, shipped code, production observations, two corrective PRs, exact technical boundaries, and open work from the November 2026 chat. Historical numbers below are point-in-time observations and must not be mistaken for live counts.

> **Read this first on continuation:** The implemented screen is **semi-automated**, not an autonomous AI agent. Checkbox selection only checks readiness; an authorized human explicitly corrects or confirms booking. The system uses existing OCR, deterministic checks, Supabase records and canonical policy-booking actions. No separate LLM, n8n workflow, scheduled worker, automated RC provider call, or automatic pay-in/payout rate-card system was added in this chat. A merge is not proof of portal deployment.

## 1. User request and decisions

The original strategic request was to reduce or eliminate manual Operations Policy Onboarding **after an issued policy is uploaded through Policy Intake**. The automation should extract policy details from PDF/image, resolve the customer/vehicle and lead source, validate policy identity, cover dates and premium, and onboard through INSUREIT's existing transactional Motor policy flow. Humans should handle only genuine exceptions, conflicts or mandatory approvals.

The user then explicitly approved building the functionality, with a **first, semi-automated draft**:
- Separate page, nested under the **Development** menu in the **Operations Portal**.
- Show existing Policy Intake rows with a checkbox, one selected Intake at a time.
- Selecting the checkbox attempts a comprehensive **read-only readiness assessment**, not booking.
- For complete and eligible data, provide an explicit **Confirm & book** action. For incomplete or conflicting data, show specific field-level errors, and offer **Open & correct fields**.
- Do not replace the existing Policy Intake flow or bypass reviewer, date OTP, duplicate, identity, vehicle ownership or policy overlap safeguards.
- Motor policies first. Other products and full unattended processing are future scope.

Subsequent user screenshots identified two defects, which were investigated and fixed: (1) raw-status duplicates polluted the new page although the canonical Policy Intake register had **Action Required 0**; (2) a selected Intake assigned to another reviewer could not be opened for corrections. The user explicitly requested both fixes, then reviewed and authorized their merge.

## 2. What was merged

### PR #4321 — First semi-automated Development workbench

- **PR:** https://github.com/Frontier-Group-IT/insureit_new/pull/4321
- **Merged 12 Nov 2026, 08:18 UTC**, merge commit **9de492d24b75108788d25cd84dcb18f041b3ea2d**.
- **CI:** [Verify web portal run 43181124952](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/43181124952), successful (regressions, typecheck, lint, production build).
- New admin-only Operations page with an Intake table, search, paging, checkbox selection and side-panel **AI Booking Check**.
- Readiness assessment evaluates current document/OCR, duplicate status, draft data, customer identity and phone, source/RM, vehicle attributes, policy/cover dates, insurer/product, premium, CPA, date approvals, and selected low-confidence fields. Errors are grouped by Intake / Source / Customer / Vehicle / Policy / Premium / Approval.
- Correction opens the **existing** policy form under /policies/new?intake_id=... using the canonical Intake handoff and saved draft.
- Booking is separated from checkbox selection, requires a browser confirmation, rechecks conditions and calls **onboardPolicy**, which in turn uses the existing Motor RPC. No ad-hoc direct policy-table insert.
- Commercial pay-in and partner payout are not inferred from history or invented rate cards; the booking payload marks these values as **provided: false**, retaining downstream commercial-review requirements.
- No database migration or production policy data mutation was performed during development/testing of the PR. The user later supplied a screenshot proving the *initial route* was accessible in the portal; the exact release mechanism was not verified in this chat.

### PR #4322 — Canonical duplicate filtering and explicit reviewer takeover

- **PR:** https://github.com/Frontier-Group-IT/insureit_new/pull/4322
- **Merged 12 Nov 2026, 09:27 UTC**, merge commit **85feb65c52c5339150d416896c21c467e65b81b1**.
- **CI:** [Verify web portal run 43188586622](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/43188586622), successful (dedicated semi-auto regression, typecheck, lint, build).
- Prior page queried only raw statuses ready_for_review / in_review / needs_attention / processing; unlike the main register, it ignored *derived* duplicate classification on the listing. A raw ready_for_review row may actually be a duplicate.
- Fix: retrieve all candidate Motor Intakes with fetchAllPages, call existing loadPolicyIntakeDuplicateMatches, classify through shared policyIntakeBucket, **exclude duplicate and non-actionable buckets before pagination**, clamp the page index, and show an excluded-duplicate count. A duplicate-check error fails the list closed. No mass update of stored statuses.
- Prior **Open & correct fields** called preparePolicyIntakeHandoff without takeover, so the canonical server correctly rejected an Intake owned by another reviewer and the UI could not proceed.
- Fix: expose the current reviewer's name in a conflict result and present a separate **Take over & open** confirmation. Only the explicit second action calls editSemiAutoIntake(id, true), which reuses the canonical permission, duplicate and compare-and-set assignment checks before navigating to the saved draft. Cancel changes nothing; takeover alone does **not** book a policy.
- No live Intake takeover or policy booking was performed during this PR's investigation or testing.

**Code-review and release note:** Both PRs were merged after their own green GitHub workflows. The second fix was merged into main; this chat did **not** trigger a production deployment of that fix. Verify the current deployed commit/runtime before claiming that PR #4322 is live.

## 3. Current code map (verify newest main before editing)

| File | Responsibility |
|---|---|
| apps/web-portal/components/claim-manager/app-navigation.tsx | Development menu link and admin-only visibility. |
| apps/web-portal/app/development/ai-policy-onboarding/page.tsx | Admin-only page, all-candidate read, shared duplicate classification, filtering and pagination. |
| apps/web-portal/components/development/semi-auto-policy-workspace.tsx | Single-row checkbox, readiness panel, correction, confirmation-controlled takeover and booking UI. |
| apps/web-portal/app/development/ai-policy-onboarding/actions.ts | Server-only review authorization, Intake lookup, read-only preview/validation, canonical handoff, booking payload and conflict responses. |
| apps/web-portal/lib/policy-intake-semi-auto.ts | Pure Motor readiness rules and field-level reasons. |
| apps/web-portal/scripts/policy-intake-semi-auto-regression.mjs | Positive/negative readiness, queue parity, explicit takeover, no direct policy insert regression. |
| .github/workflows/verify-web-portal.yml | Mandatory PR web regression, typecheck, lint and build jobs; runs the semi-auto script. |
| apps/web-portal/lib/policy-intake-duplicate.ts | Shared registered-policy and earlier-Intake duplicate detection. |
| apps/web-portal/lib/policy-intake-status-buckets.ts | Canonical derived status buckets (duplicate takes precedence). |
| apps/web-portal/app/policy-intakes/handoff-actions.ts | Reviewer assignment, atomic takeover, saved draft creation/revision and matched customer guard. |
| apps/web-portal/app/policies/policy-onboarding-actions.ts | Authoritative customer/vehicle/source/date/coverage validations and server-side Motor transaction. |
| apps/web-portal/app/policies/policy-onboarding-conflicts.ts | Policy/vehicle/coverage/active-policy conflict checks. |
| apps/web-portal/app/policies/new/page.tsx and components/policy-unified-form.tsx | Canonical manual correction/edit form. |
| apps/web-portal/lib/policy-ocr-onboarding-apply.ts | Existing insurer and policy OCR → policy form mapping. |
| apps/web-portal/lib/policy-intake-ocr-service.ts | Google Document AI and insurer-specific OCR sources. |
| apps/web-portal/lib/policy-date-rule.ts | IST policy issuance-date and prior-month/older-policy OTP rule. |

**Authority:** The Development menu and page are limited to IT Super User / Super Admin with manage_system:approve; the server also applies record-specific Intake reviewer/finalizer checks and the existing policy creator checks. These checks must not be weakened to fix access problems.

## 4. Exact expected operator journey

1. Authorized Operations admin opens **Development → AI Policy Onboarding (Pilot)**. Only eligible *effective-status* Motor Intakes appear. Duplicates are omitted and reported in the count, even if their stored database status says ready_for_review.
2. Admin selects **one checkbox**. The page runs checkSemiAutoIntake(id) and displays detailed failures. This selection/recheck performs no policy-booking mutation.
3. If data or evidence is missing, use **Open & correct fields**. This uses preparePolicyIntakeHandoff and may claim an unassigned Intake / prepare a draft; opening a draft is *not* a generally read-only action.
4. If another reviewer owns the Intake, the server returns the conflict and current reviewer. Confirm **Take over & open** to reassign through the canonical guarded handoff; otherwise Cancel preserves assignment. After handoff, edit the existing Policy Onboarding form and save corrected values.
5. Return to the AI page and **Recheck**. The booking button is only available when the preflight reports zero issues. A saved/verified issuance date is especially important: the original Intake handoff can default that date to the processing day, which is *not* PDF evidence.
6. **Confirm & book** presents a separate final confirmation, performs server-side checks again, and calls onboardPolicy. The underlying transaction performs the decisive validation. Booking may still report customer-match, ownership, duplicate, overlap, coverage or date-approval conditions that need normal Operations handling.
7. After success, verify the Policy Register entry, linked customer and vehicle, source policy copy, premium and commercial review statuses; confirm the Intake is Completed. Never rebook a timed-out request until checking the actual saved policy/Intake first.

Do **not** force a blocked item through the AI page. Use the existing governed manual workflow or the relevant exception/approval process.

## 5. Read-only discovery and exact root-cause evidence (historical snapshots)

### Baseline: rolling 30 days ending 12 Nov 2026

The investigation used metadata/aggregate-only read access to the **production Supabase** database, not an isolated staging database.

- **872** Motor Intakes created in the observed rolling 30 days.
- **731** were Completed and each had a final_policy_id; **80** raw ready_for_review, **3** raw in_review, **57** rejected and **1** processing/failed OCR at that earlier checkpoint.
- For completed cases with valid timestamps, median Intake → booking elapsed **20.04 h**, p90 **71.55 h**. These are elapsed periods, not labor time.
- Of those 731 completed: insurer pay-in needs_review **41**, entered **690**, reviewed **0**; partner payout needs_review **59**, entered **672**, reviewed **0**. Entered is **not** verified/reviewed.
- OCR *key presence* in the 872: insurer_name 857, policy_product 861, policy_number 840, idv 840, engine 749, chassis 575, registration 370, make 709, model 733, capacity 739, RTO name 789, RTO state 118, start date 183, end date 186, OD premium 115, TP premium 93, insured_name 32, tax_amount 774, gross_premium 763. **Presence is not accuracy or final policy completeness**.
- Insurer-parser concentration: ICICI Lombard Motor **388** and Universal Sompo Motor **310**, together **698/872 (~80%)**. They are priority cohorts for fresh source-PDF truth verification.
- Frozen historical OCR benchmark from **24 Aug 2026**: **80.4% field precision (267/332)**, **68.7% coverage (332/483)**, **0/20 perfect records**. This **is not** a November accuracy measurement after parser improvements.

### Screenshot defect: raw status versus derived duplicate

A later read-only production query on 12 Nov 2026 found **44** raw Motor candidates on the new page:
- Raw ready_for_review **40**: **35** matched existing registered policy numbers, **5** matched an earlier Intake; **0** genuinely actionable.
- Raw in_review **4**: **1** matched an existing registered policy, **3** were non-duplicates.
- Therefore **41/44 were duplicates**, and **3** were genuine in-review Motor Intakes. This matches the screenshot of the main register with Action Required 0, and explains the apparent discrepancy with the AI page.
- The record-specific booking server already checked duplicates; the defect was the **new listing and labels**, not proof of duplicate policies being booked.
- These counts are only the checkpoint diagnostic, **not a promised live count** after further submissions or review actions.

## 6. Underlying architecture and why booking reuses the existing RPC

- Sales/Partner uploads an issued policy copy through Policy Intake into private storage; Intake, OCR output and document versions are retained. Life/Health proposal forms follow a distinct path and must not be booked as issued Motor policies.
- Motor/Non-Motor OCR uses Google Document AI plus insurer/product refiners, preserving keyed fields and source evidence. Current enrichment is limited; document evidence must be independently checked.
- Operations handoff stores a revision-controlled draft in policy_intake_onboarding_drafts and enforces assigned reviewer and finalizer authority. A draft can contain placeholders such as current-day issuance date, CPA Opted No, empty RM and commercial terms; these must not be mistaken for verified policy facts.
- The canonical Motor save path is **save_motor_policy_with_date_approval_v1 → save_motor_policy_with_addon_v1 → finalize_policy_intake_motor_v1**, with internal commercial status/booking routines. The transactional finalizer locks/validates Intake and draft, creates/links policy, source document and related records, and marks the Intake Completed as one controlled workflow.
- A separate AI service must not directly insert customers, vehicles or policies and bypass this process. Booking authority is anchored in current roles and service-side validations, not in OCR confidence or browser UI.

## 7. Current pilot scope, gaps and follow-up risks

These are deliberate limitations and areas for further testing, **not completed capabilities**:

1. **Not autonomous AI:** No external generative-model call, background worker, unattended automatic booking, durable job queue, agent runtime, n8n integration or provider auto-enrichment was added.
2. **Evidence and date:** The preflight treats missing/unverified issuance dates as blockers and preserves prior-month/older-date email OTP. Validate actual issue-date evidence instead of relying on the handoff's default current date or a casually updated draft revision.
3. **Product coverage:** First version is Motor only; bundled policy dates/add-ons and manual conflict decisions remain standard onboarding; Non-Motor and Life/Health require separate contracts and workflows.
4. **Premium accuracy:** Pure readiness checks cover some mandatory monetary fields and printed net/tax/gross consistency when those OCR keys exist, **not a complete per-product source-PDF premium audit**. Current booking payload sets addOnPremium to 0 and populates other fallback values; do not treat these as verified for policies with nonzero add-ons, specialized CPA, bundled or multi-term coverage. Audit before widening pilot.
5. **Commercials:** Pay-in/payout payload uses zero-like placeholders with **provided:false**, not approved 0% rates. Business status should remain needs_review if no verified terms were provided. Versioned insurer/partner rate cards and Finance reconciliation are not implemented. Do not turn provided=true or reviewed on without verified commercial evidence.
6. **Customer/vehicle conflicts:** The canonical server may require selection among similar customers or ownership/vehicle collision decisions; the AI page does not automate these decisions. No silent transfer, merge, active policy replacement or overlap override.
7. **Duplicate detection scale:** Existing shared duplicate helper compares registered policies and scans an ordered, bounded historical Intake slice (currently limit 5000 for earlier-Intake matching). Verify correctness/performance for higher volumes and historical rows beyond that bound before large-scale automation; do not redefine duplicate semantics only for this page.
8. **Scope and performance:** AI page currently retrieves all Motor candidates for shared duplicate classification and filters before its 75-row UI pagination. Keep classification parity while monitoring query cost and index/pagination behavior.
9. **Human authorization:** Reviewer takeover intentionally changes assigned_to_profile_id *only after confirmation*. Never bypass active assignment/race detection or OTP. One-click booking is not risk-free; preserve human confirmation in pilot.
10. **End-to-end QA:** CI covers regression contracts, typecheck, lint and build. No authenticated, representative, real policy end-to-end booking or browser takeover regression was executed in this chat. Production data was inspected **read-only** for diagnosis. Test with permitted safe fixtures or explicit controlled approvals before enabling writes.
11. **Deployment evidence:** User screenshot showed the first page accessible at the production URL before PR #4322. The second fix merged into main but no deployment was initiated here. A current website build/version and authenticated browser acceptance are still needed to certify both fixes live.
12. **No staging DB:** INSUREIT has no separate preview/staging Supabase database in the working context. Use read-only production investigation, local/disposable test fixtures and explicit authorization for any live write test.

## 8. Proposed staged roadmap toward full automation (historical 12 Nov plan)

The initial implementation plan was **designed before the user selected the semi-automatic pilot**. Its 6–10 week estimate for a broader, safer initial autonomous release was a planning assumption, not a promise, and does not represent implementation completed in the two PRs.

- **P0 — Truth and permission contract:** insurer/product-specific PDF truth sample; documented source/field mapping, source/vehicle/customer authority, commercial rules, explicit automation approval and allowed AI processing environment.
- **P1 — Canonical evidence-bound proposal:** OCR improvements (prioritize ICICI Lombard and Universal Sompo), per-field source/page/confidence/provenance, correct issue dates and product-specific OD/TP/CPA/bundled terms.
- **P2 — Deterministic eligibility:** customer/vehicle matching, uniqueness, coverage, source/RM, premium/GST, conflict classification; unknowns become exceptions, not guesses.
- **P3 — Shadow/no-write evaluation:** compare proposals to independently verified policy PDFs and approved data, not only historical bookings; target zero *observed* critical errors in representative test cohort.
- **P4 — Evidence-first exception UI:** show precise differences and only missing/ambiguous fields; expand the existing assisted workbench, not a second booking transaction.
- **P5 — Separately approved autonomous canary:** narrowly scoped machine authorization, durable idempotent work queue, document-version lock, immutable audit, retry/kill switch, monitored low-risk cohorts, post-booking reconciliation. **No unattended writes without a new explicit release approval.**
- **P6 — Commercial automation:** approved and versioned insurer pay-in / intermediary payout terms, Finance reconciliation and needs_review workflow for missing terms.
- **P7 — Product and insurer expansion:** each layout/product requires independent evidence and acceptance; Non-Motor and Life/Health remain separate products and issued-policy lifecycles.

Long-term **60–80% touchless** among *fully verified, supported low-risk Motor policies* was aspirational, **not** measured or achieved. Prioritize zero critical wrong bookings, permissions and correct audit records before automation percentage.

## 9. Resume / acceptance checklist for the next developer or agent

1. Read current **AGENTS.md**, this document, canonical Policy Intake/booking files, and newer merged changes. Do not assume the handoff's 14 Nov main SHA is still current.
2. Check portal runtime/commit and actual deploy history (Vercel vs Cloudflare as currently configured). A merged PR does not necessarily deploy production.
3. Read-only test of the AI page as an authorized IT Super User/Super Admin; verify **effective Action Required/In Review = canonical register counts** for the same Motor scope and that duplicates are excluded before pagination.
4. For an Intake assigned to another reviewer, click **Open & correct fields**: verify named confirmation, Cancel no mutation, authorized **Take over & open** changes only the intended Intake assignment and navigates to the saved draft. Use controlled fixtures or explicitly authorized records; capture reviewer/race negative cases.
5. Verify direct Intake read permissions, reviewer/finalizer permissions, copy integrity and duplicate protections server-side, not just hidden buttons.
6. Review draft revision and issuance-date truth; confirm correct handling of missing issue date, OTP-needed date, no current copy, missing source/RM, invalid vehicle identity, unknown policy number and financial discrepancies.
7. Execute any **booking** integration test only against a permitted local/disposable environment or a separately approved, designated production test case. Verify one-and-only-one final policy, policy copy, customer/vehicle links, Intake Completed and commercial needs_review status.
8. For failed/ambiguous response, check actual policy existence before retry; avoid double booking.
9. Confirm no unauthorized service-role or sensitive document bytes leak to client logs, AI prompts or external providers.
10. For any future change, use a new branch/PR, run relevant GitHub workflow checks, and obtain explicit merge/deploy/migration/OTA approvals.

## 10. References and continuity

### Merged work and checks
- [PR #4321 — Semi-auto Development page](https://github.com/Frontier-Group-IT/insureit_new/pull/4321) and [CI 43181124952](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/43181124952).
- [PR #4322 — Duplicate filtering and reviewer takeover](https://github.com/Frontier-Group-IT/insureit_new/pull/4322) and [CI 43188586622](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/43188586622).

### Existing repository source documents
- [AGENTS.md](../AGENTS.md)
- [INSUREIT project context](INSUREIT_PROJECT_CONTEXT.md)
- [Policy Intake count and duplicate parity](POLICY_INTAKE_UNIFIED_STATUS_COUNTS_2026_11_10.md)
- [Sealed OCR benchmark](POLICY_OCR_FRESH20_BLIND_RESULT_2026-08-24.md)
- [Policy OCR Google Document AI](POLICY_OCR_GOOGLE_DOCUMENT_AI_HANDOFF.md)
- [OCR automated training](INSUREIT_POLICY_OCR_AUTOMATED_TRAINING_SKILL.md)
- [Policy issuance-date email OTP](POLICY_DATE_EMAIL_OTP_APPROVAL_2026_11_03.md)
- [AuthBridge RC fetch handoff](VEHICLE_AUTHBRIDGE_RC_FETCH_HANDOFF_2026_09_16.md)

### Historical documents prepared in this chat
Two dated local reports were created **before** implementation:
- INSUREIT_AI_POLICY_ONBOARDING_FEASIBILITY_2026-11-12.md — read-only architecture, production aggregates, OCR-key presence and risk assessment.
- INSUREIT_AI_POLICY_ONBOARDING_IMPLEMENTATION_PLAN_2026-11-12.md — proposed P0–P7 roadmap, acceptance/testing strategy and ownership decisions.

The historical findings and plan are **consolidated above**. Their original pre-implementation status labels are historical and should not be treated as the current implementation status. No PII, production secrets, raw policy PDF bytes, or customer-specific identifiers are intentionally recorded in this handoff.

---

**Status at handoff creation:** Code for both the first semi-auto page and the duplicate/reviewer fixes is merged into main. This documentation change alone does not alter application behavior, data, permissions, financial rules, or deployments. Its future publication in main must follow GitHub CI and explicit merge verification.
