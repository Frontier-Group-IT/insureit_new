# Operations Head – Life: unrestricted Life/Health visibility

Updated user rule (24 October 2026):
- **Read** every Life or Health policy and every Life/Health case, regardless of RM/partner ownership.
- **Read** policies outside Life/Health only if an RM or associated partner is in the active reporting downline of employee 5117 (Gagan Singh).
- **Write, edit, verification/approval** remains limited to authorized downline records. This avoids silently interpreting “show every” as permission to mutate unrelated teams' records.
- Preserve server-side record checks, and do not modify reporting manager or partner assignments merely to equalize counts.

Implemented in policy-access-scope: distinct visible union and downline-only write predicates. Policy and case lists/details, dashboard portfolio and business analytics, and case document viewing use the visible union; edit and approval guards explicitly retain the downline-only predicate.

Expected production baseline from read-only audit: full Life/Health Case Register **17 cases**, 10 awaiting policy and 7 issued, assuming records unchanged.

No database migration or changes to existing employees/profiles are required for this code-only change. Regression suite checks view filters and write isolation.
