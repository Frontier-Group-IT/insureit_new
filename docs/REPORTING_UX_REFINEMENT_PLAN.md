# INSUREIT Reporting UX Refinement Plan

Date: 2026-08-13
Status: Planning approved; implementation not started
Scope: Web portal Reports workspace only. No reporting formulas, security scope, RPC behavior, or production data semantics should change during the UX refactor unless separately approved.

## 1. Why this refactor is needed

The reporting backend is now functionally mature, but the UI grew report-by-report. Each phase introduced its own tabs, filters, KPI layout, table patterns, export placement, responsive behavior, and terminology. The resulting experience is usable but structurally inconsistent.

The refactor should treat Reports as one product with several report families, not as nine independent pages.

The refactor must preserve:
- existing hierarchy-aware `view_reports` scope;
- Governance restriction to effective `manage_users`;
- existing report calculations and RPCs;
- current export authorization;
- Management Pack snapshot/archive immutability;
- existing source-record drill-through routes;
- current finance billing semantics (Billed only means billing_status = Billed).

## 2. Target information architecture

Reports should be grouped by user job rather than by implementation chronology.

### A. Executive
Purpose: management review and month-end decision support.

- Management Pack
- Month-End Archive

### B. Business
Purpose: production, portfolio and distribution performance.

- Business
- Distribution
- Finance

### C. Portfolio & Service
Purpose: future portfolio risk and service outcomes.

- Renewals
- Claims

### D. Operations & Compliance
Purpose: fleet/document compliance and operational exposure.

- Operations

### E. Controls & Data Quality
Purpose: system control, audit, and remediation.

- Readiness
- Governance (only when effective `manage_users` is available)

Governance must never be displayed as an available destination to unauthorized users.

## 3. New Reports landing page

`/reports` should become the Reports Overview rather than automatically being the Business report.

The landing page should answer three questions immediately:
1. What reporting areas can I access?
2. What requires attention now?
3. Where should I go for month-end review?

Recommended structure:

### Header
- Title: Reports
- No descriptive marketing copy.
- Current scope badge only if factual and concise, e.g. `Organization` or the applicable scoped label.

### Primary management actions
- Management Pack
- Readiness / Exceptions

### Report family cards
Executive
- Management Pack
- Archive

Business
- Business Performance
- Distribution
- Finance

Portfolio & Service
- Renewals
- Claims

Operations & Compliance
- Operations

Controls & Data Quality
- Readiness
- Governance when authorized

Cards should show only factual compact context, not decorative text.

## 4. Route strategy

Do not break existing bookmarked production routes.

Recommended routes:
- `/reports` -> Reports Overview
- `/reports/business` -> Business report
- `/reports/distribution`
- `/reports/finance`
- `/reports/renewals`
- `/reports/claims`
- `/reports/operations`
- `/reports/readiness`
- `/reports/governance`
- `/reports/management-pack`
- `/reports/management-pack/archive`

Compatibility requirement:
- Existing `/reports?...` Business URLs should redirect or be translated safely to `/reports/business?...` so filters/bookmarks are not silently lost.

Do not remove existing export routes during this refactor.

## 5. Shared Reports navigation

Create one server-aware shared navigation component rather than local `ReportTabs()` implementations.

Suggested component:
`components/reports/report-navigation.tsx`

Responsibilities:
- render consistent report-family navigation on every report page;
- hide Governance when unauthorized;
- expose all destinations consistently;
- visually distinguish report-family navigation from filters;
- support mobile overflow without wrapping into a large pill cloud;
- derive active state from pathname;
- use one source of truth for report labels and routes.

### Desktop pattern
Use a compact two-level navigation:

Top family bar:
`Overview | Executive | Business | Portfolio & Service | Operations | Controls`

When a family is active, a secondary row displays its reports.

Example Business family:
`Business Performance | Distribution | Finance`

This avoids nine equal pills across the header.

### Mobile pattern
Use a `Reports` selector/menu plus the current report title. Do not render nine wrapped buttons.

## 6. Global application sidebar changes

The current application sidebar contains stale hash links like `/reports#claims` and `/reports#renewals`.

Replace the Reports section with real routes and job-based groups.

Suggested global sidebar:

Reports
- Overview
- Executive
  - Management Pack
  - Archive
- Business
  - Business Performance
  - Distribution
  - Finance
- Portfolio & Service
  - Renewals
  - Claims
- Operations
  - Compliance & Operations
- Controls
  - Readiness
  - Governance (permission-gated)

The global sidebar should not duplicate every internal filter or analysis subsection.

## 7. Shared report page shell

Create a common report shell so pages no longer rebuild their own header.

Suggested component:
`components/reports/report-page-shell.tsx`

Standard page hierarchy:
1. Reports family navigation
2. Report title + page actions
3. Scope/time/filter bar
4. Primary KPIs
5. Analysis sections
6. Detailed register

