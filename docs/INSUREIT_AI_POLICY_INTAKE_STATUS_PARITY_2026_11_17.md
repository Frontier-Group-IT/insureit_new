# AI Policy Onboarding vs Policy Intake Register — status parity fix

## Reproduced production mismatch (read-only, 2026-11-17)
The Policy Intake Register uses `policyIntakeBucket()` over its complete authorized dataset. It derives **duplicate** from policy-number matches against registered policies and earlier Intakes, *irrespective* of the saved `policy_intake_requests.status`. The AI workbench previously queried the four raw open statuses `ready_for_review,in_review,needs_attention,processing` without applying the canonical buckets in its headline status totals. As a result duplicates were included in the processing population.

The queue also combined `policy_intake_ai_processing_queue.state=pending` with `state=processing` into a tile labelled **Processing**. Those states mean **not yet extracted** vs **worker lease currently extracting**, and are independent from the Intake lifecycle. A pending n8n item is **not** an Intake in the register's Processing tab. The main AI table previously showed the raw processing lifecycle and historical `Saved OCR (old)`, causing further confusion.

A separate regression caused derived duplicate exceptions not to appear: `ai_exceptions: row.is_duplicate` referenced a property absent on the raw Supabase row rather than the computed `is_duplicate` value.

### Live aggregate at investigation (changes over time)
| Canonical register bucket | Total | Open Intakes |
| --- | ---: | ---: |
| Action Required | 195 | 195 |
| In Review | 7 | 7 |
| Processing | 1 | 1 |
| Duplicate | 123 | 120 |
| Completed | 1,056 | 0 |
| Rejected | 85 | 0 |
| **All** | **1,467** | **323** |

Note: three duplicates originate from non-open Intakes; therefore the AI **Open Duplicate** tab correctly shows 120 while the full register's **Duplicate** tab shows 123. Do not disguise the difference by reassigning database statuses or silently including completed/rejected Intakes in the active AI workbench.

## Fix implemented on isolated PR
- Apply the same `getPartnerEmployeeIntakeReadScope` **and** canonical `policyIntakeBucket`/`policyIntakeStatusCounts` functions used in the Policy Intake Register. The AI workbench stays restricted to authorized Development administrators.
- Add server-paginated **Action Required, In Review, Processing, Duplicate, All Open** tabs, with status totals computed from **all authorized open rows before pagination**. Default to Action Required; when opened through a deep link to a specific Intake, select its current canonical status.
- Queue panel now distinctly says **Not yet queued, Queued for n8n, Reading PDF, Exceptions, Not trained, Retrying**. This is a separate operational progress panel, not the Intake status totals.
- Correct the missing duplicate exception: use the canonical duplicate bucket, not `row.is_duplicate` on an unaugmented database row. A duplicate row displays a blocking **Duplicate policy detected** review action regardless of n8n state.
- Label the table's status column **Intake workflow**, not the parser readiness. Keep extraction and legacy OCR separate.
- Refresh on focus and every 60 seconds like the Policy Intake Register, preserving the selected view; avoid stale counts.
- Continue to leave policy/customer writes and **Convert All Eligible** disabled until canonical preflight, coverage/identity review, date OTP and transaction idempotency have been implemented and tested.

## Next phase — customer exception resolutions and true conversion
1. Resolve **same phone/different verified insured** through a permission-gated modal that shows actual candidate records (private server lookup). Explicitly select *Link verified existing customer* or *Create a new customer through the canonical Customer Onboarding flow*. Do not auto-link solely on phone equality or let a browser send a trusted customer ID.
2. Persist resolved decisions and audit reviewer, Intake, current document fingerprint, parser revision and customer candidate; re-evaluate if any source changes.
3. Add shared read-only canonical policy preflight (premium/add-on reconciliation, exact issuance, class/capacity, TP/CPA validity, existing vehicle/coverage/duplicate/OTP checks) and a clearly separate **Eligible for Conversion** state.
4. Only after those gates are verified, enable **Convert to Policy** and confirmed **Convert All Eligible** using the existing transactional booking engine and idempotent per-Intake lease/retry. No background automatic policy booking.

## Verification
The full `Verify web portal` GitHub workflow must pass on the branch head. The production database is shared, so tests are purely synthetic and do not create customers, vehicles or policies. Check an actual authorized organization-wide Development account and Policy Intake Register account with the same scope and filters to confirm live count parity after a separately approved merge and manual deployment.

No schema migration or live production data changes are required for this fix.

## Customer exception integration — read-only candidate preview

This branch also begins the next phase without weakening the existing policy-booking safety gates.

- The **Check customer matches** action only appears for row-level customer exceptions. It requires Development administrator rights and reviewer/finalizer access on that specific Intake.
- The server re-extracts the **current private PDF through n8n**. An insured name is considered verified only when all 13 checks pass with no extraction warnings. It is **not** copied into an existing customer or used to auto-link.
- The server reads customer candidates by the Intake mobile number (last 10 digits), verifies exact normalised phone equality, and compares exact normalised insured names when n8n evidence is verified. If 51 or more candidates are returned, a unique match is not assumed.
- Only the authorized operator receives the candidate names/codes and a masked phone suffix. It also shows the number of **other open Intakes using exactly that saved mobile** as an informational indicator, not proof of different identities. The list has links to each existing customer's **canonical customer details**, and explicit **Customer Register** / **Create New Customer** navigation. It never calls a customer or policy INSERT/UPDATE.
- The exception remains unresolved until the later **audited decision persistence + canonical booking preflight** is implemented. Opening a new customer form does not retroactively link the Intake or allow bulk conversion.

The customer-review lookup is an incremental operator aid; it is not yet the final one-click customer-creation/link transaction.
