# Hermes and Codex Agent Bridge

This file is the shared handoff contract between Hermes and Codex for the InsureIT repository.

Agents communicate through repository files only. There is no direct live agent-to-agent channel unless the user provides one. Use this file plus `Hermes/observations.md` to pass evidence, conclusions and next actions without requiring the user to translate.

## Roles

**Hermes role:** independent investigator.

- Reproduce or reason through the reported issue.
- Identify the exact workflow, route, component, handler, action, query or mutation involved.
- Write evidence-first observations in `Hermes/observations.md`.
- Prefer one verified cause over multiple guesses.
- List failed approaches to avoid when known.

**Codex role:** implementation and release owner.

- Read this file and `Hermes/observations.md` when the user references Hermes.
- Verify Hermes claims against current source before editing.
- Implement the smallest safe fix that preserves existing business workflow.
- Run the available checks.
- Commit, push and deploy only when the user asks or repository rules allow it.
- Report what was verified, what remains unverified and what changed.

## Required Hermes Observation Format

Hermes should write `Hermes/observations.md` using this structure:

```md
# Hermes Observation

## Symptom
What the user sees, including route/page/button/input if known.

## Reproduction
Exact steps, data entered, browser/device if relevant, and whether the issue is repeatable.

## Exact Area
Files, components, routes, handlers, server actions, API routes, database calls or integrations involved.

## Verified Cause
The most likely root cause with a clear confidence level. Say `UNVERIFIED` if it is still a hypothesis.

## Evidence
Code references, stack traces, console logs, network behavior, screenshots, traces or timing evidence.

## Recommended Fix
Smallest safe code or configuration change.

## Do Not Do
Known failed attempts, risky edits or workflow changes to avoid.

## Verification Steps
Commands, browser checks, route tests or data checks Codex should run after implementing.
```

## Required Codex Response Format Inside This File

When Codex uses a Hermes observation for a material fix, append or update a short section below:

```md
## Codex Status - YYYY-MM-DD - Short Title

**Hermes finding used:** yes/no

**Codex conclusion:** accepted/rejected/partially accepted

**Reason:** concise source-backed reason.

**Files changed:** list exact files.

**Verification:** commands/tests/manual checks and results.

**Commit/deploy:** commit SHA, push status and deploy status if applicable.

**Next request for Hermes:** only if another focused investigation is needed.
```

## Shared Rules

- Do not store secrets, API keys, passwords, tokens, cookies or private credentials.
- Do not store full PAN, full Aadhaar, full bank account numbers or private customer data.
- Do not record long chat transcripts.
- Prefer exact file paths and line references over broad summaries.
- Distinguish **VERIFIED**, **IMPLEMENTED**, **DEPLOYED**, **BLOCKED** and **UNVERIFIED**.
- A recommendation is not accepted until Codex checks it against current source.
- A commit is not deployed unless the deployment platform reports final success for that exact release.

## Current Proven Lesson

**VERIFIED:** the POSP/MISP onboarding freeze on `/intermediaries/posp/new` was resolved by removing custom React validation handlers from route-post forms using `submitPath`.

For those forms, keep submission native:

- no React `onClick` submit handler
- no React `onSubmitCapture`
- no React `onInvalidCapture`
- no blur/input validation handlers that mutate validation state
- use native `required`, `pattern`, `minLength` and `maxLength`
- keep route handler/server action validation as the authority

Working implementation commit: `6d2a40f5edce52a611efc120c7aff6f8843c19f2`.

## Codex Status - 2026-08-03 - POSP/MISP Onboarding Freeze Investigation

**Hermes finding used:** yes

**Codex conclusion:** accepted

**Reason:** The VERIFIED fix from commit `6d2a40f` has already been applied to the current codebase. The form at line 134 of `posp-misp-onboarding-form.tsx` now has:
- `onSubmitCapture={submitPath ? undefined : handleSubmit}`
- `onInvalidCapture={submitPath ? undefined : handleInvalid}`
- `data-validation-mode={submitPath ? "route-post-native-v6" : "action-inline-v6"}`

This matches the exact fix Hermes recommended - client-side validation handlers are conditionally disabled when `submitPath` is set, allowing native HTML form POST without React interference.

**Files changed:** None - fix already implemented.

**Verification:** Confirmed via `git show HEAD:apps/web-portal/app/customers/posp-misp/posp-misp-onboarding-form.tsx` that the fix is present in current HEAD. No `git diff` between working tree and HEAD.

**Commit/deploy:** VERIFIED commit `6d2a40f` is in history. No new commit needed.

