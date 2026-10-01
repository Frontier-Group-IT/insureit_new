# IIB Registration Finalization Handoff — 2026-10-01

## Evidence state

**IMPLEMENTED, NOT MERGED / NOT APPLIED / NOT DEPLOYED.**

Branch: `fix/iib-registration-finalization`

PR: #2664

This change closes the POSP/MISP onboarding gap after IIB portal handoff. Production database state was inspected read-only before implementation and showed a real application with a ready/handoff packet, completed training, passed exam and signed agreement, but no supported transition to `iib_registered` / active intermediary state.

## User-facing workflow

Step 6 remains a deliberate two-phase process:

1. Prepare IIB data.
2. Prepare portal handoff.
3. Complete the external IIB registration.
4. Use **Complete IIB Registration** in INSUREIT only after the external registration succeeded.

The completion form appears only when the canonical packet is in `handoff_started` state with no outstanding fields. It requires an explicit confirmation and registration date; an IIB reference is optional.

`Prepare portal handoff` does not activate the account.

After successful completion, Step 6 becomes a read-only `Registered · Active` state and the preparation/handoff controls are no longer available.

## Atomic finalization contract

Migration: `supabase/migrations/20261001170000_complete_intermediary_iib_registration.sql`

Function: `public.complete_intermediary_iib_registration(uuid, uuid, text, date)`

The function is `SECURITY DEFINER`, has an explicit `public` search path, revokes execution from `public`, `anon` and `authenticated`, and grants execution only to `service_role`. The web Server Action still performs the existing scoped POSP/MISP manager authorization before invoking it.

Before any activation write, the function rechecks:

- application exists and final type is POSP/MISP;
- training is `completed`;
- examination is `passed`;
- agreement is `signed`;
- IIB packet exists;
- packet is `handoff_started`, `submitted`, or already `registered` for idempotent convergence;
- packet has no missing fields;
- the resolved registration record belongs to the same application and registration type;
- registration date is not in the future;
- optional IIB reference is within the supported length.

If both stored registration links are absent but the registration record is recovered by `application_id`, the finalizer persists that recovered ID back to `intermediary_onboarding_applications.registration_record_id`. This keeps the active account canonically linked for register/display resolution without broadly rewriting the registration row itself.

In one database transaction it converges the IIB packet, training/exam assignment, onboarding application, registration record, POSP/MISP onboarding profile, and intermediary register. The final intermediary state is `account_status=active`, `iib_status=cleared`, `compliance_status=approved`, `registration_status=iib_registered`.

The assignment's first `iib_registered_at` timestamp is reused on later calls so retries are idempotent and do not change the original activation time.

## Existing write-hardening included

The existing Prepare IIB data and Prepare portal handoff actions previously reported failure only when multiple coordinated writes failed together. They now report failure if either coordinated write reports an error, preventing a one-sided failure from being presented as success.

The portal handoff action also always upserts the canonical `intermediary_iib_submission_packets` row. This repairs historical/draft-only recovery cases before finalization instead of allowing the draft snapshot to advance while the canonical row remains absent.

## Production schema gate

Dedicated workflow: `.github/workflows/apply-intermediary-iib-registration-finalizer.yml`

The workflow applies migration `20261001170000` only when it is not already recorded, records it in the migration ledger, then verifies the exact finalizer signature and its service-role-only execution contract.

`.github/workflows/deploy-production.yml` explicitly maps this migration to that workflow, so the Vercel production deployment waits for the schema apply/verification run before deploying the web release.

## Verification gate

Focused regression: `apps/web-portal/scripts/intermediary-iib-registration-finalization-regression.mjs`

The regression now covers finalization, draft-backed canonical handoff recovery, recovered application registration-link persistence, the dedicated migration workflow, and the production deployment mapping.

The canonical `.github/workflows/verify-web-portal.yml` runs this regression before typecheck, lint and the production build.

The earlier canonical run **#5087** passed on the pre-review head, but is superseded by the review-fix commits. A fresh **Verify web portal** run on the latest PR head is required before merge.

Do not merge until the full **Verify web portal** workflow is green and the user explicitly authorizes merge.

## Review follow-up before merge

Review found four issues after #5087: the production migration gate was missing, continuity files were not updated, a draft-only handoff could remain non-canonical, and a registration recovered by `application_id` was not written back to the onboarding application's `registration_record_id`.

The three code/deployment issues are now implemented on the branch:

- dedicated schema apply workflow + production deployment mapping;
- canonical packet upsert during handoff, including draft-only recovery;
- recovered registration ID persistence on `intermediary_onboarding_applications.registration_record_id` inside the atomic finalizer.

Repository continuity still requires the compact entry in root `AGENTS.md` and the current-state entry in `docs/CURRENT_CHAT_HANDOFF.md` before the review-continuity thread should be considered resolved.

## Production continuation

The migration has **not** been applied to production and PR #2664 has **not** been merged or deployed at the time of this entry. Therefore the current production application is intentionally unchanged.

After explicit merge/deployment authorization:

1. ensure the dedicated schema workflow applies/verifies migration `20261001170000` before the Vercel release proceeds;
2. verify the exact Step 6 application shows the completion panel after handoff;
3. complete a controlled registration only after confirming the corresponding IIB registration actually succeeded externally;
4. verify application, assignment, registration, profile and intermediary states agree on registered/active;
5. confirm the active POSP/MISP appears correctly in registers and no longer remains in pending onboarding.
