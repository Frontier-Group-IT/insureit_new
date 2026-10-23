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

## 23 October continuation
- Scoped Life/Health case list and case detail to active root employee reporting tree, `rm_employee_id` and Life/Health `business_line`; the new role receives a read-only case details UI rather than the general edit component. Shared counts remain unchanged for other roles, and the Life Head case-count fallback reflects only scoped rows.
- Policy-copy signed URL issuance for the new role now uses `canAccessPolicy` against the exact document's policy instead of broad customer scope.
- Applied an explicit effective permission ceiling: `view_policies=view` only; all other capabilities blocked even in the presence of employee/role overrides. Life hierarchy resolver similarly fails closed unless called for `view_policies`.
- Life/Health navigation includes the restricted Cases list. The middleware route boundary adds this list and authorized case details.
- Regression is invoked directly from the Verify web portal workflow; existing count compatibility test preserved.
- A TypeScript route regex escape error was found and corrected before release. Re-run required to confirm all checks green.
- Still **NOT IMPLEMENTED**: policy creation/edit, document critical verify, case creation/edit, intake review/finalization, finance adjustments, audit history and export/report guards for the new role. Do not assign the role.
- The enum migration is not applied. PostgreSQL enum additions are additive but not trivially reversible; rollback is to keep role unassigned, and revert application changes.

## Revised user requirement — 23 October 2026
User explicitly superseded the vertical restriction: **Operations Head - Life can work on Motor, Non-Motor, Life, Health and every other policy vertical**, provided the **RM OR partner** responsible belongs to Gagan Singh's (5117) active employee downline. The display label stays Operations Head - Life.

Implemented read-scope revision in this branch:
- `getOperationsHeadDownlinePolicyScope` returns downline employee IDs and intermediary codes assigned to downline employees/profiles.
- `operationsHeadPolicyFilter` and `canAccessPolicy` check `policies.rm_employee_id` **or** `policies.intermediary_code` against this scope. No `business_line` constraint.
- Policy Register uses the same server-side ownership OR scope; signed policy-copy URLs already call `canAccessPolicy`.
- Life/Health case list remains its own Life/Health-specific module and scoped to downline RM. Full cross-vertical creation, editing and critical verification are not safe to enable until every server action and document verification handler is guarded against this exact ownership rule. Permission ceiling stays view-only; **this is an incomplete draft, not ready for merge or production**.
- Existing static scope tests updated. Partner association comes from `intermediaries.associate_employee_id` / `associate_profile_id`. For partner codes that are reused across intermediary types, further mapping hardening is required before granting write access.
