# INSUREIT — ICICI 3005 + 3005/O conversion recovery (2026-11-18)

**Status:** Draft PR #4806 only. No production data updates, queue reprocess, customer/policy registration, Supabase migration application, n8n publish or website deployment from this change. Scope is ICICI Lombard Product 3005 Bundled and 3005/O Stand-Alone Own Damage. **Do not reprocess/train Go Digit, United India, New India Assurance** as part of this release.

## Starting point — live production audit

Production database `ilzhsfqqjyppzzvfscmh` had 158 open Intakes: 132 classified duplicates, 14 exceptions, 12 unsupported. **17 ICICI nonduplicate blocked Intakes** fall into four groups; nine other-insurer unsupported rows are explicitly out of scope.

| Condition | Affected ICICI Intake numbers | Evidence |
|---|---|---|
| Conversion review after 13/13 checks | PIR-261117-925B83, PIR-261117-953F1B, PIR-261117-AABC2F, PIR-261117-46A7BB, PIR-261117-081643, PIR-261117-B0AF30 | All use the 3005/O local parser; first two assigned to ANJU (leave assignment intact); remaining four returned unconfirmed booking |
| Old missing verified issue/class/fuel/power fields | PIR-261107-9A5976, PIR-261111-0C53DA, PIR-261116-C805CB, PIR-261117-D0A750, PIR-261117-689892, PIR-261117-63FB51 | Saved OCR may be stale/manual; all six had queue `missing_field, issuance_date_unverified` even though 13/13 PDF checks passed |
| Manufacturer unmatched | PIR-261117-953015, PIR-261117-04C0F3 | Local current PDFs show OD product; one inspected file prints `CHETAK / BLUE 2903` and CC/KW 2.8, not an unrecognized insurer |
| Parser not trained | PIR-261117-BE8ABA, PIR-261117-800D9B, PIR-261118-673F2A | ICICI OD, ICICI OD B00 variant, ICICI Bundled respectively; require actual local n8n PDF retest before conversion |

Original database audit was read-only; no policy booking was confirmed for the six conversion attempts. Any uncertain result must be checked against Policy Register before retrying.

## Confirmed causes fixed by this PR

1. `mapVerifiedN8nMotorPremium` previously assumed Basic OD + Add-ons = Total OD for **all** products. For 3005/O with NCB, actual document formula is Basic OD + Add-ons − NCB/Deductions = Total OD. The canonical form has only Basic OD and Add-ons, so its Basic OD input is now net of validated NCB, with the printed amounts and reconciliation visible in review notes. Example approved fixture: `2222 + 907 - 778 = 2351`, form inputs OD `1444`, addons `907`. Conversion blocks if that net Basic OD would be negative. Source parser must still independently validate 13/13 arithmetic checks.
2. Queue and older OCR recovery hardcoded the **Bundled parser ID** even for valid OD output. Parser ID/version are now taken from the independently validated n8n response. Eligibility recognizes only the two approved ICICI parser identities.
3. Production SQL `sync_verified_ai_intake_ocr_v1` accepted only `bridge-v1` while the queue claimed `bridge-v1-issue-date-v2`, and wrote Bundled parser ID. The v1 boolean return was not checked. New `sync_verified_ai_intake_ocr_v2` matches the claimed revision, whitelists exact ICICI parser ID/version, checks current document + lease + empty OCR + no draft + no policy, and saves accurately. A refused update holds for review; legacy v1 remains untouched.
4. Old Chetak aliases covered C2501/C3001/C3501/C3502/C3503 but omitted verified `BLUE 2903` and `CHETAK 2413 PREMIUM`. CHETAK-to-Bajaj now requires documented two-wheeler/electric evidence; motor capacity is never guessed. Existing validated 3503 mapping without CC/KW still leaves motor power blank.
5. ICICI 3005/O policy number validation now allows exactly three uppercase alphanumeric suffix characters (including `B00`) while retaining required product prefix/position and 13 checks. This is a website contract change, **not proof** that the local n8n parser can extract the B00 file.

## Implementation/release dependencies — strict order

1. CI for PR #4806: Web Portal regression, typecheck, lint, build; inspect any failures. Maintain reviewer/OTP/date, duplicate, ownership and coverage guards.
2. Back up and review the migration `supabase/migrations/20261118102500_icici_3005_ai_verified_ocr_sync_v2.sql`. Apply it using the authorized production database migration process **before** web deployment. Do not bypass migration-history parity.
3. On local Windows n8n `http://localhost:5678`, verify that **published** workflow `0uGscm0WUegvxa6V` accepts real PDF files in a separate review-only test: representative 3005 Bundled, 3005/O, 3005/O B00. Require true parser identity, correct issuance dates, 13/13 checks, correct amounts, no warnings and `auto_finalize_allowed=false`. If B00 fails the local parser, patch and retest that isolated workflow; do not switch production on mere website contract approval.
4. Obtain explicit release approval and manually deploy Vercel, preserving the existing n8n private webhook tunnel and GoDaddy domain settings. No auto-deploy or DNS changes.
5. Reprocess **only the selected ICICI IDs** using authorized per-Intake action. Do not use `Reprocess All Previous`, which may reset unsupported Go Digit/United India queues; do not change any existing ANJU/JATIN assignment. Existing drafts must be reconciled, never overwritten.
6. Verify `queue.parser_id`, `checks_passed=13`, `exception_codes=[]`, `ocr_status` and current saved fields where synchronization was allowed; check eligible/read-only preflight. Confirm other insurers' state/counters unchanged.
7. For conversion, first verify duplicate Policy Register and Intake history; separately handle assignment/OTP/date/customer/ownership/coverage conflicts, then book only on an individually confirmed approved operation. Four previously unconfirmed OD attempts must not be retried blindly.

## Remaining limits

- This PR does not install/modify/publish the **user's Windows-hosted local n8n workflow**; it is not remotely accessible via the connected cloud n8n MCP. The B00 parser variant and the three unsupported ICICI PDFs require isolated local tests.
- An older manually corrected/saved onboarding draft is preserved and may need authorized manual reconciliation. A missing PDF issuance date is not silently replaced with the current date.
- No modifications to Go Digit, United India, New India Assurance policy parser rules, PDFs, queue states or registered policies.
