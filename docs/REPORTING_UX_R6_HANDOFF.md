# Reporting UX R6 — Relationship Manager Dimension Normalization

> Status: **IMPLEMENTED / APPLIED / VERIFIED / MERGED**
> Production web deployment: **NOT YET R6-DEPLOYED**

## Purpose

R6 normalizes the Relationship Manager reporting dimension so report filter identity is based on the stable canonical `employees.id` UUID rather than free-text `policies.rm_name`.

Distribution already used employee UUIDs. R6 aligns Business, Finance and Renewals with that model while preserving existing report calculations, hierarchy/customer scope and display names.

## Durable business / technical rule

- `employees.id` is the canonical Relationship Manager reporting identity.
- `policies.rm_employee_id` is the policy-level RM snapshot used to preserve historical attribution.
- `policies.rm_name` remains display/compatibility text, not filter identity.
- Policy RM identity is derived server-side from the selected intermediary assignment; the browser does not authoritatively choose the UUID.
- Reassigning an intermediary later does not silently rewrite historical policy RM attribution.
- If a policy's intermediary source is explicitly changed, the policy snapshot is recalculated.
- Employee name changes synchronize the policy display name while retaining the same UUID.
- Truly unassigned policies remain unassigned; no artificial employee identity is created.

## Database implementation

Repository migration:

`supabase/migrations/20260813170000_reporting_rm_dimension_normalization.sql`

Live Supabase rollout was applied in smaller migrations because the connector rejected the original oversized combined migration before execution. Verified applied migrations:

- `20260813172840 add_policy_rm_employee_id`
- `20260813172853 add_policy_rm_employee_id_fk`
- `20260813173022 sync_policy_rm_employee_id_function`
- `20260813173034 sync_policy_rm_employee_id_trigger`
- `20260813173229 harden_policy_rm_snapshot_sync`
- `20260813173246 sync_policy_rm_name_on_employee_rename`
- `20260813173308 policy_business_report_rm_adapter`
- `20260813173322 finance_report_rm_adapter`
- `20260813173342 renewal_report_uuid_rm_adapter`
- `20260813173352 reporting_rm_adapter_acl`
- `20260813173417 reporting_rm_options_function`
- `20260813173517 lock_down_reporting_rm_options`
- `20260813173532 grant_reporting_rm_options_service_role`

Verified live objects:

- `policies.rm_employee_id` exists.
- FK `policies_rm_employee_id_fkey` exists and points to `employees(id)` with `ON DELETE SET NULL`.
- `trg_sync_policy_rm_employee_id` exists on `policies`.
- `trg_sync_policy_rm_name_on_employee_update` exists on `employees`.

The optional `policies_rm_employee_id_idx` index was not applied because the connector safety layer repeatedly blocked the index DDL. This is a performance follow-up only; correctness does not depend on it.

## Reporting API

Backward-compatible UUID adapter RPCs were added; existing v1 report RPCs remain intact:

- `get_policy_business_report_v2(...)`
- `get_finance_report_v2(...)`
- `get_renewal_report_v2(...)`
- `get_reporting_rm_options(uuid[])`

The adapters accept `p_rm_employee_id`, resolve its canonical current display name, and invoke the existing proven v1 report calculation functions. The policy RM-name synchronization trigger keeps that display text aligned after employee renames.

All four functions are `SECURITY DEFINER` with fixed `search_path=public`. Live ACL verification showed only:

`{postgres=X/postgres,service_role=X/postgres}`

No `PUBLIC`, `anon` or `authenticated` execute grant remains.

## Application changes

Business, Finance and Renewals now:

- parse `rm` query values as UUIDs;
- use `rmEmployeeId` in server-side filter state;
- call the corresponding `*_v2` report RPC;
- load canonical `{ id, name }` RM choices through `get_reporting_rm_options` using the already-resolved accessible customer scope;
- preserve the UUID through pagination and CSV export links.

Distribution required no identity change because it already used employee UUIDs.

Management Pack inherits the normalized identity model through its existing underlying report loaders; no Management Pack calculation was changed.

## Live data verification

Historical smoke at rollout time (dynamic data; do not hard-code into UI):

- Total policies: 32
- Policies with canonical RM UUID: 23
- Name-only unresolved RM rows: 0
- Genuinely unassigned/unknown: 9

V1 versus V2 parity smoke:

- Business policy count: 32 / 32
- Finance policy count: 32 / 32
- Renewal upcoming policy count: 32 / 32

A real RM-specific smoke also returned identical v1/v2 results across Business, Finance and Renewals (22 records in each at the time of verification).

## Repository verification and merge

PR: `#330 — Reporting UX R6: normalize RM filter identity`

Final verified feature head:

`4d830a611b005e606ed16105cf69de5ca66bbab4`

Canonical GitHub verification:

- Workflow run: `31727595499`
- Access-control regressions: passed
- Employee governance regression: passed
- Release-blocker security regression: passed
- IFFCO structured regression: passed
- IFFCO regression: passed
- Digit regression: passed
- New India regression: passed
- TypeScript typecheck: passed
- Lint: passed
- Next.js production build: passed

Merge commit:

`e84ee24d84674b6061f441e61d29750a515ec6b5`

## Deployment state

R6 is merged into `main`, and its required Supabase backend objects are already applied and verified on the existing production Supabase project.

No R6-specific production Vercel trigger has been created. Do not describe the R6 web changes as production-deployed until the user explicitly approves deployment and the exact Vercel deployment reaches READY.

## Follow-up

The optional `policies.rm_employee_id` index can be added later through the normal migration path when the connector permits the DDL or when a controlled migration runner is used. Before doing so, verify current query plans/data volume rather than treating the index as a blocker.