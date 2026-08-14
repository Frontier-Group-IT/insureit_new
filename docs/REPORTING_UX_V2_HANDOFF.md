# INSUREIT Reports UX V2 Handoff

Date: 2026-08-14
Status: **IMPLEMENTED ON FEATURE BRANCH / FINAL CURRENT-MAIN VERIFICATION IN PROGRESS**
Production deployment: **NOT REQUESTED**

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

The previous complete verification was green, and the final verification is being rerun against current `main` after unrelated Expo workflow cleanup. Current verification base at this handoff update:

`a39514f79a62994c87ae78e801af050ef39e7dd7`

Final verified feature head, workflow and merge SHA must be filled after this run completes.

Do not create or modify `.deploy/production-trigger.json` for this work unless the user explicitly requests production deployment.