Page actions should always occupy the same location.

Supported actions:
- Export
- Print (where applicable)
- Archive / Frozen Pack (Management Pack only)
- destructive/consequential action such as Close Month in a separate action treatment

## 8. Filter architecture

The refactor must distinguish filter types visibly.

### A. Transaction period
Used by:
- Business
- Distribution
- Finance
- Claims
- Governance

Standard shortcuts:
- MTD
- Last 90 days
- YTD
- All time
- Custom

Changing period must preserve every other active filter.

### B. Future risk horizon
Used by:
- Renewals
- Operations

Display as `Horizon`, not as a period control.

Changing horizon must preserve insurer/RM/bucket/etc. filters.

### C. Month selector
Used by Management Pack only.

### D. Domain / exception filter
Used by Readiness.

The same visual component can be shared, but the label and semantics must be explicit.

## 9. Filter-state rules

Critical behavioral rule:

Any single filter change must preserve all unrelated active filters.

Examples:
- Changing Claims from 90d to MTD must retain insurer/status/service mode.
- Changing Renewals horizon from 365 to 90 must retain insurer/RM/intermediary/bucket.
- Pagination must preserve every active filter.
- Export must use exactly the same effective filter set shown on screen.

Provide a visible active-filter summary or filter count when filters are applied.

Reset should clear only the current report's filter state and return to the report's documented default.

## 10. KPI system

Create three visual tiers.

### Tier 1: Primary KPIs
Maximum 4 to 6 per report.
Large values, stable placement.
Only the most decision-relevant metrics belong here.

### Tier 2: Supporting metrics
Compact rows/cards underneath relevant sections.
Do not compete visually with Tier 1.

### Tier 3: Exceptions
Use semantic status treatment only when action is required.
- red: critical/blocking
- amber: warning/due/incomplete
- neutral: informational/attention

Do not use semantic colors merely for decoration.

### Proposed primary KPI examples
Business:
- Policies
- Gross Premium
- Net Premium
- Average Premium
- Active Intermediaries

Distribution:
- Intermediaries
- Producing
- Policies
- Gross Premium
- Open Onboarding

Finance:
- Gross Premium
- Projected PayIn
- Billed
- Partner Payout
- Retention

Move Unbilled, Billing Incomplete, Pending Payout and Missing PayIn into an `Exceptions` strip.

Claims:
- Claims
- Open
- Avg Open Age
- Estimated Loss
- Settlement

Move document exceptions into an exception strip.

Renewals:
- Upcoming
- Due 30d
- Due 90d
- Expired
- Premium at Risk

Operations:
- Vehicles
- Missing Compliance
- Expired Documents
- Due Documents
- AuthBridge Unverified

Readiness:
- Exception Records
- Critical
- Workflow Backlog
- Vehicles with Gaps
- Policy/Finance Issues
- Document Issues

## 11. Typography and density

Current 8-10px report typography is too compressed.

Target minimums:
- page title: 26-30px
- section title: 14-16px
- table header: 10-11px
- table body: 11-12px
- field label: 9.5-10px
- badges/status: 9-10px
- supporting metadata: 9.5-10px

Keep reports compact, but readability takes priority over fitting additional columns on one screen.

Use tabular numerals for financial/count columns consistently.

## 12. Table/register pattern

Create a shared report table pattern.

Desktop:
- sticky header when register is long;
- consistent row height;
- numeric columns right-aligned;
- clear primary/secondary text hierarchy;
- optional horizontal scroll only when unavoidable.

Tablet/mobile:
- do not rely on a 1200-1450px table alone;
- use a compact record-card representation similar to Readiness;
- show the most important 4-6 fields first;
- secondary details can expand or wrap;
- action should use explicit `Open` text/icon rather than icon-only controls.

Standard action label:
`Open`

Avoid standalone external-link icons as the only affordance.

## 13. Export pattern

Every exportable report should expose Export in the report header action area.

Do not move Export between register header and page header depending on report.

If a report has no export yet:
- Distribution: add scoped export only if the existing backend data can be exported safely without widening scope.
- Governance: export should remain omitted unless there is an explicit business need because the content is access-sensitive.

The UI must never imply export availability when the user does not have authorization.

## 14. Status and terminology standardization

Canonical user-facing terminology:
- `Intermediary` = generic umbrella term for Partner / POSP / MISP.
- Use `Partner` only when the record is specifically Partner type.
- `Relationship Manager` in headers/filters; `RM` allowed in dense table columns after the concept is established.
- `PayIn` spelling should be consistent across all finance/report surfaces.
- `Billing details incomplete` should use one exact user-facing label.

Create shared label helpers for stored enums/statuses.

Do not display raw snake_case enum values.

## 15. RM identity standardization

The UI currently presents one RM dimension while loaders use different identities (employee ID in some places, name/string in others).

