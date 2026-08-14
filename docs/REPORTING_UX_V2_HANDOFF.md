# INSUREIT Reports UX V2 Handoff

Date: 2026-08-14
Status: **IMPLEMENTED / VERIFIED / MERGED**
Production deployment: **NOT REQUESTED / NOT YET UX-V2 DEPLOYED**

## Product direction

Reports UX V2 treats reporting as one insurance-broker management product rather than a directory of independent reports.

The only top-level reporting workspaces are:

1. Overview
2. Business
3. Portfolio
4. Claims
5. Operations

Existing report URLs remain available for bookmarks, exports and compatibility, but they are no longer presented as equal top-level destinations.

## Navigation model

### Global portal sidebar

The Reports workspace exposes one entry only:

- Reporting Workspace -> `/reports`

Business, Distribution, Finance, Renewals, Claims and Operations are no longer duplicated as global sidebar links.

### Reports workspace navigation

- Overview -> `/reports`
- Business -> `/reports/business`
- Portfolio -> `/reports/renewals`
- Claims -> `/reports/claims`
- Operations -> `/reports/operations`

Contextual secondary navigation is deliberately limited to areas where multiple existing report engines belong to the same business job:

Business:
- Performance -> `/reports/business`
- Distribution -> `/reports/distribution`
- Finance -> `/reports/finance`

Operations:
- Compliance -> `/reports/operations`
- Data Quality -> `/reports/readiness`

There is no second row for Portfolio or Claims because each is already a coherent workspace.

## Executive / month-end treatment

Management Pack and Month-End Archive remain fully supported but are no longer normal peer report tabs.

They are accessed from Overview as month-end actions:

- Month End -> `/reports/management-pack`
- Archive / Frozen Packs -> `/reports/management-pack/archive`

Existing close-month eligibility, immutable snapshot behavior, privacy and archive rules are unchanged.

## Governance treatment

Governance is no longer shown inside normal Reports navigation.

Authorized users with effective `manage_users` access find it under:

Administration -> Audit & Governance

The existing route remains `/reports/governance` for compatibility and no authorization rule is weakened.

## Overview management cockpit

`/reports` is no longer a directory of cards linking to every report.

It loads existing scoped report services and presents a concise broker-management view:

Primary metrics:
- Gross Premium
- Policies
- Projected PayIn
- Open Claims
- Renewals within 30 days

Decision sections:
- Premium & Policy Trend (YTD)
- Attention queue using existing renewals / finance / operations / onboarding metrics
- Insurer Business (YTD ranked table)
- Upcoming Renewals
- Broker Position
- Month-end actions

The page uses existing loaders. No new reporting calculation or database aggregate was invented for UX V2.

## Visual system

UX V2 is intentionally enterprise/MIS rather than decorative SaaS styling:

- white primary surfaces;
- restrained cool-grey canvas/surfaces;
- deep navy/insurance blue hierarchy;
- semantic red/amber only for actual exceptions;
- 7-10px radii instead of oversized rounded cards;
- minimal shadows;
- compact 11-13px reporting typography;
- tabular numerals;
- ranked tables and simple bars rather than excessive charts;
- denser filter/action toolbar;
- fewer visible navigation choices.

New stylesheet:

`apps/web-portal/app/reports/reporting-v2.css`

Shared report shell controls were also tightened for the enterprise reporting treatment without changing their filter semantics.

## Compatibility and safety

Preserved:

- hierarchy-aware `view_reports` customer scope;
- Governance effective `manage_users` restriction;
- R6 canonical Relationship Manager UUID filtering;
- existing report RPCs and calculations;
- Finance billing semantics;
- Claims calculations;
- renewal horizon semantics;
- Readiness rules;
- report export authorization;
- Management Pack snapshot/archive immutability;
- existing source-record Open routes;
- legacy `/reports?...` Business-query redirect behavior;
- existing report URLs and bookmarks.

No Supabase migration is required for UX V2.

## Files changed

- `apps/web-portal/lib/reports/navigation.ts`
- `apps/web-portal/components/reports/report-navigation.tsx`
- `apps/web-portal/components/reports/report-page-shell.tsx`
- `apps/web-portal/components/claim-manager/app-navigation.tsx`
- `apps/web-portal/app/reports/layout.tsx`
- `apps/web-portal/app/reports/page.tsx`
- `apps/web-portal/app/reports/governance/page.tsx`
- `apps/web-portal/app/reports/reporting-navigation.css`
- `apps/web-portal/app/reports/reporting-v2.css`

## Verification / merge evidence

PR: `#335 — Reports UX V2: simplify and professionalize reporting workspace`

Final verified feature head:

`444d3c50cc08a8d3d3af80d4d02b117ae1841dcb`

Final verification was run against current-main merge base:

`a39514f79a62994c87ae78e801af050ef39e7dd7`

GitHub verification workflow:

`31771394848`

Passed:
- Access control V2 catalogue regression
- Access control V2 scope and compatibility regression
- Access control V2 portal lifecycle regression
- Employee portal governance regression
- Release blocker security regression
- IFFCO structured regression
- IFFCO regression
- Digit regression
- New India regression
- Additional insurer OCR regression
- TypeScript typecheck
- Lint
- Next.js production build

Merge commit:

`bc8b197fb6aba4301a54b3901bc3b87e9920dbc9`

## Deployment state

Reports UX V2 is merged into `main` but no UX-V2-specific production deployment trigger has been created.

Do not describe UX V2 as production-deployed until the user explicitly requests deployment and the exact Vercel production deployment reaches READY.
