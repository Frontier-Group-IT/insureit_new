# Operations Business Performance centered KPI layout — 2026-10-13

Status: implemented on branch; PR/CI/merge/deployment/live browser verification pending.

User-approved specification: four KPI sections in one horizontal row, with widths 30% Policies MTD, 27% Net Premium MTD, 23% Avg. Net / Policy, 20% Producing Intermediary; headings top-left, primary values centered in each KPI area, policy type counts aligned right within the first section, compact and clear, no horizontal scrollbar.

Implementation: remove `overflow-x-auto` and `min-w-[880px]` from Business Performance; keep `flex-nowrap` with explicit percentage widths and `min-w-0`; use centered KPI value containers and responsive text sizes. For non-commercial dashboards retain two 50% sections.

Scope: `apps/web-portal/app/dashboard-v2/dashboard-view.tsx` BusinessPerformance only. Preserve all business computations, filter, reports link, expanded details and other cards. No SQL, APK, AAB or deployment. Validate with CI and desktop/narrow viewport visual checks before considering complete.
