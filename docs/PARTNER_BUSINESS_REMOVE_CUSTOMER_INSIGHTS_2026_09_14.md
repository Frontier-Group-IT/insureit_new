# Partner Business customer-insight removal — 2026-09-14

Status: **IMPLEMENTED on feature branch; not merged; not deployed**.

Branch: `ui/partner-business-remove-customer-insights`

Scope:
- Completely remove the **Top Customer Contribution** section from `/partner/business`.
- Completely remove the **Customer Value & Portfolio Quality** section.
- Completely remove the **Opportunity Snapshot** section.
- Preserve the existing KPI header strip and its calculations.
- Preserve Top Insurer Contribution, New vs Renewal Premium Trend, Business Mix, Renewal Risk & Lost Business, Business Activity Funnel, and Workspaces.
- Reflow the remaining cards so the removed sections do not leave empty dashboard columns.

Data / safety:
- No database/schema/RPC/API changes.
- No change to Partner commercial scope.
- Removed customer/opportunity-only calculations and render helpers that are no longer needed.
