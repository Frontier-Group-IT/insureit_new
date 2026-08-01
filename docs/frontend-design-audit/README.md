# ChatGPT Frontend Design Audit

This directory defines a repeatable UX and frontend-design audit process for InsureIt. It adapts the systematic approach used by `mistyhx/frontend-design-audit` for ChatGPT/Codex workflows and adds InsureIt-specific checks for intermediary onboarding, documents, role permissions, workflow state, and sensitive data.

## Files

- `CHATGPT_SKILL.md` — when to use the audit and the complete Discover → Evaluate → Report → Discuss → Implement → Verify workflow.
- `INSUREIT_CHECKLIST.md` — the 15 usability principles translated into InsureIt-specific checks.
- `REPORT_TEMPLATE.md` — the mandatory evidence-based report format.
- `FIX_PROTOCOL.md` — implementation, safety, design-system, and post-change verification rules.

## Natural-language modes

### Full audit

Example: `Audit the intermediary account review page and fix the approved issues.`

Produces a complete report, explains priorities and trade-offs, implements approved changes, and verifies the result.

### Evaluate only

Example: `Evaluate the POSP document upload workflow only. Do not change code.`

Produces the report and recommendations without repository changes.

### Improve

Example: `Implement findings F1, F3, and F6 from the last audit.`

Uses a previous report as the source of truth and implements only the selected findings.

### Quick audit

Example: `Quick-audit the intermediary register and fix safe high-priority issues.`

Automatically implements safe severity 3–4 findings and straightforward severity 2 findings. Ambiguous or behavior-changing findings are reported rather than guessed.

## Evidence rules

An audit finding must be supported by at least one of:

- exact source file and relevant code location;
- visible evidence from a provided screenshot;
- reproducible behavior from the live interface;
- a clear cross-page inconsistency found in the repository.

Do not invent missing states or claim behavior that was not inspected. When only a screenshot or live HTML is available, state what cannot be verified.

## Attribution

Methodology inspired by the MIT-licensed `mistyhx/frontend-design-audit` repository. This version is rewritten and adapted for ChatGPT, Next.js, Tailwind, Supabase, and InsureIt workflows.
