# INSUREIT — guarded automatic policy onboarding (PR-only release plan)

## Approved behaviour (25 November 2026)
Once a Motor Intake has verified current-document n8n evidence, automatically attempt canonical registration without an interactive confirmation. Include **previously verified open** Intakes as well as future records. Never register an exception, duplicate, stale document, unapproved date, ambiguous customer, vehicle ownership conflict, or canonical booking failure.

## Architecture
- Vercel cron `/api/internal/ai-policy-onboarding/auto-book` runs each minute, separate from the extraction cron. It is disabled unless `INSUREIT_AI_AUTO_BOOKING_ENABLED=true`.
- GET authenticates using the existing high-entropy `CRON_SECRET`; optional POST uses separate `INSUREIT_AI_AUTO_BOOKING_WORKER_TOKEN`.
- The worker signs in as a **dedicated active IT-super-user or super-admin Supabase Auth user** via server-only `INSUREIT_AI_AUTO_BOOKING_OPERATOR_EMAIL` and `INSUREIT_AI_AUTO_BOOKING_OPERATOR_PASSWORD`. Configure this account with existing live manage-system approval, intake review/finalize, policy-create permissions; no anonymous impersonation or client-supplied operator.
- The verified request-scoped access token runs exactly `convertVerifiedAiIntake(id,true)`. Existing current-original-PDF, fingerprint, insurer checks, canonical draft CAS, customer and vehicle matching, date approvals, role checks, RTO rules, duplicate/overlap checks and `onboardPolicy` transaction stay authoritative.
- New service-role-only SQL claims up to 3 verified, nonexception, **unassigned**, open Motor Intakes with an unchanged current document. Intakes already assigned to a human reviewer stay outside unattended claims; automation never silently takes over their work. This is a safety restriction, not an extraction failure. Every claim records the verified dedicated operator's immutable profile ID. A unique intake claim row permits **at most one automatic booking attempt per Intake**, irrespective of worker overlap. A previous uncertain or failed attempt cannot be requeued merely because the extraction worker runs again.
- Outcomes in `policy_intake_ai_auto_booking_attempts`: `claimed` (may be midflight or unknown after crash), `booked`, `review_required`, `uncertain`. Never interpret an old `claimed` row as failed; reconcile Policy Register and Intake before any human-supervised recovery. The ledger deliberately does not have a retry endpoint.
- Studio shows automatic mode and aggregate outcome counters. The manual bulk-convert affordance is hidden while automatic mode is configured. Current queue extraction-verified counts remain extraction counters, not guarantees of booking eligibility.
- No n8n parser nodes, signed-date business rules, existing booking engine, insurer premiums, manual policies or live policy records are altered in the PR.

## Production release order (requires separate approval)
1. Review and merge code only after full Web CI and static auto-booking regression pass.
2. Apply reviewed `20261125190000_ai_policy_auto_booking_attempts.sql` to the correct production database; verify RLS, service-role-only RPC privileges, no old rows modified and zero auto-attempts.
3. Provision dedicated least-privilege-in-practice IT actor with the **existing** required capabilities and secure server-only credentials. Never reuse a personal account. Store credentials only in Vercel encrypted environment variables; do not commit secrets.
4. Deploy the compatible website with `INSUREIT_AI_AUTO_BOOKING_ENABLED=false`; confirm unauthorized scheduler 401 and disabled scheduler 503, and that normal manual conversion still works.
5. Run a controlled non-production/sandbox verification using synthetic or approved test PDFs: valid signed source, duplicate, conflicting customer/ownership, OTP approval, stale document, concurrent cron, crash/uncertain, same-mobile/different-name, and backlog. Compare canonical policy ID and ledger state.
6. Enable the server flag only with release approval. Monitor first three real eligible records one by one, reconcile the Policy Register and ledger, then allow scheduled backlog draining. Stop immediately on unknown outcomes and keep flag off until reconciled.
7. Rollback: disable `INSUREIT_AI_AUTO_BOOKING_ENABLED`; never delete/recycle claimed rows or manually reset PDFs without case-level review. The other extraction cron continues independently.

## Remaining verification
This PR adds static/contract regression tests and requests normal Web CI. It is **not evidence** of signed-PDF end-to-end test, database migration application, eligible production totals, or booking success. All are release gates. No automated booking should occur merely by merging code.

## Security / scope
`policy_intake_ai_auto_booking_attempts` is RLS-enabled with service-role-only access. Every mutation requires service-role and stable immutable attempt identity. Service-role access is used only to acquire/finish a claim, not to bypass human-equivalent canonical booking authorization. No webhook accepts customer IDs, PDF fields, source URLs, policy payload or arbitrary Intake IDs from untrusted callers.
