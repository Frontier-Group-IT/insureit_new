# Reporting UX R3 Handoff

Date: 2026-08-13
Status: IMPLEMENTED / VERIFIED / MERGED. Combined R2 + R3 production release authorized; production verification pending at time of this commit.

## Scope

Reporting UX Phase R3 standardizes the visual system on top of the R2 shared report shell. It does not change report calculations, Supabase RPCs, hierarchy/customer scope, export authorization, Finance billing semantics, Management Pack snapshot/Close Month rules, or database behavior.

Implemented:
- Reports-only route layout at `apps/web-portal/app/reports/layout.tsx` so report styling does not leak into operational portal screens.
- Reports visual system at `apps/web-portal/app/reports/reporting.css`.
- Reports navigation styling at `apps/web-portal/app/reports/reporting-navigation.css`.
- Shared R2 shell now exposes stable visual hooks for title, header actions, controls, filter labels, primary/secondary actions, error, and empty states.
- Reports Overview participates in the same R3 visual system.
- General portal decorative card treatment is flattened inside Reports: white surfaces, restrained borders, smaller radii, subtle shadows, no decorative top sheen or backdrop blur.
- Report title, section heading, filter label, control, and table typography are normalized.
- Tier-1 KPI cards use consistent label/value hierarchy and tabular numerals.
- Tier-2 pipeline/exception cards use a quieter hierarchy so they do not compete with primary KPIs.
- Tables use consistent header/body density, metadata treatment, numeric alignment, hover behavior, and open-record control styling.
- Existing report semantic states are normalized to one restrained palette: information, success, warning, and danger.
- Status-chip geometry and typography are normalized across reports.
- Error, empty, and pagination treatments are visually consistent.
- Management Pack print behavior remains restrained and ink-friendly.

R3 deliberately does not convert the current icon-only row Open controls into explicit text actions; that remains R4 register/mobile scope. Close Month confirmation and Live/Frozen workflow refinement remain R5 scope.

## Verification

Initial R3 PR #316 was verified successfully at `cd89224c582f59d275018cb6ab59fa8cd084e94e` by workflow `31698583648`, but it was not merged because `main` advanced with an unrelated Vehicle Portfolio change while CI was running.

R3 was rebased on the then-current `main` and reopened as PR #317 `R3 reporting visual system (rebased)`.

Final verified feature head: `03daf09114abdab3ece3c2e074d5170fddbc7223`
Final PR verification workflow: `31699061146`
Result: SUCCESS
Merge commit: `95501e165baf4621151e221bb7be3fed9ac3926b`

Passed on the final rebased head:
- Access Control V2 catalogue regression
- Access Control V2 scope and compatibility regression
- Access Control V2 portal lifecycle regression
- Employee portal governance regression
- Release blocker security regression
- IFFCO structured regression
- IFFCO regression
- Digit regression
- New India regression
- TypeScript typecheck
- lint
- Next.js production build

## Release state

The user explicitly requested that R2 and R3 be merged and deployed together. R2 is already merged and R3 is now merged. Create one protected production trigger from the latest `main`, allow the production workflow to rerun the compulsory verification gate against that exact trigger snapshot, then verify the exact Vercel production deployment is READY on `portal.insureit.in` before labeling the combined release DEPLOYED.

## Next phase

R4 is the register/mobile usability phase:
- common register structure;
- mobile record cards where wide tables are unsuitable;
- explicit Open actions instead of icon-only affordances;
- consistent pagination and register-level action placement.

Do not begin R4 as part of the R2 + R3 production release unless separately requested.
