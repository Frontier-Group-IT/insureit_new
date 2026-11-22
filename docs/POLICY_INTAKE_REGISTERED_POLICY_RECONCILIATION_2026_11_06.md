# INSUREIT Policy Intake registered-policy reconciliation — 2026-11-06

## Incident
- Policy: `252900/48/2027/1023` / `POL-20261105104120650`
- Intake: `PIR-261105-311708`
- Registered policy existed but intake remained `in_review`, `final_policy_id = NULL`.
- Duplicate matching canonicalized OCR policy number to `2529004820271023`, but `policies.policy_no_normalized` stored `252900/48/2027/1023`; exact database filtering skipped the registered policy.

## Code change
- `lib/policy-intake-duplicate.ts` searches both canonical and original OCR-formatted values against the stored normalized and policy-number columns, and normalizes matched rows before comparison.
- Existing fail-closed duplicate checks, permissions and finalization workflow are preserved.
- `scripts/policy-intake-policy-register-links-regression.mjs` covers both lookup paths.
- No schema migration, automatic bulk matching, authorization widening or mobile build.

## Production record correction
On 2026-11-06, after explicit user approval, a guarded production SQL transaction:
1. Matched the exact OCR policy number to the existing registered policy.
2. Verified the current Intake document and the matching original upload identifier in the registered policy copy.
3. Linked the existing policy document to the source Intake document without replacing its storage path.
4. Marked only this Intake `completed`, linked its `final_policy_id`, and set `finalized_at`.
5. Did not attribute the reconciliation to a reviewer (no fictitious `finalized_by_profile_id`).

Verified production: `PIR-261105-311708` is `completed`, references policy UUID `139a9da9-9866-4b47-a4c5-7ac194cb7a6f`, and the policy document references Intake UUID `4f75d4dd-ccd7-48f0-82ab-7dee682f6439` and its document UUID.

## Follow-up
- Run **Verify web portal** GitHub PR checks; do not merge/deploy without explicit approval.
- Confirm different punctuation policy-number formats and role restrictions in authenticated browser QA.
- Audit other noncompleted Intake rows with registered policy numbers read-only before any bulk data correction.
