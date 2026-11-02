# Policy Intake zero-list diagnostic — 2026-11-02

## Report
Anju (`super_admin`) sees zero Policy Intakes, while Jatin Kumar Buwaniwala (`super_admin`) can see intakes.

## Read-only production findings
- Insureit_Web Supabase project `ilzhsfqqjyppzzvfscmh`: 744 policy_intake_requests (479 completed, 204 ready_for_review, 36 in_review, 25 rejected).
- Both profiles are active super_admin; Anju has explicit organization-wide view/review/create/finalize capabilities, and Jatin has organization-wide review/finalize. No identified permission denial explains the symptom.
- Current page uses createSupabaseAdminClient and has organization-wide list scope for super_admin; no per-user condition should exclude Anju.
- Latest Vercel deployment was ready (commit db8c7e9); recent logs show unrelated network errors, chunk-load error, and a stale Server Action on a Policy Intake detail page. None is correlated to Anju's specific request.
- Prior PR #3887 and its revert PR #3889 exist; do not assume prior safeguard resolved the issue.

## This branch
- Adds an independent read-only count on *unexpected zero* for organization-wide viewers.
- Logs authenticated internal profile ID, role, query scope and safe error code; no tokens or customer data.
- If zero rows conflict with a positive total, or independent count fails, shows a temporary-unavailable message instead of misleading zero counts.
- Logs duplicate-check failure (without exposing sensitive data).
- Does NOT modify RLS, roles, filters, intakes, migrations, mobile builds or production.

## Still required before claiming fix
1. Run GitHub CI and review diffs.
2. Verify against a real Anju session and a Jatin session. Capture Vercel server log for each request; check profile ID/role, list result, count diagnostics, deployment SHA.
3. If Anju still sees zero, compare session authentication, browser reload, deployed connection/config and server errors. Do not widen non-admin visibility.
4. Verify statuses and counts; ensure unknown query errors show unavailable rather than an empty queue.
5. Merge/deploy only with explicit approval.
