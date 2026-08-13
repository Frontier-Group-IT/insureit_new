# Reporting UX R4 Handoff

Date: 2026-08-13
Status: IMPLEMENTED / VERIFIED / MERGED / DEPLOYED.

## Scope

Reporting UX Phase R4 improves report registers and mobile usability without changing report calculations, Supabase RPCs, hierarchy/customer scope, export authorization, Finance billing semantics, Management Pack snapshot/Close Month rules, or database behavior.

Implemented:
- Shared register primitives in `apps/web-portal/components/reports/report-register.tsx` for future/new report register rendering: responsive desktop/mobile views, record cards, labeled fields, explicit Open actions, and pagination.
- Reports-only responsive enhancer in `apps/web-portal/components/reports/report-register-enhancer.tsx`.
- The enhancer runs only inside the shared Reports page shell and reacts to report route/query changes.
- It reads each rendered table's existing column headers and annotates body cells with those labels.
- A table is converted to the mobile card treatment only when its rendered width exceeds its container; narrow tables stay normal tables.
- Mobile wide-table rows render as labeled record cards, two columns on normal phones and one column on very narrow screens.
- Existing icon-only row action buttons now display the explicit text `Open` while retaining their existing destination and icon.
- Existing report pagination controls receive consistent desktop/mobile density and stack safely on phones.
- The behavior applies across existing R2/R3 report pages through the common shell instead of duplicating mobile register JSX in every report page.
- No polling or global-site DOM observer is used. The enhancer is scoped to `.report-page-shell` and runs after report route/query changes.

## Performance boundary

This implementation deliberately avoids duplicating each report dataset into a second client-rendered mobile tree. The existing server-rendered table remains the source of truth; the scoped enhancer adds labels/classes only after render. Report loaders and database reads are unchanged.

## Verification

Final PR: #321 `R4 report registers and mobile usability (rebased)`
Final feature head: `cfa3ffad61b30ed7e8fed321fef716ad9a814c81`
Verification workflow: `31701768608` (run #631)
Result: SUCCESS
Merge commit: `d185b8c73ff9f629bdf481dcdc5a519d4e239c53`

Passed:
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

The first R4 PR #320 was closed without merge after `main` advanced during verification. R4 was replayed onto the then-current main commit `71445fd45287023791afd5542f3390d15ae58ef3` and the exact rebased head above was reverified before merge.

## Release state

R4 was not deployed by a dedicated R4 trigger. It became part of a later explicitly approved production snapshot after the compact Policy Portfolio release advanced `main`.

Production evidence:

```text
R4 merge commit: d185b8c73ff9f629bdf481dcdc5a519d4e239c53
Production snapshot: ee6f455f79d059aef85c5df613c8f1b7b8d5d914
Relationship: production snapshot is 5 commits ahead of the R4 merge; R4 merge is its merge-base/ancestor
GitHub production workflow: 31702267423 (run #221)
Workflow result: SUCCESS
Referenced compulsory verification workflow: verify-web-portal.yml at ee6f455f79d059aef85c5df613c8f1b7b8d5d914
Vercel deployment: dpl_89NXAGuzMkPdPa2i4m4F4gaeF9Ug
Vercel state: READY
Vercel target: production
Production alias: portal.insureit.in
Alias error: none
Post-deploy Reports runtime errors: none in the checked 3-hour window
Unauthenticated production probe: /reports/business returned the login page successfully, confirming the protected route is reachable and auth enforcement remains active
```

The server-side production probe cannot visually inspect authenticated mobile record-card rendering. Before R5, perform a brief logged-in visual smoke check on desktop and a narrow/mobile viewport for explicit `Open` actions, wide-table card conversion, readable labels, and stacked pagination.

## Next phase

R5 remains Management Pack workflow refinement, including Close Month confirmation and clearer Live/Frozen state handling. R5 must not begin until the R4 logged-in visual smoke check is accepted.
