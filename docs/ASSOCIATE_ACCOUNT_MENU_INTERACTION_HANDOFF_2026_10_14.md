# Associate Accounts menu interaction — 2026-10-14

## Incident
On the production Intermediary Application Review → Associate Accounts Register, user reports the dropdown opens but Edit, Disable, Delete and Resend Link do not respond, including in Chrome Incognito. Previous console screenshot showed extension permission warnings, not an application stack trace. No live DOM event trace or production JavaScript bundle comparison is yet available: **the exact runtime cause has NOT been proven**.

## Code review
Component: `apps/web-portal/app/intermediaries/applications/[id]/associate-accounts/associate-account-actions-menu.tsx`.
Dropdown is a React portal with native document-wide outside-press listener. Form server actions exist for all four operations, but cannot explain an Edit confirmation modal that never appears.
Potential separate database mismatch: list filters by `intermediary_id` but `loadManagedAssociate` also filters by `application_id`. Do not change backend authorization or DB without read-only production record verification.

## Branch-only mitigation
Branch: `fix/associate-actions-menu-interaction-20261014`.
- Make outside interaction detection portal-aware through `PointerEvent.composedPath()`.
- Prevent pointer events inside the popup from reaching unrelated ancestor/document listeners.
- Preserve existing dialogs, roles, authorization, server actions, audit and data.
- Add `associate-actions-menu-interaction-regression.mjs` as a static contract guard.

## Verification and release gates
- Static regression is NOT a live browser acceptance test.
- Confirm actual click target, `onClick` execution, React modal state, and rendered dialog on the exact deployed build before claiming root-cause resolution.
- Run Web CI, typecheck, lint, build and interactive browser smoke on branch/preview before merge.
- Do not merge or deploy until explicit user approval.
- No production DB, auth, schema, RLS, mobile, APK/AAB or other deployment changes.
- If symptom persists, capture the production DOM event path and JS errors; revert this isolated fix rather than weakening permissions.