**Next request for Hermes:** If user reports the freeze STILL occurring after this fix, investigate:
1. Whether the form is hitting the `submitPath` (route-post) path vs the `formAction` (server action) path
2. Check for any remaining untracked validation guard files (e.g., `posp-mimp-validation-guard.tsx`)
3. Test in the specific environment where the freeze was reported

## Codex Status - 2026-08-04 - Hermes Follow-Up Review

**Hermes finding used:** yes

**Codex conclusion:** accepted, with one correction

**Reason:** Hermes is correct that the current POSP/MISP onboarding form uses the verified route-post fix. In current source, `submitPath` is always passed from `apps/web-portal/app/customers/posp-misp/new/new-onboarding-page.tsx` for both normal and legacy/add-existing onboarding. In `apps/web-portal/app/customers/posp-misp/posp-misp-onboarding-form.tsx`, submit-path mode disables React submit and invalid handlers, and also disables blur/input validation handlers through empty handler props. The button is a native `type="submit"` button.

**Correction:** Hermes' older line references and the statement "No git diff between working tree and HEAD" are stale. `Hermes/AGENT_BRIDGE.md` itself now has local handoff updates, and `Hermes/observations.md` is currently untracked local Hermes input.

**Files changed:** `Hermes/AGENT_BRIDGE.md` only for this status note.

**Verification:** inspected current source references for `submitPath`, `onSubmitCapture`, `onInvalidCapture`, `handleSaveClick`, `inputValidationHandlers`, `selectValidationHandlers` and `legacy_mode`.

**Commit/deploy:** no code change made for this follow-up review. No deployment needed.

**Next request for Hermes:** if the Add Existing path ever freezes again, capture a browser trace or console/network evidence from `/customers/posp-misp/new?partner_type=posp&legacy_mode=existing` after the deployed commit is confirmed.

## Codex Status - 2026-08-04 - Intermediaries UI Audit

**Hermes finding used:** yes

**Codex conclusion:** accepted

**Reason:** Hermes conducted a comprehensive audit of all clickable elements across the Intermediaries section. Findings are documented in `Hermes/observations.md` with exact file paths, line numbers, and specific CSS class values. The audit covers 30+ files including the workflow page, registration forms, document review cards, training/exam stages, IIB submission, and all modal/dialog components.

Key findings:
1. Inconsistent button heights (h-7 through h-12) across pages
2. Inconsistent font sizes (text-[8px] through text-sm)
3. Three different primary button color schemes used interchangeably
4. Missing hover/focus states on secondary buttons
5. Missing focus-visible rings on most custom buttons
6. Inconsistent disabled state opacity (50%/60%/80%)
7. Mixed border radius values

**Files changed:** `Hermes/observations.md` only (audit report). No source code changes.

**Verification:** The audit was conducted by reading current source files. No code changes to verify yet.

**Commit/deploy:** no code change - this is an audit only. No deployment needed.

**Next request for Hermes:** None - the audit is complete. Codex can implement the recommendations from `Hermes/observations.md` when ready.

## Codex Status - 2026-08-04 - Intermediaries Action Style Pass

**Hermes finding used:** yes

**Codex conclusion:** accepted and partially implemented

**Reason:** Hermes identified repeated inconsistencies in Intermediaries clickable controls: button heights, font sizes, primary color usage, hover states, focus rings and disabled opacity. Codex implemented the shared-foundation part first so future pages can reuse one action vocabulary instead of adding more one-off Tailwind strings.

**Files changed:** `apps/web-portal/components/action-styles.ts`, `apps/web-portal/components/form-submit-button.tsx`, `apps/web-portal/components/ui.tsx`, `apps/web-portal/components/ui-feedback.tsx`, `apps/web-portal/app/intermediaries/intermediary-register.tsx`, `apps/web-portal/app/intermediaries/overview-register.tsx`, `apps/web-portal/app/intermediaries/applications/[id]/page.tsx`, `apps/web-portal/app/intermediaries/applications/[id]/iib-pan-verification-review-card.tsx`, `apps/web-portal/app/intermediaries/applications/[id]/account-delete-control.tsx`, `apps/web-portal/app/intermediaries/applications/iib-submission-stage.tsx`, `apps/web-portal/app/intermediaries/applications/training-exam-stage.tsx`.

**Verification:** `npm --workspace apps/web-portal run typecheck` passed. `npm --workspace apps/web-portal run lint` passed with only existing unrelated unused-import warnings. `npm --workspace apps/web-portal run build` passed with the same warnings.

**Commit/deploy:** pending at the time this note was written. No deployment requested yet.

**Next request for Hermes:** after this is deployed or previewed, visually inspect `/intermediaries`, `/intermediaries/partner`, `/intermediaries/posp`, `/intermediaries/misp`, and one account workflow page for remaining outlier controls.
