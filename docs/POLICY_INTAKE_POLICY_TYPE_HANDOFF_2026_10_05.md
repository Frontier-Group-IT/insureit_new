# Policy Intake Policy Type + Proposal Form Handoff — 2026-10-05

## State

- Branch: `feature/policy-intake-policy-type-2026-10-05`
- Pull request: #2719 — `Add policy type and proposal-form intake flow`
- State: **IMPLEMENTED / PR OPEN**
- Merge: **NOT MERGED**
- Production deployment: **NOT DEPLOYED**
- Database migration: **COMMITTED, NOT APPLIED**
- APK/AAB: **NOT CREATED**

## Approved behavior

New Policy Intake now captures a nullable intake-level `policy_type` with four new-record values: `motor`, `non_motor`, `life`, and `health`.

- Motor / Non-Motor continue to use **Policy Copy** and the existing background policy + vehicle OCR/detail-fetch path.
- Life / Health use **Proposal Form** and store the submitted document for Operations review without OCR or policy/vehicle detail extraction.
- Historical intake rows remain `NULL`; there is no guessed backfill or default at the database level.
- Policy Intake Queue shows **Policy Type** immediately after **Lead Source**. Life/Health detail state is presented as **Stored**, not **Fetched**.

## Server-side OCR safety

The Life/Health bypass is enforced beyond the UI:

1. Initial intake completion does not schedule `processStoredOcr` for Life/Health.
2. `processStoredOcr` re-reads `policy_type` and exits before extraction for Life/Health.
3. Replacement/response document handling does not schedule OCR for Life/Health.
4. OCR retry-state calculation never marks Life/Health as retryable.
5. The retry server action explicitly rejects Life/Health proposal forms.
6. The retry background worker re-checks `policy_type` and exits before OCR.
7. Life/Health proposal forms are not promoted as an official final `policy_copy` during intake finalization.

These guards are deliberately redundant so a direct action call, stale UI, retry, or background worker cannot accidentally route a Life/Health proposal form through policy OCR.

## Schema change

Migration:

`supabase/migrations/20261005113000_add_policy_type_to_policy_intakes.sql`

It adds nullable `policy_intake_requests.policy_type` with a check constraint allowing only:

- `motor`
- `non_motor`
- `life`
- `health`
- `NULL` for historical rows

There is intentionally no backfill/default.

## Verification

PR verification uses the existing **Verify web portal** GitHub Actions gate, including Policy Intake workflow regressions, access/security regressions, OCR regressions, typecheck, lint, and production build. Do not claim deployment or runtime verification until the PR is merged, the migration is actually applied, and the production deployment is separately verified.
