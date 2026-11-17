# AI Policy Onboarding — n8n primary intake processing (all open policy types)

## Scope and authorization (17 November 2026)

The user approved replacing the older parsing/readiness approach **inside Development → AI Policy Onboarding** with the connected n8n Cloud workflow as the single PDF extraction engine for **all open policy Intakes**. The aim is an expandable Intake → extraction → reviewed onboarding → policy-registration automation. This change is deliberately the **first stage**. It does not authorize bulk booking, automatic OCR overwrites, database migration, live insurer model training or disabling other Operations/Partner Intake upload pipelines.

This stage is limited to `/development/ai-policy-onboarding`; the original Policy Intake creation endpoints and standard Policy Onboarding retain their existing controls, including Google OCR where still configured. **There is no Google OCR fallback anywhere in the n8n-first workbench flow.** Claiming Google OCR is globally removed would be incorrect.

## Current verified data and parser coverage

Read-only production count at implementation: 153 open Motor Intakes, four open Non-Motor, and 73 historical unclassified Intakes (`policy_type = null`). 229/230 open Intakes had an eligible current private PDF at the time of this check. These numbers are historical evidence, not a permanent count.

The connected n8n workflow `Iu6WUQiHeGwfDol9` is authenticated and already provides signed Supabase Storage PDF retrieval and a strict, 13-check ICICI Lombard Product Code 3005 native-PDF parser. **Other insurers, policy types and image-only/scanned PDFs are NOT trained or guaranteed to parse.** The same workflow may be invoked for any authorized current PDF; its explicit `ok:false` or failed checks must produce a review-needed message instead of producing guessed fields or calling Google as fallback.

## Implementation

1. Feature gate: Vercel Production server-only `INSUREIT_N8N_WORKBENCH_PRIMARY=true` AND `INSUREIT_N8N_OCR_MODE=shadow`. The independent Vercel Intake/OCR routing flags remain untouched.
2. The existing workbench's authorized server route loads all non-completed Intakes in processing, ready_for_review, in_review and needs_attention, regardless of policy type, preserving pagination, direct `?intake_id=<uuid>` links and duplicate indicators. Legacy Motor-only layout remains when flag is off.
3. Selecting an Intake starts the n8n-only, server-authorized processing action; the page never invokes the legacy `checkSemiAutoIntake` / Google OCR route in primary mode. The **Run n8n again** button allows a deliberate retry for any current PDF.
4. The existing Development `manage_system:approve`, Super Admin/IT Super User and per-Intake reviewer/finalizer checks remain in place. Each request rechecks the exact current document record, PDF MIME, maximum 15 MB, matching private Storage path, and short-lived signed Storage URL. No Supabase service key is shared with n8n.
5. A validated ICICI 3005 response shows the extracted fields, exact changed fields, PDF page evidence and independently reconciled premium components. Unsupported/unverified layouts show **manual review / parser training required**, not a successful extraction or an old Google result.
6. Readiness checks, direct draft claiming/editing, failed-OCR application and Confirm & Book from this workbench are **disabled in primary mode on BOTH client and server**. They are still available only through separately authorized canonical Policy Intake/Policy Onboarding workflows, where applicable. The new page neither saves OCR nor changes an Intake status, drafts, assignments, customers, vehicles, policies or payouts.
7. The existing Motor-only `prefer`-mode recovery logic remains Motor-only and cannot be used through the new shadow primary workbench. Other legacy routes are not modified by this PR.

## Manual Vercel release

Target: team `antnish1s-projects`, project `insureit_new`, production domain `portal.insureit.in`.

1. Review PR, require green `Verify web portal` regression, typecheck, lint, and production build; merge only with user approval.
2. On Vercel Production, verify `INSUREIT_N8N_OCR_WEBHOOK_URL` and sensitive `INSUREIT_N8N_OCR_HEADER_SECRET`, keep `INSUREIT_N8N_OCR_MODE=shadow`, `INSUREIT_N8N_OCR_AUTO_ICICI_3005=false`, `INSUREIT_N8N_OCR_ALL_MOTOR=false`, `INSUREIT_N8N_OCR_ALLOW_REVIEW_APPLY=false`.
3. Set new Production config `INSUREIT_N8N_WORKBENCH_PRIMARY=true` (only after reviewing the code); manually deploy the merged commit using the existing GitHub Actions `Deploy INSUREIT to Vercel (Manual Only)` workflow.
4. Test one previously validated open ICICI 3005 Intake and one explicitly authorized Non-Motor/unclassified Intake: the latter should show **not yet trained/review required**, never a valid OCR result, no Google fallback and no changed Intake record. Verify direct PDF fetch and no booking.
5. If any failure or rollback needed, set `INSUREIT_N8N_WORKBENCH_PRIMARY=false` and manually redeploy. Do not enable `INSUREIT_N8N_OCR_ALL_MOTOR` for untrained policies.

## Full automation roadmap, not implemented by this change

- Introduce a versioned parser registry keyed by insurer, product, document layout and source type; add training/test fixtures for other insurers and scanned-document OCR.
- Validate invoice/OD/TP/CPA/tax/gross and coverage-specific rules per product; capture source-page evidence and explicit confidence/exception reasons.
- Add an audited, idempotent, atomic **review → apply-to-canonical-draft** handoff using current document ID, revision and duplicate/ownership checks; do not overwrite staff edits or existing drafts.
- Once all source and master-data checks pass, seek separate approval for controlled booking automation with customer/vehicle identity, OTP/date exceptions, policy duplicate checks, pay-in/payout handling and operator review queue.
- Decommission Google OCR elsewhere only after complete insurer/layout coverage is proven and a separate production migration is approved.
