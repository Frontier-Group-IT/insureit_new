# Employee Organization Explorer — Team Focus UX (2026-11-07)

## Scope
PR #4120 on branch `feat/employee-orgchart-focus-navigation-20261107`. Implements approved phases 1–3 only (readability, drag safety, focused navigation). Do not merge or deploy before review/approval.

## Data and authorization (unchanged)
- `/employees` server page continues to require `view_employees` and employee access scope.
- `loadDirectoryPartnerNetwork` continues to require existing intermediary manager access, use `getAccessibleIntermediaryIds`, and join onboarding `associate_employee_id` to visible employee IDs.
- No Supabase schema/RLS modifications, employee reassignments, partner ownership writes or mobile builds.

## UX behavior
- Default **Team focus** shows reporting chain, selected employee, direct reports in pages of six (up to three columns), cross-root navigation and separate paginated partner/POSP/MISP business-network disclosure.
- **Full chart** retains original curved-connector structure and controls; scale floor 0.72 prevents illegible auto-fit. Users may pan around instead.
- Full chart pointer drag prevents browser text selection; pointer capture/release and 4px movement threshold reduce accidental interaction.
- Search/department filtering remains authorized and read-only.
- Existing directory Table and employee management actions are unchanged.

## QA before release
- Run `Verify web portal` on the PR and check regression `employee-orgchart-focus-ux-regression.mjs` (called from employee portal governance regression), TypeScript, lint and Next build.
- Authenticated browser validation: wide sales team, multiple hierarchy roots, RM > POSP/MISP business networks, restricted roles, mobile widths, search, focus navigation, blank-canvas dragging with no selected text, Full Chart zoom/pan.
- Do not claim a production deployment without verifying a corresponding deployment workflow.

## Deferred phases
- Phase 4 detailed employee side drawer with authorized actions.
- Phase 5 organization overview, mini-map and further motion/visual polish.
