# External Claim Operations Entry — Preserve Management Category (2026-11-05)

## Requirement
Keep `self_managed` and `broker_managed` as ownership classifications. Authorized INSUREIT Operations should enter the same nine-stage claim journey without changing the classification, assistance state, assignment, claim history, or Customer milestones.

## Root cause
The legacy `public.begin_external_claim_operations_workflow(uuid, uuid)` function converted `claims.claim_service_mode` from `self_managed` to `broker_managed`, inserted customer snapshot rows and a status history event, and could mark assistance accepted simply when opening a claim. This was a historical September 2026 handover design, no longer desired since parity support was merged in PR #4081 and the four-function database parity migration was applied.

## Implementation
- New migration `20261105180000_preserve_external_claim_management_mode.sql` replaces the legacy handover RPC with a read-only permission-checked entry. Existing authenticated actor, `can_update_claim_status`, `can_access_claim`, and external policy checks remain intact.
- The RPC returns the unchanged `claim_service_mode` for `self_managed` or `broker_managed` and `changed: false`. It does not insert snapshots, update claims or assistance state, or write history.
- The portal action accepts either authorized classification; canonical Operations edit/verify progression remains handled by the existing claim workflow actions, not this entry RPC.
- Rollback SQL stores the exact pre-change production function definition inspected read-only on 2026-11-05. Existing September historical migrations remain untouched.
- `external-claim-canonical-operations-regression.mjs` checks read-only semantics, permissions, and both modes.

## Safety and release
No changes to historical claim rows or classifications. No live database changes or deployment from PR creation. Apply the new migration before deploying the frontend action change; otherwise the old RPC can still convert self-managed claims. Verify SQL and regression/CI checks, then test a scoped self-managed external claim with authorized Operations user. Confirm claim mode and assistance metadata are unchanged before/after opening, while stage edit/save behavior is still available. Do not merge/deploy until approval.
