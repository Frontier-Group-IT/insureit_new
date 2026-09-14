# Partner Business analytics body handoff — 2026-09-14

Status: **IMPLEMENTED on feature branch; not merged; not deployed**.

Branch: `ui/partner-business-analytics-body`

Scope:
- Redesign only the `/partner/business` analytics body below the existing KPI header strip.
- Keep the existing four KPI header cards, their calculations, labels, and layout unchanged.
- Add Top Customer Contribution and Portfolio Concentration using existing scoped policy/customer data.
- Add renewal premium-at-risk, expired premium exposure, and 7/15/30-day renewal windows derived from existing policy end dates and premiums.
- Enrich Opportunity Snapshot with real premium values from the current scoped portfolio.
- Add a compact Business Activity Funnel using supported policy/customer counts only; no fabricated lead/quote values.
- Compact the Continue Working workspace links using only verified Partner routes.

Data / safety:
- No database migration or schema change.
- No new API/RPC contract.
- No hardcoded mockup business figures.
- Existing Partner scope remains enforced through the current `partner-web` data layer.

Primary file:
- `apps/web-portal/app/partner/business/page.tsx`
