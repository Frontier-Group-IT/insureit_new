# Frontend Audit Fix Protocol

Use this protocol after findings have been approved or when Quick mode permits safe automatic correction.

## 0. Safety and scope

Before editing:

- create or use a dedicated branch;
- confirm the audited scope and the findings being implemented;
- record any behavior-changing decision that requires user approval;
- inspect the server action/API and permission checks behind visible controls;
- identify business logic that must remain unchanged;
- avoid database migrations unless the approved finding genuinely requires one;
- do not merge without explicit user instruction.

For InsureIt, preserve:

- POSP/MISP/Partner routing and qualification distinctions;
- existing document requirement logic unless the finding concerns that logic;
- Supabase RLS/role enforcement and server-side role checks;
- sensitive-data masking;
- account identifiers, status transitions, and audit history.

## 1. Establish the design foundation

Do not solve a system-wide inconsistency by adding more one-off classes.

Inventory the existing design vocabulary:

- typography levels;
- spacing scale;
- brand, neutral, and semantic colours;
- border radii and shadows;
- transition timing;
- button hierarchy;
- card, panel, table, badge, notice, form-field, modal, and empty-state patterns;
- icon libraries and sizing conventions.

Prefer existing tokens and shared components. When no coherent foundation exists, introduce the smallest shared foundation needed for the approved fixes.

### InsureIt defaults

- Keep the established navy/blue brand identity unless the user approves a rebrand.
- Use Lucide as the default functional icon source.
- Use local optimized visual assets only when they add recognition or explanation.
- One primary action per screen region.
- Icon-only controls require an accessible name and a visible tooltip on hover/focus.
- Do not turn every content group into a card.
- Use calm neutral surfaces for data-heavy enterprise screens.

## 2. Implement findings in dependency order

### First: severity 4 and safety defects

Examples:

- exposed sensitive values;
- unauthorized actions;
- blocked primary flow;
- destructive action without protection;
- wrong account-type workflow;
- duplicate record creation.

Correct server-side enforcement and workflow integrity before styling the visible symptom.

### Second: shared interaction and component defects

Examples:

- common loading button;
- form-field error pattern;
- accessible dialog;
- reusable empty state;
- status badge system;
- icon button pattern;
- active navigation state.

A shared fix should replace equivalent local patterns rather than coexist with them indefinitely.

### Third: workflow and page-specific issues

Examples:

- next-action routing;
- field order and grouping;
- progress tracker;
- document-upload states;
- table scanning and filter visibility;
- return-path preservation.

### Fourth: visual coherence

Examples:

- typography hierarchy;
- section spacing;
- alignment;
- button prominence;
- icon consistency;
- metadata weight;
- responsive density.

## 3. Implementation rules by issue type

### Async actions

Every user-triggered async action should have, as appropriate:

1. immediate pressed/disabled feedback;
2. progress or loading label;
3. prevention of duplicate submission;
4. success confirmation;
5. actionable failure message;
6. retry or recovery path;
7. idempotent server behavior for high-risk actions.

### Forms

- Keep visible labels.
- Use correct input type, input mode, autocomplete, length, pattern, and range constraints.
- Validate near the field and associate errors programmatically.
- Focus the first invalid field after submission.
- Preserve entered data after recoverable failure.
- Do not silently coerce important values.
- Explain required document and field conditions before submission.

### Dialogs and menus

- Provide an accessible name.
- Move focus into the surface when opened.
- Keep keyboard focus inside modal dialogs.
- Support Escape unless closing would be unsafe.
- Return focus to the trigger.
- Make Cancel visually safer than the destructive action.
- Implement expected arrow-key behavior for menus and tabs.

### Icon buttons

- Use a familiar icon.
- Add `aria-label` or equivalent accessible name.
- Add `title` only as a fallback; prefer a reusable tooltip.
- Maintain a minimum comfortable target size.
- Keep the primary action labelled when recognition is more important than compactness.
- Never rely on colour alone to distinguish destructive or active state.

### Tables and registers

- Keep headings visible and relationships clear.
- Make row clickability explicit.
- Avoid placing too many equal-weight actions in each row.
- Preserve keyboard access to row actions.
- Show active filters and result counts.
- Provide useful loading, empty, no-result, and error states.
- On mobile, preserve label-value relationships when converting rows to cards or stacked layouts.

### Document upload and review

- Show required/optional state before selection.
- State accepted formats and limits.
- Show selected filename before upload.
- Show progress during upload.
- Distinguish uploaded, verified, rejected, and replacement states.
- Preserve the current file until replacement succeeds.
- Provide Open/Preview through a permission-checked signed URL.
- Avoid using official-looking sample documents or readable personal data in decorative visuals.

## 4. Coherence pass

After individual fixes, review all modified surfaces together.

Check:

- identical components use identical spacing and typography;
- action hierarchy is consistent;
- colour meanings are stable;
- icons come from one family and use consistent size/stroke;
- interactive states exist everywhere, not just on the changed button;
- transitions use consistent timing;
- semantic states have visible counterparts;
- responsive layouts use the same information priority as desktop;
- no new raw hex, arbitrary size, or one-off shadow has leaked around the shared system;
- the page still feels like InsureIt rather than a generic template.

## 5. Verification protocol

### Re-read the changed code

Look specifically for:

- CSS specificity preventing the intended state;
- client-only hiding without server authorization;
- broken link/button semantics;
- stale state after navigation;
- race conditions and duplicate submissions;
- inconsistent account-type branches;
- unmasked sensitive values;
- hardcoded values bypassing shared tokens.

### Test state combinations

At minimum, inspect relevant combinations:

- normal, hover, focus, active, disabled;
- empty, loading, success, error;
- selected + disabled;
- active + hover;
- uploading + cancel/retry;
- long text, missing optional values, and maximum values;
- desktop, tablet, and narrow mobile widths;
- allowed and denied role contexts;
- POSP, MISP, and Partner contexts where relevant.

### Run repository checks

Run available checks from the relevant app:

```bash
npm run lint
npm run typecheck
npm run build
```

Run focused tests when present. Do not claim these passed unless the commands were actually executed successfully.

### Verify every finding

For each implemented finding, record:

- changed files;
- acceptance test result;
- checks run;
- any remaining limitation.

If post-implementation review uncovers more than three meaningful severity 2+ problems, report that a second focused audit is advisable rather than silently expanding the current change set.

## Quick-mode decision table

| Finding type | Auto-fix? |
|---|---|
| Missing accessible name on an obvious icon action | Yes |
| Missing loading/disabled state using an existing shared pattern | Yes |
| Clear contrast or focus defect using existing tokens | Yes |
| Broken semantic element with equivalent behavior | Usually |
| New confirmation flow for destructive action | Yes when consequence is unambiguous |
| Change field order or workflow stage | No without product confirmation |
| Replace labelled controls with icon-only controls | No unless explicitly requested |
| Add database field, migration, or new permission | No |
| Change POSP/MISP/Partner business rules | No |
| Major visual redesign | No unless the user requested redesign |

## Completion summary

Use the “Changes Applied” and “Post-implementation review” sections from `REPORT_TEMPLATE.md`. Include the pull request link when repository changes were made.
