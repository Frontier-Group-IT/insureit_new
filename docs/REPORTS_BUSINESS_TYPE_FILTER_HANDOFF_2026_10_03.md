# Reports Business Type Filter Handoff — 2026-10-03

## Scope

Reports → Business top-level **All Business / Motor / Non Motor / Life / Health** filter.

## Verified root cause

The page loads both the policy-business report and the finance report. The policy-business filter contract already accepted all four business lines, but `apps/web-portal/lib/reports/finance.ts` accepted only `Motor | Non Motor | null`. Therefore `Life` and `Health` were converted to `null` before calling `get_finance_report_v4`, which made finance-backed sections behave like **All Business** while the policy/business side remained correctly filtered.

Affected finance-backed sections on the Business report are the Net Premium / Expected Pay-in / Partner Payout / Retention summary, Insurer table, RM Performance, and Intermediaries Business.

## Production evidence (read-only)

Production database inspection confirmed `public.get_finance_report_v4(...)` delegates to `get_finance_report_v3(...)`, whose base query applies `p_business_line` before summary and grouping calculations using a case-insensitive comparison. No schema change is required.

For the user-reported custom range **2026-07-01 through 2026-09-30**, the existing production RPC returned distinct populations when called with the business filter directly:

- All Business: 953 policies; net premium 34,766,539.67
- Motor: 924 policies; net premium 23,714,574.76
- Non Motor: 24 policies; net premium 1,923,322.91
- Life: 5 policies; net premium 9,128,642.00
- Health: 0 policies; net premium 0

This proves the database already supports all four filter values and the defect is in web filter normalization.

## Implementation

Branch: `fix/report-business-type-global-filter`

PR: #2690

Changes:

1. Expanded `FinanceFilters.businessLine` to `Motor | Non Motor | Life | Health | null`.
2. Expanded the finance `businessLine()` parser to preserve Life and Health rather than collapsing them to `null`.
3. Added `apps/web-portal/scripts/reports-business-type-filter-regression.mjs` to guard the four-value contract and selector → policy report → finance report propagation, including the finance-backed summary/Insurer/RM/Intermediary sections.
4. Added the regression to the canonical `Verify web portal` workflow.

No migration, RLS change, production write, mobile/native change, APK/AAB, or deployment is part of this fix.

## Verification state

- Dedicated Reports business-type regression: passed in `Verify web portal` run #5129 while the workflow was still progressing through the remaining checks.
- Full canonical workflow: pending final completion at the time this handoff was first written.
- PR #2690 remains open and unmerged.
- Production deployment: not performed.

## Continuation rule

Do not merge PR #2690 until its latest canonical `Verify web portal` run is fully green. After any later commit to the PR, treat the previous green run as superseded and verify the new head SHA again.
