# Policy Intake App / Portal Count Parity — 2026-11-10

## Root cause confirmed
The Portal's `PolicyIntakeWorkspace` labels Policy Intakes as **Duplicate** when their OCR policy number matches a registered policy or an earlier Policy Intake. This *effective status* is not written to `policy_intake_requests.status`. The Partner App API counted only the raw stored status, so the same submissions appeared under Action Required / In Review in the app while the portal counted them as Duplicate. The portal's server-loaded snapshot also remained stale while its page stayed open. Finally, the app only refreshed status counts on the All tab with no search.

## One canonical, read-only classification
- Migration `20261110110000_policy_intake_effective_status_parity.sql` creates `public.policy_intake_effective_list`: a read-only `security_invoker` database view.
- It yields the original intake data, `effective_status`, and the existing OCR `policy_intake_search_text` result. Completed intakes remain Completed; noncompleted ones get Duplicate if their normalized OCR policy number already has a registered policy or an earlier intake. No existing records or statuses are changed.
- The view grants SELECT to service_role only. It must be queried exclusively by the authorized server with the same per-user scope, never exposed directly to anon/authenticated clients.
- Both the Operations Portal Policy Intake Queue and the authenticated Partner App mobile list/counts use the same view.
- The Portal now uses `getPartnerEmployeeIntakeReadScope`, matching the app's employee scope. Nonemployee Partner/Branch/Group API scoping stays unchanged.
- The app still returns 10 rows per page; all seven status counts come from exact scoped database queries and refresh on *every* first-page load, including filter/search changes. Count search uses the same OCR search text as page rows.
- The Portal revalidates the server snapshot when the tab becomes active, at a visible-page interval, and on manual reset/refresh.
- Existing portal filtering, review permissions, mutation authorization, source permissions and status workflow remain unchanged.

## Release dependency
**Do not deploy the portal or app before applying the reviewed view migration.** A migration rollback script is included. Production data is not altered, and there is no OTA, native build, database write or deployment from PR creation.

## Acceptance checks
1. Verify migration SQL in a compatible isolated environment; validate effective view counts against existing `loadPolicyIntakeDuplicateMatches` for organization-wide and scoped account datasets.
2. Confirm all seven counts sum to All for the same user's unsearched, unfiltered list, and Portal and app counts match when both use the same identity and filters.
3. Test organization-wide and narrowed employee scopes (e.g. RM) and Partner/Branch/Group logins separately; no scope widening.
4. Confirm Action Required excludes effective duplicates, In Review excludes effective duplicates, Completed remains Completed, and Duplicate contains only effective duplicate matches.
5. Search and status filter must apply server-side to the full authorized set; app still returns 10 records per page and Load More increments by 10.
6. Portal focus/visibility/refresh and app focus/refresh must update counts after authorized status changes.
7. Run required Partner and Web Portal CI before merge; apply migration first, then portal deployment, then Partner production OTA only on explicit release approval.
