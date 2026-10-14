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

## 2026-10-14 continued after Cloudflare production deployment
User confirms all four actions remain unresponsive on Cloudflare even after PR #3153 deployment. Prior static test checked only source existence, not native pointer gesture -> React handler -> dialog -> actual submit. Git commit review shows the menu was originally in-page (2026-09-18), later switched to a portal to escape table clipping. PR #3153 changed only document outside-press filtering, not the action activation event; its fix was insufficient.

New isolated branch `fix/associate-menu-press-routing-20261014` adds pointer-first activation for Edit/Disable/Delete (with click fallback for keyboard/assistive technology), plus pointer-up requestSubmit for Resend with click de-duplication. Assumption: a focus/scroll/DOM movement between pointerdown and click is cancelling activation; this mechanism is plausible, **not proven** absent live pointer traces. No schema, RLS, server action, auth or database changes. Do not claim production resolution until real-browser verification on deployed build. Do not exercise Delete/Disable/Resend on real people; use approved test identities only.

Release controls: CI, lint, typecheck, build, browser interaction test with pointer and keyboard, no merge/Cloudflare publish without verified behavior and explicit authorization. Revert this branch if the hypothesis does not pass actual browser verification.
