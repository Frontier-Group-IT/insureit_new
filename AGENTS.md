# Repository Agent Instructions

## Mandatory project context

Before changing intermediary, Partner, POSP, MISP, onboarding, document, registration, portal-user, or IIB code, read:

- `docs/INSUREIT_PROJECT_CONTEXT.md`

Treat that document as the current technical handover and business-rule context. Update it after material workflow, schema, constraint, migration, or architecture changes.

### Current working agreement

- Approved changes for this established project may be committed directly to `main` unless the user explicitly requests a branch or pull request.
- Before modifying an existing file, fetch the current `main` version and use its current blob SHA.
- Vercel deploys from `main`.
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
