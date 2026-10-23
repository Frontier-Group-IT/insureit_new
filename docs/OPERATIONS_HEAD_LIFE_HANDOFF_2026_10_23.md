# Operations Head – Life implementation handoff (23 October 2026)

## Confirmed scope
- New role identifier: `operations_head_life`, label `Operations Head - Life`.
- Confirmed downline root: Gagan Singh, employee code **5117**, employee ID `ac167429-0ce0-4ffe-90ea-4040cb4fea95`.
- Production audit at planning: five active downline employees across two levels, all marked Life; root is Life.
- Authorization must be the **intersection** of Life/Health `business_line` and dynamic recursive reporting downline (including the root). Never grant a general organization-wide policy permission.
- No role assignment or production migration is permitted before full backend verification.

## Branch implementation so far (safe foundation, NOT COMPLETE)
- Registered new role in TypeScript (currently **view policies only**), UI role label, and V2 shadow matrix.
- Added fail-closed hierarchy computation rooted at confirmed employee, using current active reporting relationships.
- Added business line + RM ownership intersection in `canAccessPolicy`; policy register applies business line and RM filters before service-role data reaches the page.
- Added dedicated Life role middleware boundary to policy register / read-only policy detail, plus reduced sidebar.
- Prepared enum migration **NOT APPLIED**; no profile role changed.
- Added static regression test.

## Required before enabling edit, verification, onboarding or production rollout
1. Protect **every** Life/Health policy edit server action, save/RPC, document open/upload, financials, premium, pay-in/out and customer related source by a shared `requireLifeHealthDownlinePolicyAccess` guard (not just a client-side filter). Reject Motor and outside-tree records independently.
2. Secure Life/Health case list/detail and mutation actions against `life_health_cases.business_line` + `rm_employee_id`, including aggregates and summaries. Current case page loads all cases using admin client; route is intentionally blocked for new role.
3. Add granular verify/approve/reopen capability and auditable identity, timestamp, reason and document version controls. Never infer critical verify from ordinary policy edit. Existing `view_policies` access alone is insufficient.
4. Bind Policy Intake to the **linked final policy or specific RM employee** in the root downline, check Life/Health product before review/finalize; secure exports and reports.
5. Add strict deny tests for direct URL/API/action, Motor, non-downline and anonymous roles. Verify policy document signed-URL issuance and all server-role client queries.
6. Do not assign new role or apply enum migration until secure implementation and UAT approval. The PR is a **draft and must not be merged**.

## Rollback
Close draft PR / revert its isolated commits. No production database writes have been made.
