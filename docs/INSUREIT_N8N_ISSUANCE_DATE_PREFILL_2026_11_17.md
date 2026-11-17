# ICICI Product 3005 — printed policy issuance date to Policy Onboarding

## Root cause
The existing active ICICI 3005 n8n parser returns OD/TP coverage periods but does not return an independently printed policy issuance date. The canonical n8n handoff in `app/policy-intakes/handoff-actions.ts` previously set `issuanceDate:new Date().toISOString().slice(0,10)`, so the prefilled onboarding date could be completely unrelated to the source PDF.

## New data contract (optional, evidence-gated)
- `policy_issuance_date` is an ISO `YYYY-MM-DD` field when the source PDF **explicitly prints** a matching label: `Policy Issued On`, `Policy Issue Date`, `Policy Issuance Date`, `Date of Issue`, `Date of Policy Issue` or `Date of Issuance`.
- Accepted printed formats include `Nov 05, 2026`, `05 Nov 2026`, `05/11/2026` (India day/month order) and `2026-11-05`. An impossible or contradictory date is omitted; **never** substitute today's date or Own Damage / Third Party commencement.
- If the PDF does not print a recognisable unambiguous issuance label, n8n omits this optional field. The server lets the operator continue to an editable **blank** issuance date, but the existing required-field and date-approval/OTP checks prevent booking until the real date is entered and verified.
- The n8n response has an **evidence** string matching the exact printed label; the server checks the ISO calendar date and evidence label before using it. It is separate from the 13 existing stringent financial/vehicle/coverage checks, which remain unchanged.
- `/policies/new?intake_id=...` preserves the current read-only verified-PDF review and maps the date to the existing `issuanceDate` form field. No additional table column, database migration, or automatic booking.
- Existing operator drafts are **never overwritten**. An explicit Fill Missing Fields may fill a *blank* issuance date after re-extracting the current verified PDF and revision CAS. Older drafts with a previously defaulted nonblank date display a reminder to compare with the PDF, but cannot safely be corrected without operator approval.

## n8n rollout
- Draft workflow `Iu6WUQiHeGwfDol9` was changed (three nodes: ICICI Product 3005 Parser, Return INSUREIT Review-Only JSON, Synthetic ICICI PDF Text). The **published production version remains unchanged** until this PR is tested, merged and deployed.
- A manual synthetic n8n pinned test succeeded after temporarily enabling the manual fixture trigger; it was returned to **disabled** immediately. This is a synthetic test, **not** live evidence that all printed ICICI variants expose an issuance label.
- After PR CI, manual deployment and a final review of at least one suitably authorized, actual policy document, publish the n8n workflow version. Re-preview a fresh and an older 3005 policy, verify issue-date evidence vs OD/TP dates, and confirm saved draft persistence and email OTP.
- When the real PDF lacks the supported issue-date label or shows a new date layout, leave the onboarding date blank and add a targeted parser regression from a **sanitized** example rather than guessing or copying a coverage date.
- If n8n publication is delayed, this website-side change accepts old responses without issuance date and leaves new Intake draft dates blank, avoiding today's silently invented date. Existing saved drafts remain untouched.

## Acceptance
1. Policy issued Nov 05 while coverage starts Nov 06: onboarding shows **Nov 05**, not Nov 06 and not today.
2. Missing issue label: onboarding issuance date blank, required review; no autofill.
3. Invalid date or conflicting issue labels: fail closed; no guessed value.
4. Existing saved manually reviewed issuance date: preserved.
5. Earlier-month issue date: existing server-side email OTP gate still applies.
6. n8n fingerprint binds the full returned fields; the backend re-extracts the current PDF before creating a draft. Never accept a browser-supplied issuance date as extracted evidence.

## Production
No n8n publish, GitHub merge, Vercel deploy, Policy Intake mutation or policy booking is performed as part of preparing this review branch. Use the repository's existing CI and manual deploy process with current production Supabase.
