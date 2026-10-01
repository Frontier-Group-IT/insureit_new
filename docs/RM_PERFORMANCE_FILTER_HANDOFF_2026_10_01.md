# RM Performance filter refinement — 2026-10-01

Branch: `refine/rm-performance-last-month-calendar-2026-10-01`

Evidence state: **IMPLEMENTED; PR/CI/merge/deployment pending.**

## Scope

- RM Performance keeps **MTD** as the default time period.
- The mistaken **This Month** option is replaced by **Last Month**.
- **Last Month** resolves to the complete previous calendar month and drives the dynamic period summary, finance values, RM Daily Summary, Source Breakdown, and context highlight.
- **Today** remains an independent current-day calculation and is not changed by the selected reporting period.
- **Custom** uses a compact date-range calendar popover instead of separate visible From/To date inputs.
- Calendar range selection is start date then end date; the selected span is highlighted and a valid completed range immediately refreshes the report without an Apply button.
- The context trend now requests the six-month window ending at the selected period end so previous-year December can still appear when Last Month is selected in January.
- RM selection continues to filter immediately and preserves the chosen period/range.

## Safety boundary

No database, migration, schema, RLS, accounting formula, mobile application, APK/AAB, or native-runtime change is part of this refinement.
