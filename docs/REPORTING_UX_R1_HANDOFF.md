# Reporting UX R1 Handoff

Date: 2026-08-13
Status: IMPLEMENTED / VERIFIED; production deployment explicitly requested and pending at time of this commit.

## Scope

Reporting UX Phase R1 is a navigation-only foundation. It does not change report calculations, Supabase RPCs, hierarchy scope, export authorization, Finance billing semantics, or production data.

Implemented:
- `/reports` is now the Reports Overview.
- Business report moved to `/reports/business`.
- Existing filtered `/reports?...` Business URLs redirect to `/reports/business?...` while preserving query parameters.
- Central route catalogue: `apps/web-portal/lib/reports/navigation.ts`.
- Shared internal Reports navigation: `apps/web-portal/components/reports/report-navigation.tsx`.
- Desktop navigation uses report families: Overview, Executive, Business, Portfolio & Service, Operations, Controls.
- Mobile navigation uses one grouped Reports selector rather than wrapped report pills.
- Global Reports sidebar now uses real routes grouped by the same information architecture; stale `/reports#...` links were removed.
- Governance is hidden from shared Reports navigation, Reports Overview, and the global sidebar unless effective `manage_users` access is present. The Governance page retains its own server-side authorization.

Report families:
- Executive: Management Pack, Month-End Archive.
- Business: Business Performance, Distribution, Finance.
- Portfolio & Service: Renewals, Claims.
- Operations: Compliance & Operations.
- Controls: Readiness, Governance when authorized.

## Verification

PR: #312 `R1 reporting navigation foundation`
Verified feature head: `e761bf585c9c37733d6e4d816e159437b8b2328a`
Merge commit: `78f751266603a94aac6e8ec8426719f3e3810e47`
Final PR verification workflow: `31694448058`
Result: SUCCESS

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

## Durable learning

The final R1 verification initially failed because `Array.toSorted()` was outside the web portal TypeScript target library. The compatible implementation uses a copied array plus `.sort()`. Keep shared navigation compatible with the repository's existing TypeScript target rather than widening compiler libs for a small UI helper.

## Next phase

R2 is the shared report page shell and filter behavior phase. Do not start R2 as part of the R1 production release unless separately requested.
