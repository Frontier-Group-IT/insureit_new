# ICICI Lombard 3005 / 3005-O — controlled parser and draft-repair validation (18 Nov 2026)

## Scope and state
PR #4820 contains source code and an **inactive candidate builder**; it does not change the live Windows n8n workflow, publish a webhook, requeue any Supabase row, register any policy, deploy Vercel, or modify Go Digit / United India / New India Assurance parsing.

The three ICICI PDFs supplied for diagnosis map to:

| Intake | Variant | Current safe finding |
| --- | --- | --- |
| `PIR-261117-BE8ABA` | 3005/O OD, no NCB printed | Original OD parser required `Sub-Total Deductions` even when no deduction was printed. New parser treats this as zero only if printed OD subtotal equals total OD. |
| `PIR-261117-800D9B` | 3005/O with `B00` endorsement | Original OD parser policy-number regex accepted digits-only suffix. New regex accepts three alphanumeric suffix characters. Original 25% NCB/444 deduction and multiple add-ons remain strictly reconciled. |
| `PIR-261118-673F2A` | 3005 Bundled, business insured | Original Bundled parser required CPA row even when insured is non-individual. Zero CPA is accepted only when the PDF explicitly states the non-individual opt-out and TP liability equals basic TP. |

All three PDFs contained an independently labeled **Policy Issued On** value and CC/KW vehicle power field. The upgraded Bundled proposal includes issuance date, verified Two-Wheeler class, known Chetak Electric model evidence, and separately printed kW. Unknown models, missing source dates and unresolved premiums still fail closed.

**Important:** A validation failure from the old workflow is saved as `parser_not_trained` by the website even for ICICI layouts. That status means the current n8n **output did not pass the strict validation bridge**, not necessarily that insurer/product code is unknown. The three new synthetic fixtures pass 13/13 Code-node checks and emit no warnings, but real PDF upload and signed-URL tests on the user's local n8n are still required.

## Local Windows n8n (do not touch the working production webhook yet)

1. Export the current local published ICICI dual-parser workflow **as JSON** from the n8n editor. Keep a separate untouched backup outside Git. The local workflow is normally opened at `http://localhost:5678/workflow/0uGscm0WUegvxa6V`.
2. After updating your local repo to contain this PR, run from Windows PowerShell 5.1:
   ```powershell
   cd C:\Users\HP\insureit_new
   .\infra\n8n-local\scripts\prepare-icici-3005-variants-v2.ps1 `
     -SourceJson "C:\Users\HP\insureit-n8n-backup\icici-current-export.json" `
     -CandidateJson "C:\Users\HP\insureit-n8n-backup\icici-variants-v2-inactive.json"
   ```
   Substitute the **actual** source export path; the script never overwrites the output file and never publishes a workflow.
3. Import the new candidate JSON into local n8n as **a separate inactive workflow**. Its isolated test webhook path is `insureit-icici-3005-variants-v2-isolated`; do not change the production route.
4. For each of the **three actual PDFs**, click **Execute workflow** on the **whole candidate canvas** and POST an authenticated PDF upload to its *Test URL*. Do not run only the Webhook node (that can return 200 with raw headers). Inspect the final node:
   - `ok=true`, correct parser ID, **13/13 true**, `warnings=[]`.
   - Correct printed issuance date, insured identity, manufacturer/model, manufacturing year, CC/KW, RTO state and city, OD/TP validity and policy number.
   - Net/premium/tax arithmetic must match printed PDF: no NCB OD `2056+640=2696` gross `3181`; B00 OD `1774+634+99-444=2063` gross `2434`; Bundled `1598+683+248+310=2839`, TP `3273`, CPA `0`, gross `7212`.
   - `review_required=true`, `auto_finalize_allowed=false`.
5. Test the signed-PDF-source branch against a **review-only, authorized** existing Intake. Confirm normal auth rejection for a request with no secret.
6. Only after full workflow tests pass, replace **the two Code nodes** in the existing local production workflow with the versioned source contents. Back up first and publish only after explicit release approval. Never replace the existing production webhook path, credentials or tunnel.

## Website / saved draft repair

The new operator action **Compare saved draft with PDF** is shown for open unregistered Motor policies with existing `booking_review_required` / `draft_conflict` exceptions. It:

1. Requires authorized IT/Admin, policy-creator and Intake-reviewer/finalizer access.
2. Re-extracts the **current signed PDF** and confirms exact queue document ID, content fingerprint, 13/13 checks and no warnings; checks duplicate policy number and same insured identity.
3. Shows every whitelisted difference, **Saved** versus **Verified PDF**, in a custom modal. Blank values may be preselected; any nonempty saved value such as issuance date is **not preselected** and requires deliberate reviewer selection.
4. On explicit approval, rechecks the same PDF and draft revision and performs an optimistic compare-and-swap update to **only** the selected draft fields, recording the field keys in review remarks. No customer/vehicle or policy is registered.
5. Maintains date OTP, duplicate checks, coverage, manual approvals, customer identity, historical saved draft notes, and canonical preflight for any later booking.

For `PIR-261117-925B83` and `PIR-261117-953F1B`, inspect issuance dates, policy identifiers, policy/TP coverage and premium differences in the review modal. Correct only after checking the actual PDF. They remain in `booking_review_required` until explicitly reprocessed/reverified; do not silently unlock by changing queue status.

For the other six Bundled Intakes, the old 19-field parser lacked a verified issue date, class, fuel and motor kW. The new Bundled parser source provides those fields only when the current PDF independently supports them. Test first; then reprocess **only ICICI** policies and reconcile nonempty manual drafts one by one. Keep earlier manually entered dates, future/OTP and ownership conditions under human review.

## Release safety

- Pass PR CI, keep a manually controlled Vercel deployment; never change `insureit.in` authoritative GoDaddy DNS.
- Do not upload real customer PDFs to GitHub or logs.
- Do not run **Reprocess All Previous**, as it includes untrained other insurers.
- Do not retry already registered or possible duplicate Intakes.
