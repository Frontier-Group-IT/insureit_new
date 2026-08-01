# ChatGPT Frontend Design Audit Methodology

## Purpose

Use this protocol to evaluate and improve an existing frontend interface as a senior UX engineer would: inspect the full user journey, identify evidence-backed usability problems, rate their severity, recommend concrete fixes, implement approved changes safely, and perform a second review after implementation.

This is broader than an accessibility lint. It covers:

- component-level semantics and interaction;
- visual hierarchy and information density;
- loading, success, error, and empty states;
- hidden UI such as dialogs, menus, drawers, and toasts;
- cross-page consistency and design-system coherence;
- navigation, information architecture, and workflow continuity;
- responsive and keyboard behavior;
- domain-specific safety for InsureIt.

Do not use this protocol for a brand-new interface with no existing design, backend debugging, security penetration testing, or pure performance profiling.

## Inputs

The audit can use one or more evidence sources:

1. **Repository source** — strongest evidence; code can be audited and changed.
2. **Screenshot or design mockup** — visual hierarchy and visible affordances can be assessed; dynamic behavior cannot be assumed.
3. **Live URL** — rendered markup and visible behavior can be reviewed; limitations must be stated.
4. **Existing audit report** — used as the implementation source of truth.

When evidence is incomplete, separate confirmed findings from reasonable hypotheses.

## Modes

### Full audit

Discover → Evaluate → Report → Discuss → Implement → Verify.

All findings are proposed for correction by default, but behavior-changing or ambiguous changes require user approval.

### Evaluate only

Discover → Evaluate → Report. No code changes.

### Improve

Use an existing audit. Implement only the selected findings in severity order, then verify.

### Quick audit

Discover → Evaluate → Triage → Implement safe fixes → Verify → Summarize.

Automatically fix:

- severity 3–4 findings when the correction is clear and preserves behavior;
- severity 2 findings when the change is local, safe, and reversible.

Report without auto-fixing:

- behavior-changing product decisions;
- ambiguous workflow changes;
- changes to database schemas, permissions, APIs, or business rules;
- cosmetic severity 1 findings unless bundled into an already approved coherence pass.

## Severity model

Rate user impact, not implementation effort.

| Score | Label | Meaning | Default action |
|---|---|---|---|
| 0 | Not a problem | No meaningful usability issue | Do not report as a finding |
| 1 | Cosmetic | Appearance or polish issue with little task impact | Fix when convenient |
| 2 | Minor | Users notice friction but can work around it | Plan and fix |
| 3 | Major | Users struggle, repeat actions, make errors, or abandon the task | High priority |
| 4 | Catastrophic | Primary task is blocked, sensitive data is exposed, permissions fail, or serious irreversible errors are likely | Immediate fix |

Consider three dimensions:

- **Frequency** — how often the affected user encounters it;
- **Impact** — inconvenience, struggle, error, exclusion, or complete blockage;
- **Persistence** — one-time learning issue or recurring problem.

A frequent, high-impact, recurring problem is normally severity 4. A rare, easily bypassed visual defect is normally severity 1.

## Workflow

### 1. Discover

Build an evidence map before judging the design.

For repository audits, inspect:

- application shell, layout, navigation, global CSS, tokens, and shared components;
- all pages in the requested flow;
- server actions/API calls that control visible states;
- form validation and submission behavior;
- dialogs, dropdowns, toasts, drawers, tabs, accordions, and mobile menus;
- loading, empty, success, error, disabled, and permission-denied states;
- responsive classes and touch targets;
- existing icon sources and reusable component patterns.

For projects with more than roughly 20 UI files, agree on the primary flows, but still inspect shared layout and representative pages from each distinct section.

Document:

- interface type;
- intended users and roles;
- primary and secondary tasks;
- relevant account/workflow states;
- files and screens reviewed;
- limitations and unverified behavior.

### 2. Model the user journey

Write the expected task sequence in plain language before evaluating isolated components.

For example:

`Open intermediary register → find account → inspect status → open review → complete next action → receive confirmation → return to updated account.`

Identify:

- entry point;
- required information;
- decisions the user must make;
- system feedback after each action;
- possible errors and recovery paths;
- completion state and next recommended action.

This prevents the audit from optimizing individual cards while missing a broken end-to-end flow.

