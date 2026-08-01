# Frontend Design Audit Report Template

Use this structure for every full or evaluate-only audit.

```md
# UX Design Audit Report

**Audit mode:** Full / Evaluate only / Quick
**Scope:** [screens, flow, directory, or URL]
**Evidence reviewed:** [all files, screenshots, URLs, and relevant states]
**Interface type:** [dashboard, onboarding workflow, register, document review, etc.]
**Primary users:** [roles]
**Primary task:** [plain-language task sequence]
**Limitations:** [anything not rendered, executed, or observable]

## Executive summary

[Two to four paragraphs explaining the overall quality, the largest risks, and the most important opportunity. Separate confirmed evidence from inference.]

## Severity summary

| Severity | Count |
|---|---:|
| 4 — Catastrophic | 0 |
| 3 — Major | 0 |
| 2 — Minor | 0 |
| 1 — Cosmetic | 0 |
| **Total** | **0** |

## Priority actions

1. **[Finding ID and title]** — [why it matters now]
2. **[Finding ID and title]** — [why it matters now]
3. **[Finding ID and title]** — [why it matters now]

## Quick wins

| Finding | Severity | Effort | Expected benefit |
|---|---:|---|---|
| [ID/title] | 3 | Small | [benefit] |

## Findings

### F1 — [Concise finding title]

- **Severity:** 4 / 3 / 2 / 1
- **Principle:** [one or more of the 15 principles]
- **Location:** `path/to/file.tsx` / visible screen section / state
- **Evidence:** [specific observed code or behavior]
- **Issue:** [what is wrong]
- **User impact:** Users will [concrete negative outcome] because [observable behavior].
- **Frequency / impact / persistence:** [brief severity rationale]
- **Recommended fix:** [specific implementation-level correction]
- **Acceptance test:** [observable condition that proves the finding is resolved]
- **Trade-off or dependency:** [when relevant]

[Repeat in severity-descending order.]

## Strengths to preserve

1. **[Specific strength]** — [principle it satisfies and why it works]
2. **[Specific strength]** — [principle it satisfies and why it works]
3. **[Specific strength]** — [principle it satisfies and why it works]

## Principle coverage

| # | Principle | Result | Finding/strength/limitation reference |
|---:|---|---|---|
| 1 | Visibility of system status | Finding / Strength / Limited | F1 |
| 2 | Match between system and real world |  |  |
| 3 | User control and freedom |  |  |
| 4 | Consistency and standards |  |  |
| 5 | Error prevention |  |  |
| 6 | Recognition over recall |  |  |
| 7 | Flexibility and efficiency |  |  |
| 8 | Aesthetic and minimalist design |  |  |
| 9 | Error recovery |  |  |
| 10 | Help and documentation |  |  |
| 11 | Affordances and signifiers |  |  |
| 12 | Structure |  |  |
| 13 | Accessibility |  |  |
| 14 | Perceptibility |  |  |
| 15 | Tolerance and forgiveness |  |  |

## InsureIt domain-gate review

| Gate | Result | Evidence |
|---|---|---|
| Sensitive-data masking | Pass / Finding / Limited |  |
| Role and permission integrity |  |  |
| POSP/MISP/Partner workflow correctness |  |  |
| Document requirement correctness |  |  |
| Auditability and trust |  |  |

## Proposed implementation order

1. [Safety or task-blocking corrections]
2. [Shared design-system/component corrections]
3. [Interaction and workflow corrections]
4. [Page-specific visual corrections]
5. [Cosmetic coherence]

## Verification plan

- [ ] Reproduce each original issue before change where possible.
- [ ] Confirm acceptance test for every implemented finding.
- [ ] Test loading, success, empty, error, disabled, and permission states.
- [ ] Test keyboard and focus behavior.
- [ ] Check mobile and desktop layouts.
- [ ] Check long/empty/maximum content values.
- [ ] Confirm sensitive values remain masked.
- [ ] Confirm role restrictions and workflow transitions.
- [ ] Run lint/typecheck/build/tests where available.
```

## Finding quality rules

A finding is not complete unless it includes evidence, user impact, a concrete fix, and an acceptance test.

Do not combine unrelated issues into one finding merely because they occur in the same file. Combine issues only when they share the same root cause and remediation.

Do not create separate duplicate findings for the same defect under multiple principles. Use one primary finding and list all relevant principles.

## Screenshot-only reports

When the evidence is a screenshot:

- use screen regions instead of file locations;
- state that dynamic behavior, keyboard support, permissions, and loading/error states were not verified;
- do not claim exact contrast ratios without measuring them;
- phrase hidden-state concerns as questions or hypotheses, not confirmed findings.

## Implementation summary format

After fixes, append:

```md
# Changes Applied

| Finding | Status | Files changed | What changed |
|---|---|---|---|
| F1 | Fixed | `path/file.tsx` | [summary] |

## Post-implementation review

- **New issues found and fixed:** [list]
- **Remaining report-only items:** [list]
- **Checks run:** [commands and results]
- **Unverified areas:** [honest limitations]
```
