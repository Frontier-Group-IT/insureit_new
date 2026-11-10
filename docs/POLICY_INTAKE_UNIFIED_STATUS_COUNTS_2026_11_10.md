# Policy Intake status count parity — 2026-11-10

## Root cause
Website computes duplicate-policy matches using `loadPolicyIntakeDuplicateMatches` and displays matching, not-completed intakes under Duplicate even if the stored database `status` is `ready_for_review`, `in_review` or `rejected`. Partner API previously counted raw `status` and therefore assigned those same intakes to other tabs. Website's server-rendered snapshot could also remain stale until navigation, while Partner mobile refreshed counts only when the All tab was active without search. These were not page-size defects and must not be “fixed” by editing existing statuses.

## Changes
- Canonical effective-status bucketing `policy-intake-status-buckets.ts` shared between website workspace and Partner API. Derived duplicate takes priority over original status for both tab filters and counts, preserving completed records.
- Partner authenticated API evaluates derived duplicates across the **entire authorized employee/partner dataset before filtering and slicing the requested page**. Responses still return at most the requested page of records (10 in native app); exact status counts and total correspond to same search and status scope.
- Employee visibility of the web page now comes from the identical `getPartnerEmployeeIntakeReadScope` function used by the API. It fails closed on no visibility and does not widen review or scope permissions. Partner, branch, group accounts keep their previous API scope.
- Portal refreshes on focus / tab visibility and while page remains open (once per minute), with a separate explicit Refresh button that preserves filters. Native also refreshes counts in any status and search filter, once per minute while focused, without clearing loaded cards on background polls.
- No SQL migration, deletion or modification of Policy Intake status or OCR records. Existing OCR policy-number matching logic is unchanged.
- Existing Partner pagination and Web Portal regression tests updated to check shared bucketing, scoped duplicate searches and fresh UI.

## Acceptance testing
1. Same employee login, same filters and no search: website and Partner App counts match exactly per bucket after refresh. An organizational reviewer and a hierarchy-scoped RM must be checked independently.
2. Duplicate tab on both surfaces lists matching PIRs with status derived from the same policy-number match and keeps completed rows under Completed.
3. A user with view-only access sees no extra records; another partner or branch account cannot access sibling intakes by direct PIR or search.
4. Search by PIR and insurer, then tab filtering, returns the correct items and tab counts across the full authorized dataset.
5. New intake / review status updated in one surface causes updated counts after manual refresh or within 60s, without hard-refresh; no stale counts after switching filters.
6. Native loads first 10 and subsequent 10 with Load More. No fake records or DB status writes.

## Release constraints
Run both mandatory GitHub CI workflows, then review. If approved for production, deploy Portal API and website first, then Partner production OTA (runtime 0.2.0). No native APK/AAB/IPA.