Target:
- canonical filter value should be employee UUID wherever the schema supports it;
- display text should be employee name;
- compatibility translation can remain server-side for older RPCs during the refactor;
- avoid user-visible differences between report RM lists.

This should be treated carefully because it can affect report filtering semantics. It should be implemented separately from pure visual changes and regression-tested.

## 16. Empty, loading and error states

Standard empty-state taxonomy:

`No records for these filters`
- data exists in the report family but current filters return none.

`No records in your accessible portfolio`
- hierarchy scope is valid but contains no relevant rows.

`Required data has not been entered yet`
- used only when the backend can confidently distinguish missing source data.

`Reporting service unavailable`
- technical loader/RPC failure.

Every report should use the same error boundary/banner treatment.

Do not show zero KPI values after a loader failure as though they were valid business values without also displaying the error state prominently.

## 17. Management Pack workflow refinement

Management Pack is not an ordinary analytical report and should visually sit under Executive.

Header actions:
- Export
- Print
- Archive

Month state/actions:
- Live Month
- Frozen Snapshot

`Close Month` must be treated as a consequential action:
1. click Close Month;
2. confirmation modal shows month and scope;
3. explicitly states snapshot is immutable;
4. user confirms `Freeze Month`;
5. success state links to frozen pack.

Do not make the confirmation text verbose, but make the consequence unmistakable.

## 18. Readiness workflow refinement

Readiness is an exception-resolution workspace, not a normal report.

Keep it under `Controls & Data Quality`.

Primary workflow:
1. choose domain/severity;
2. inspect exception;
3. Open source record;
4. correct source data;
5. return to Readiness;
6. issue disappears automatically when source data is corrected.

Future enhancement after UI refactor:
- optional `Return to Readiness` context when opening a source record;
- severity and domain query persistence;
- possible owner/assignment only if a canonical responsibility model is introduced. Do not invent ownership now.

## 19. Governance workflow refinement

Governance belongs under Controls and is permission-gated.

Do not expose Governance in:
- global Reports navigation;
- Reports landing cards;
- internal Reports navigation;
unless effective `manage_users` is true.

Keep raw audit payload/IP/user-agent hidden.

Governance should visually use the same report shell but can remain read-only and non-exportable initially.

## 20. Recommended implementation phases

### Phase R1 — Navigation foundation
No data/backend changes.
- add central report route catalogue;
- add shared Reports navigation;
- replace stale global sidebar hash links with real routes;
- add `/reports` overview;
- move Business UI to `/reports/business` with compatibility handling for old `/reports` Business query URLs;
- permission-gate Governance consistently.

### Phase R2 — Shared page shell and filters
No calculation changes.
- shared ReportPageShell;
- shared action area;
- shared filter components;
- preserve unrelated filters when period/horizon changes;
- standardized Reset behavior;
- standardized loading/error/empty states.

### Phase R3 — Visual system
No calculation changes.
- typography normalization;
- KPI tiers;
- exception colors;
- section headers;
- status badges;
- terminology normalization.

### Phase R4 — Registers and responsive behavior
No calculation changes.
- shared table/register primitives;
- mobile record cards;
- explicit Open actions;
- consistent pagination;
- sticky table headers where useful.

### Phase R5 — Management Pack and Readiness workflow polish
- Close Month confirmation flow;
- Live/Frozen state clarity;
- archive navigation refinement;
- Readiness return-context and filter persistence.

### Phase R6 — Dimension consistency
Potential semantic/backend compatibility work.
- canonical RM identity;
- ensure insurer/intermediary filters behave identically across reports;
- add regression coverage for cross-report filter dimensions.

Do not combine R6 blindly with visual refactoring because it can change result sets.

## 21. Acceptance criteria

The refactor is complete only when:
- every report uses one navigation source of truth;
- every report destination is reachable from every report page when authorized;
- global sidebar uses real report routes, not stale anchors;
- Governance never appears to unauthorized users;
- period/horizon changes preserve unrelated filters;
- export is in one predictable location;
- table/body typography is readable without browser zoom;
- mobile does not depend on 1200px+ tables;
- primary KPIs are limited and semantically meaningful;
- exception metrics use consistent semantic treatment;
- all source-record actions say `Open` or an equally explicit label;
- empty/error states have consistent meanings;
- Management Pack close is confirmed before immutable snapshot creation;
- existing report calculations and security scopes remain unchanged through R1-R5.

## 22. Recommended immediate next action

Start with Phase R1 only.

R1 solves the highest-risk UX defects with the smallest functional blast radius:
- one Reports navigation source of truth;
- correct sidebar routes;
- real Reports overview;
- consistent destination visibility;
- Business moved out of the landing route without breaking old links.

Do not redesign all report content in the same change. Complete and verify R1 first, then move to the shared shell/filter phase.
