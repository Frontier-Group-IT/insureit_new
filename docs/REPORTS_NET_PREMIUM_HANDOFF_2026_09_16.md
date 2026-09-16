# Reports Net Premium Consistency Handoff — 2026-09-16

## User-approved rule

Where a Reports view shows only one policy premium/business amount, prefer **Net Premium**. Keep Gross Premium only when the UI/export deliberately compares Gross and Net side by side. Distinct commercial concepts such as projected insurer pay-in, partner payout, retention, billed amount, claim loss and settlement are not renamed to Net Premium.

## Implementation state

**IMPLEMENTED, NOT APPLIED, NOT MERGED, NOT DEPLOYED** on branch `fix/reports-net-premium-consistency`.

Current scope:

- Reports Overview: headline, Motor/Non-Motor split, production trend, insurer YTD table and upcoming-renewal values are net-premium based.
- Policy Business: already net-first via `get_policy_business_report_v5`; detailed MIS retains Gross and Net when both are intentionally exposed.
- Renewals: UI, register and CSV use net premium; new RPC `get_renewal_report_v4` keeps gross for compatibility but calculates premium-at-risk/buckets/exposure from net premium.
- Distribution: UI uses net premium; new RPC `get_distribution_report_v2` provides both gross and net while single-premium reporting uses net.
- Finance: existing summary remains net-first; policy commercial register and CSV now use net premium. Gross Partner Payout remains unchanged because it is a distinct commercial measure.
- Management Pack: live single-premium business/distribution/renewal values use net. Gross + Net headline comparison is intentionally retained. New frozen snapshots use snapshot version 2. Existing version-1 frozen snapshots preserve their historical legacy premium semantics rather than relabeling old gross-based figures as net.

## Schema/release contract

Migration: `supabase/migrations/20260916113000_reports_net_premium_consistency.sql`

Creates versioned RPCs without replacing the old report RPCs:

- `get_distribution_report_v2`
- `get_renewal_report_v4`
- `get_finance_report_v4`

Dedicated schema workflow: `.github/workflows/apply-reports-net-premium-consistency.yml`.

Production deployment gate: `.github/workflows/deploy-production.yml` maps the migration to that dedicated workflow and must wait for the schema workflow before Vercel deployment.

## Safety state

The migration has **not** been applied manually to production. Do not call the new RPCs live until the approved PR is merged and its dedicated schema workflow has applied and verified the migration. A committed migration is not evidence of production application.

Before merge, require the canonical `Verify web portal` PR workflow to pass for the exact PR head. Do not merge or deploy without explicit user approval.
