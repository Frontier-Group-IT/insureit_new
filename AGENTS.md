# Repository Agent Instructions

## Mandatory startup context

Before doing any work in this repository, read both:

- `docs/INSUREIT_PROJECT_CONTEXT.md`
- `docs/CURRENT_CHAT_HANDOFF.md`

Do this at the beginning of every new ChatGPT/Codex session connected to the repository. Do not ask the user to repeat information already recorded in those files.

Treat `docs/INSUREIT_PROJECT_CONTEXT.md` as the durable technical and business-rule source of truth. Treat `docs/CURRENT_CHAT_HANDOFF.md` as the current conversation continuation state, including active audit findings, selected work, implementation boundaries, and unresolved risks.

Update the durable project context after material workflow, schema, constraint, migration, or architecture changes. Update or consolidate the current chat handoff after the active work is materially implemented and verified.

Never store secrets, API keys, passwords, tokens, cookies, private keys, or MCP credentials in repository context files.

### Current working agreement

- Approved changes for this established project may be committed directly to `main` unless the user explicitly requests a branch or pull request.
- Before modifying an existing file, fetch the current `main` version and use its current blob SHA.
- Vercel deploys from `main`.
- Automatic Vercel deployment from ordinary Git commits is intentionally disabled.
- Ordinary development commits must not modify `.deploy/production-trigger.json`.
- Trigger one batched production deployment only after the user explicitly says **deploy now** or **finish and deploy**. Do this by updating `.deploy/production-trigger.json`; `.github/workflows/deploy-production.yml` then calls the protected Vercel deploy hook.
- A successful GitHub Actions hook request proves only that Vercel accepted the request. Check the Vercel build/deployment result before claiming production success.
- A committed migration is not proof that it has been applied in Supabase.
- Do not claim build, deployment, migration, or live workflow success without direct evidence.

## Frontend design audit protocol

When a user asks to review, audit, improve, simplify, polish, or check the accessibility/usability of an existing interface, or describes symptoms such as users getting confused, abandoning a form, missing actions, or struggling with a workflow, read and follow:

- `docs/frontend-design-audit/CHATGPT_SKILL.md`
- `docs/frontend-design-audit/INSUREIT_CHECKLIST.md`
- `docs/frontend-design-audit/REPORT_TEMPLATE.md`
- `docs/frontend-design-audit/FIX_PROTOCOL.md`

Use the protocol for existing interfaces, screenshots, live pages, or source code. Do not use it as a substitute for feature planning, backend debugging, security review, or performance profiling.

### Mode mapping

- **“Audit/review this UI”** → full audit: evaluate, report, discuss, implement approved changes, verify.
- **“Evaluate only”** → report only; do not modify code.
- **“Improve from the audit”** → implement previously approved findings, then verify.
- **“Quick audit/fix”** → automatically fix safe severity 3–4 findings and straightforward severity 2 findings; report ambiguous items without guessing.

### Repository safeguards

- Preserve Supabase schemas, APIs, business rules, role permissions, and workflow transitions unless the user explicitly approves a logic change.
- Never expose full Aadhaar, PAN, bank account, or other sensitive identity data in the interface.
- Treat POSP, MISP, and Partner as distinct account contexts and do not apply qualification stages to Partner accounts.
- Verify desktop and mobile behavior, loading/error/empty states, keyboard interaction, and permission-gated actions.
- Run available lint, typecheck, build, and tests before claiming success.
- Do not merge a pull request unless the user explicitly asks.
