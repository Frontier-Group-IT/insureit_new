# INSUREIT — n8n-verified Policy Intake → editable Policy Onboarding handoff

## Goal and existing flow

In Production Vercel **Development → AI Policy Onboarding**, the n8n workflow `Iu6WUQiHeGwfDol9` can securely extract a privately stored Motor PDF and display field evidence and premium reconciliation. The user requested a **Continue to Policy Onboarding** button so the reviewed PDF can enter the **existing** `/policies/new?intake_id=<uuid>` form. The user wants this **semi-automated**, with further automation only after validated source coverage.

This change **does not auto-book**, call any new backend booking endpoint, disable Google OCR in other ingestion flows or train unrecognized insurer/product layouts. The current strict n8n parser supports ICICI Lombard Product 3005 digitally readable Motor PDFs; other insurer and non-Motor layouts remain manual-review only.

## User flow

1. Authorized Development operator opens `/development/ai-policy-onboarding?intake_id=<uuid>`, selects an open Motor Intake and reviews the successful n8n extraction. Duplicate, completed, rejected, untrained and warnings-bearing Intakes do not receive the Continue button.
2. Click **Continue to Policy Onboarding** and explicitly confirm that this action will assign/claim the Intake for review and open an editable saved draft, **not book a policy**.
3. The server checks Development operator, reviewer, finalizer and canonical policy-creator permissions, requires n8n-primary shadow mode, re-extracts the **current** private PDF, validates all 13 checks with no warnings, matches its document UUID and server-issued SHA-256 fingerprint (covering fields, warnings and the full validated premium breakdown) against the reviewed preview. The browser never supplies editable OCR fields or Storage paths.
4. Duplicate checks run **twice**, against both the existing OCR and the verified n8n policy number. The current document ID, storage path and bucket are checked before and after the assignment claim; non-Motor, completed/rejected, duplicate and unsupported statuses are rejected.
5. If assigned to another reviewer, the existing assignment is preserved until the operator explicitly confirms a takeover. Existing saved drafts are **never overwritten**; the operator receives an explicit warning and reviews them manually.
6. For a new draft, the same canonical `preparePolicyIntakeHandoff` pipeline creates an `in_review` draft using only the validated n8n fields plus non-OCR Intake source data. The existing manufacturer/insurer master matching and customer-identity matching logic are reused; unresolved values remain blank for manual correction.
7. The page redirects to `/policies/new?intake_id=<uuid>` and displays an n8n-verified review banner for newly generated drafts. The existing Policy Onboarding form handles edits, draft revision tracking and **explicit manual final booking** with all prior server- and database-side safety controls.

## Premium and coverage mapping

The canonical form computes **Net = Basic OD + OD Add-ons + TP + CPA**. The n8n `od_premium` field refers to **Total OD**. To prevent double-counting, the handoff derives Basic OD and the total of verified individual add-ons from n8n's validated premium breakdown, and sets form fields separately:

- `od = basicOd`
- `addOnPremium = SUM(odAddons)`
- `tp = basicTp`
- `cpa = cpa`, `cpaOpted=Yes` only if CPA is positive
- `tpValidUpto = third_party_end_date` if extracted
- `validFrom` and `validUpto` use validated OD dates via the standard OCR-to-form mapping.

The handoff rechecks that Basic OD + add-ons = Total OD, TP + CPA = total liability, and Total OD + liability = net. It refuses arithmetic mismatch. The original n8n evidence and premium details remain available in the Development review; a summary of the verified PDF financials and third-party period is copied into the draft's human-visible remarks. **Third-party start** and **CPA expiry** do not have a separately verified canonical field in this handoff and require operator review. Commercial rates, customer/vehicle matches, vehicle class/product, missing field masters and payout details remain subject to manual review.

A fictional regression fixture asserts `1583 + 683 + 3273 + 575 = 6114` and rejects a 1-rupee mismatch; no real customer PDF is embedded in tests.

## Safety and rollout

- **No production writes during implementation or CI.** The only data write occurs after the authorized operator clicks Continue and confirms: existing canonical reviewer claim/status transition plus a new versioned draft, not booking.
- **No n8n credentials, signed PDF tokens, raw customer PDF bytes, temporary OCR payloads or customer details appear in the repository or logs.**
- Keep Vercel Production `INSUREIT_N8N_WORKBENCH_PRIMARY=true`, `INSUREIT_N8N_OCR_MODE=shadow`, `INSUREIT_N8N_OCR_ALLOW_REVIEW_APPLY=false`, `INSUREIT_N8N_OCR_ALL_MOTOR=false`, `INSUREIT_N8N_OCR_AUTO_ICICI_3005=false`.
- Require green GitHub Web Portal regressions, TypeScript, lint and production build. Merge only on approval. Use the existing **Deploy INSUREIT to Vercel (Manual Only)** workflow on `main`.
- After deployment, use a **non-duplicate, open, explicitly authorized, verified ICICI 3005 Intake**. Review fields and original PDF, click Continue, verify the draft receives mapped values without double counting, manually complete remaining fields, and **do not actually book a test policy without separate authorization**. Verify takeover/duplicate/expired/stale-document negatives.
- Roll back the web UI via the previous Vercel deployment (or revert PR). Leaving the workbench in shadow mode prevents automatic OCR replacement/booking; the old Policy Intake review and Policy Onboarding paths remain available.

Future work: multiple insurer parsers, scanned PDF extraction, explicit field-level confidence/evidence, separate TP/CPA effective dates, canonical dry-run readiness evaluation, audited field-review-to-draft versioned approval, and only then controlled automatic policy booking.
