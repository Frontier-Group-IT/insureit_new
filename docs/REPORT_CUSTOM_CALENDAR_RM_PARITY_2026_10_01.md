# Report Custom Calendar — RM Performance Parity (2026-10-01)

## Scope

Branch: `fix/reports-custom-calendar-rm-parity-v2-2026-10-01`

This change standardizes the report Custom date-range interaction to the existing RM Performance pattern without changing report calculations, database queries, schema, RLS, permissions, mobile apps, APK/AAB behavior, or export contracts.

## Implemented behavior

- Reports Overview (`/reports`): selecting **Custom** now switches the URL to `period=custom`, keeps the current period range as the starting range, renders the same visible compact date-range control used by RM Performance, and opens the calendar immediately. The old hidden-trigger integration and Overview-only future-date restriction are removed.
- Shared `ReportQueryShortcuts`: when a report period is **Custom**, it renders the shared `ReportDateRangePicker`. First click starts the range, second click completes it, the completed range updates `period=custom&from=...&to=...`, and report pagination parameters are cleared.
- Legacy From/To native date controls under report forms are visually suppressed where `ReportQueryShortcuts` is present so users interact with one calendar instead of two date inputs. Their underlying values remain in the form for compatibility with existing filter-submit behavior.
- Business (`/reports/business`), Claims (`/reports/claims`) and Governance (`/reports/governance`) receive the standardized calendar through `ReportQueryShortcuts` without altering their backend loaders or other filter semantics.
- Accounts (`/reports/accounts`) now uses `ReportQueryShortcuts`, so it receives the same Custom option/calendar while preserving insurer filtering and the existing submit contract.
- Portfolio, Operations, Readiness/Data Quality and Management Pack are intentionally unchanged because they use horizon, domain, or month semantics rather than a Custom date range.

## Evidence state

**IMPLEMENTED on branch only.** No PR, CI verification, merge, deployment, or production runtime verification has been completed yet.
