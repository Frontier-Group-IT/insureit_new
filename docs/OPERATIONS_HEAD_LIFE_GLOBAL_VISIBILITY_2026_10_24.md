# Operations Head – Life: unrestricted Life/Health visibility

Updated user rule (24 October 2026):
- **Read** every Life or Health policy and every Life/Health case, regardless of RM/partner ownership.
- **Read** policies outside Life/Health only if an RM or associated partner is in the active reporting downline of employee 5117 (Gagan Singh).
- **Write, edit, verification/approval** remains limited to authorized downline records. This avoids silently interpreting “show every” as permission to mutate unrelated teams' records.
- Preserve server-side record checks, and do not modify reporting manager or partner assignments merely to equalize counts.

Implemented in policy-access-scope: distinct visible union and downline-only write predicates. Policy and case lists/details, dashboard portfolio and business analytics, and case document viewing use the visible union; edit and approval guards explicitly retain the downline-only predicate.

Expected production baseline from read-only audit: full Life/Health Case Register **17 cases**, 10 awaiting policy and 7 issued, assuming records unchanged.

No database migration or changes to existing employees/profiles are required for this code-only change. Regression suite checks view filters and write isolation.

## 23 November 2026 — SANKALP DIRECT explicit partner exception

- Confirmed production intermediary `SANKALP DIRECT`, code `PT00071`, ID `d183747f-eeab-483b-adc6-b5c1b5868ccc`, application `e5988aee-0bf7-4528-ad20-79e61359d8ee`.
- The company-direct source has no associate employee/profile, and is therefore absent from the default Life Head downline partner set.
- Allow this one exact master intermediary and application for `operations_head_life` intermediary viewing. Existing Policy Onboarding and Intake source authorization then includes its verified code through the shared scope resolver.
- Preserve Gagan Singh's dynamic hierarchy, existing downline partners, broad Life/Health read-only visibility and downline-only ownership guards. Do not alter intermediary assignment or give other employees/roles the direct-account exception.
- Require a role-authenticated portal check for Partner Register, New Policy Intake, Add Policy (each vertical), record actions and unrelated-partner denial following deployment.
- This change is code-only and does not modify the production database, master partner record, or profile roles.
