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
