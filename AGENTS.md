# Repository Agent Instructions

## Mandatory startup context

Before doing any work in this repository, read all of the following:

- `docs/INSUREIT_PROJECT_CONTEXT.md`
- `docs/CURRENT_CHAT_HANDOFF.md`
- `docs/ICALL_AWS_GATEWAY_HANDOFF.md`

Do this at the beginning of every new ChatGPT/Codex session connected to the repository. Do not ask the user to repeat information already recorded in those files.

Treat `docs/INSUREIT_PROJECT_CONTEXT.md` as the durable technical and business-rule source of truth. Treat `docs/CURRENT_CHAT_HANDOFF.md` as the current conversation continuation state, including active audit findings, selected work, implementation boundaries, and unresolved risks. Treat `docs/ICALL_AWS_GATEWAY_HANDOFF.md` as the source of truth for the iCall APIs, AWS Lightsail fixed-IP gateway, Vercel environment, SSO/iframe integration, CSP history, cookie issue, verified state, and immediate continuation steps.

Update the durable project context after material workflow, schema, constraint, migration or architecture changes. Update or consolidate the current chat handoff after active work is materially implemented, blocked or verified. Update the iCall gateway handoff after material iCall API, gateway, domain, IP allowlist, CSP, cookie, SSO, iframe, UAT or production changes.

Never store secrets, API keys, passwords, tokens, cookies, private keys, full sensitive identity values or MCP credentials in repository context files.

## Smart context retention and learning policy

Repository context is a curated operational memory, not a transcript archive. **Do not update `AGENTS.md` or a context/handoff file after every chat.** Save information only when it materially improves the correctness, safety or continuity of future work.

### What belongs in durable context

Record only:

- A verified business rule, invariant, schema constraint, API contract or architecture decision.
- A user-approved decision that was actually implemented or is an explicit current requirement.
- A confirmed production/staging state supported by direct evidence.
- An unresolved blocker, dependency or risk that the next session must know to continue safely.
- A concise learning from a failed approach when its root cause and corrected rule will prevent repetition.

Do not record:

- Raw chat transcripts, every prompt, brainstorming, abandoned options or repetitive status updates.
- Speculation, assumptions or a proposed fix presented as current fact.
- Temporary debugging noise, copied logs, stack traces or raw provider/database errors.
- Claims that a build, deployment, migration, integration or workflow succeeded without direct evidence.
- Secrets or unnecessary personal/sensitive data.

### Evidence labels

When state could be misunderstood, identify it accurately:

- **VERIFIED** — directly observed in current code, schema, environment, logs or a repeatable test.
- **IMPLEMENTED** — committed in code; this does not automatically mean deployed or live.
- **APPLIED** — migration/configuration was confirmed in the target environment.
- **DEPLOYED** — the target platform reported a successful final deployment for the exact commit.
- **BLOCKED** — a named dependency prevents completion.
- **LEARNING** — a failed attempt produced a reusable root-cause rule.
- **UNVERIFIED** — expected or documented, but not directly confirmed.

Do not collapse these states. In particular, committed is not applied, a deploy-hook request is not deployed, and an API success response is not proof of a complete user journey.

### How to record successful work

Record the durable outcome, not the conversation that produced it. Include only the minimum useful evidence, such as:

- Business or technical rule established
- Files/schema/integration affected
- Commit or migration identifier
- Checks actually run and their result
- Deployment/application state if directly verified
- Remaining risk or follow-up

### How to record mistakes and failed approaches

Preserve a failed approach only when it teaches a durable lesson. Summarize:

1. What assumption or approach failed
2. The verified root cause
3. The corrected rule or safer approach
4. Whether cleanup, repair or verification remains

Do not preserve a long failure chronology. Do not state “no changes were made” when compensating cleanup was best-effort or unverified. Never turn a speculative workaround into a repository rule.

### Context file boundaries

