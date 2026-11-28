# ICICI 3005 — one-time precommit extraction-review recovery

## Purpose
The Operations Portal imports **already-issued insurer policies for records**. Its 13/13 ICICI 3005 parser is already trained. An old automatic attempt can finish as `extraction_review` because the exact source was unavailable in a pre-commit step. A subsequent queue verification can be good while the original terminal booking attempt is immutable. Never reset or edit that attempt.

## Recovery
The versioned service-only SQL function `claim_ai_auto_booking_icici_precommit_v1` claims at most **two** qualifying records per automatic-booking cycle. It reuses the existing uniquely keyed ICICI recovery ledger and finisher. The website worker then re-runs the **unchanged** `convertVerifiedAiIntake` with the current PDF, revision-checked draft generation, exact customer match, duplicate checks, ownership, date and canonical transaction guards.

Eligibility requires:
- Existing auto-booking attempt is **terminal deterministic** `review_required/extraction_review`, with no policy ID or uncertain outcome
- Current document, insurer parser, fingerprint and 13/13 OCR evidence agree, without any parser warning
- No already finalized policy, saved draft, assigned reviewer or previous recovery
- Source names are not placeholder headings; printed policy number, chassis, issuance date are present
- No current policy with the same number, other Intake with that policy number or existing vehicle-master chassis
- Operator identity matches the original booking actor, current operator is service-role authorized and can pass ordinary onboarding permissions

The **original attempt remains unchanged**, and a fresh one-time recovery claim cannot be claimed twice. If the new attempt fails or becomes uncertain, stop: do not retry automatically.

## First qualifying example
`PIR-261128-28D7D3`: 13/13 ICICI 3005, verified queue, no finalized policy or old recovery, no saved draft, no matching policy number and no vehicle master for its chassis. Existing terminal attempt: `extraction_review`. Eligibility to be rechecked atomically on the database at claim time.

`863F68` and `7222F7` are explicitly **not included** because they have `vehicle_ownership` review and their chassis is linked to an existing active policy.

## Release order
1. Merge website PR after web CI, **manually deploy** its exact merge commit to Vercel. The worker tolerates the SQL function not yet installed (missing RPC only).
2. Install the versioned SQL script via the connected Supabase service; check `pg_proc` and `has_function_privilege`. Do not call the claim function from a human/admin session or rewrite any ledger row.
3. Existing automatic-booking scheduler may then claim up to two eligible records. Verify source/current doc and result in the original + recovery ledgers, Intake and Policy Register.
4. No bulk reprocessing, no automatic retry of unknown transactions, no nine excluded Tata AIG recoveries, no insurer contact or modification of another insurer's parser.

For future deterministic ICICI 3005 `extraction_review` records meeting the same strict contract, the one-time claim is reusable without another dedicated parser fix.