### 3. Evaluate systematically

Evaluate all 15 principles in `INSUREIT_CHECKLIST.md`. Every principle must produce at least one of:

- a finding;
- a documented strength;
- a limitation explaining why it could not be assessed.

Inspect each principle at four levels.

#### Component level

- semantic HTML and correct link/button usage;
- readable labels, help text, and error text;
- focus, hover, active, selected, and disabled states;
- keyboard and screen-reader behavior;
- responsive layout and touch sizing;
- local visual hierarchy, spacing, and alignment.

#### Hidden and dynamic UI

- dialogs: accessible name, focus trap, Escape, cancel, return focus;
- dropdowns and menus: expanded state, arrow-key navigation, outside click, Escape;
- tabs and accordions: roles, selected state, keyboard pattern;
- toasts: announcement, timing, dismissibility, persistent errors;
- forms: inline validation, first-error focus, data preservation;
- async actions: disabled controls, progress, success/error feedback;
- empty and permission states: explanation plus a useful next action.

#### System level

- terminology and status names across pages;
- design tokens, spacing scale, typography scale, radii, shadows, and transitions;
- one consistent icon family and icon sizing rules;
- identical actions using identical patterns;
- wayfinding, breadcrumbs, return paths, and active navigation;
- consistency between desktop and mobile.

#### Workflow and domain level

- correct POSP, MISP, and Partner branching;
- role-gated actions and server-side authorization;
- sensitive-data masking;
- document requirement logic;
- workflow-stage accuracy and next-action calculation;
- data preservation and auditability.

Do not fabricate issues. Equally, do not stop after a handful of obvious ARIA defects. A useful audit must examine visible design, interaction, system coherence, and edge states.

### 4. Build evidence-backed findings

Every finding must contain:

- unique ID;
- severity;
- principle;
- exact file/section/state;
- evidence;
- concrete user impact;
- proposed correction;
- acceptance test.

Use the pattern:

`Users will [negative outcome] because [observable interface behavior].`

Avoid vague wording such as “make it more user-friendly.” State the actual change.

### 5. Report and prioritize

Use `REPORT_TEMPLATE.md`.

Order findings by:

1. severity;
2. primary-flow impact;
3. frequency;
4. dependency order.

Include at least three specific strengths so the report protects what already works.

Identify quick wins separately, but never lower the severity of a problem because it is easy to fix.

### 6. Discuss trade-offs

Before implementing ambiguous changes, explain the trade-off. Examples:

- confirmation dialogs prevent mistakes but add friction;
- icon-only controls save space but increase recognition burden;
- progressive disclosure reduces clutter but may hide advanced options;
- optimistic updates feel faster but require rollback behavior.

The user’s operational knowledge overrides aesthetic preference when the two conflict.

### 7. Implement

Follow `FIX_PROTOCOL.md`.

Implement in dependency order:

1. safety and task-blocking issues;
2. design foundation and shared components;
3. workflow and interaction fixes;
4. page-specific visual fixes;
5. cosmetic coherence.

Preserve existing behavior unless the approved finding explicitly calls for a behavior change.

### 8. Verify

Verification is a fresh review, not a statement that code was changed.

Check:

- the original finding is actually resolved;
- semantic state and visible state agree;
- CSS specificity does not hide the fix;
- combined states work: active + hover, selected + disabled, loading + error;
- long text, empty values, maximum values, and mobile widths remain usable;
- role restrictions and workflow transitions still work;
- no sensitive information has become visible;
- no ad-hoc design values bypass the shared system;
- lint, typecheck, build, and relevant tests pass when available.

Report newly discovered issues separately. Do not silently broaden scope into a second large audit.

## Communication style

- Begin with the intended outcome, not internal process narration.
- Explain the user consequence in plain language.
- Use UX terminology when useful, but do not lecture.
- Distinguish observed behavior, code inference, and assumptions.
- Acknowledge well-designed parts.
- Never claim visual or runtime verification that was not performed.

## Attribution

This methodology is an original ChatGPT/InsureIt adaptation inspired by the MIT-licensed `mistyhx/frontend-design-audit` project. It preserves the project’s core ideas—systematic heuristic coverage, impact-based severity, evidence-backed findings, design-foundation-first implementation, and post-change review—while adding repository and domain safeguards for InsureIt.
