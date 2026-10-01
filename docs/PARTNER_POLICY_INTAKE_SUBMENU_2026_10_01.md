# Partner Policy Intake submenu — 2026-10-01

## Requested change
Expose the existing Partner Policy Intake workflow directly from the Partner website sidebar so a partner can open both the Policy Intake register and start a new intake without first navigating through the register.

## Implementation
- The existing top-level `Policy Intake` Partner navigation item is now expandable, matching the established Renewals submenu pattern.
- Child item `Policy Intakes` opens `/partner/policy-intakes`.
- Child item `New Policy Intake` opens `/partner/policy-intakes/new`.
- The submenu auto-expands while the user is anywhere under `/partner/policy-intakes`.
- Active styling differentiates the register/detail flow from the New Policy Intake route.
- Intent prefetching includes both Policy Intake routes.

## Safety boundary
- Navigation/UI only.
- Reuses the existing Partner Policy Intake register, new-intake route, permissions, RLS, and business logic.
- No database migration, schema change, auth/RLS change, API/RPC change, or write-path change.
- No APK/AAB build.

## Release state
- Branch: `feat/partner-policy-intake-submenu`
- Implementation committed.
- PR/checks/merge/deployment tracked separately.
- Do not merge until required GitHub verification checks pass and explicit user approval is received.