- `AGENTS.md` — stable operating rules for agents and repository work. Do not use it as project history.
- `docs/INSUREIT_PROJECT_CONTEXT.md` — durable current business rules, architecture, schema constraints and verified system lessons.
- `docs/CURRENT_CHAT_HANDOFF.md` — only the active continuation state needed by the next session. Rewrite/consolidate stale sections instead of continuously appending.
- `docs/ICALL_AWS_GATEWAY_HANDOFF.md` — iCall/gateway-specific verified state, blockers and continuation actions.
- `docs/PRODUCTION_READINESS_AUDIT.md` — current source-backed production risks and remediation order.
- `docs/PRODUCTION_RELEASE_CHECKLIST.md` — reusable evidence-based release gates.

When information becomes obsolete, replace or remove it. Avoid duplicating the same fact across files unless a short cross-reference is necessary for safety.

### Context update test

Before writing context, ask:

1. Is this fact verified, approved, blocked or a durable learning?
2. Will a future session make a safer or more correct decision because it is recorded?
3. Is this the correct context file?
4. Can the same value be expressed more briefly without losing the evidence or warning?

If the answer to either of the first two questions is no, do not save it.

### Current working agreement

- Approved changes for this established project may be committed directly to `main` unless the user explicitly requests a branch or pull request.
- Before modifying an existing file, fetch the current `main` version and use its current blob SHA.
- Vercel deploys from `main`.
- Automatic Vercel deployment from ordinary Git commits is intentionally disabled.
- Ordinary development commits must not modify `.deploy/production-trigger.json`.
- Trigger one batched production deployment only after the user explicitly says **deploy now** or **finish and deploy**. Do this by updating `.deploy/production-trigger.json`; `.github/workflows/deploy-production.yml` then calls the protected Vercel deploy hook.
- A successful GitHub Actions hook request proves only that Vercel accepted the request. Check the Vercel build/deployment result before claiming production success.
- A committed migration is not proof that it has been applied in Supabase.
- Do not claim build, deployment, migration or live workflow success without direct evidence.

## Production readiness protocol

For full website audits, pre-production checks, release planning, production deployment or post-release review, read and follow:

- `docs/PRODUCTION_READINESS_AUDIT.md`
- `docs/PRODUCTION_RELEASE_CHECKLIST.md`

A production release is **NO-GO** while any severity-4 finding remains open. A checklist item is not complete without an owner and direct evidence tied to the exact release commit and target environment.

Do not replace the full release checklist with a visual UI review. Production readiness includes authorization, sensitive data, database integrity, migrations, storage, business workflows, integrations, accessibility, performance, observability, backup/restore, deployment verification and rollback.

## Frontend design audit protocol

When a user asks to review, audit, improve, simplify, polish, or check the accessibility/usability of an existing interface, or describes symptoms such as users getting confused, abandoning a form, missing actions, or struggling with a workflow, read and follow:

- `docs/frontend-design-audit/CHATGPT_SKILL.md`
- `docs/frontend-design-audit/INSUREIT_CHECKLIST.md`
- `docs/frontend-design-audit/REPORT_TEMPLATE.md`
- `docs/frontend-design-audit/FIX_PROTOCOL.md`

Use the protocol for existing interfaces, screenshots, live pages, or source code. Do not use it as a substitute for feature planning, backend debugging, security review, performance profiling or the production readiness protocol.

### Mode mapping

- **“Audit/review this UI”** → full audit: evaluate, report, discuss, implement approved changes, verify.
- **“Evaluate only”** → report only; do not modify code.
- **“Improve from the audit”** → implement previously approved findings, then verify.
- **“Quick audit/fix”** → automatically fix safe severity 3–4 findings and straightforward severity 2 findings; report ambiguous items without guessing.

### Repository safeguards

- Preserve Supabase schemas, APIs, business rules, role permissions and workflow transitions unless the user explicitly approves a logic change.
- Never expose full Aadhaar, PAN, bank account or other sensitive identity data in the interface or client payload.
- Treat POSP, MISP and Partner as distinct account contexts and do not apply qualification stages to Partner accounts.
- Verify desktop and mobile behavior, loading/error/empty states, keyboard interaction and permission-gated actions.
- Run available lint, typecheck, build and tests before claiming success.
- Do not merge a pull request unless the user explicitly asks.
