# Life / Health pending-count sync — 2026-10-03

## Issue

The Life & Health Case Register showed 12 pending cases while the Policy Register header showed Proposal Pending 7.

## Root cause

The Case Register counted `life_health_cases` rows without `final_policy_id`, while the Policy Register's Proposal Pending number was incorrectly derived from Policy Intake queues (`Action Required + In Review`). The displayed 7 therefore matched Policy Intake review state rather than proposal/case state.

## Implementation

Branch: `fix/sync-life-health-pending-count`

- Added shared `loadLifeHealthCaseSummary()` using exact database counts from `life_health_cases`.
- Pending = `final_policy_id IS NULL`.
- Issued = `final_policy_id IS NOT NULL`.
- Case Register tabs use the shared exact counts, with the existing loaded-row calculation only as a fallback if the summary query fails.
- Policy Register Proposal Pending uses the same shared pending count.
- Policy Intake Action Required and In Review remain independently calculated and unchanged.
- No schema, migration, RLS, permissions, policy workflow, mobile app, Partner app, APK/AAB, or native-runtime change.

## Evidence state

IMPLEMENTED on branch; PR/CI/merge/deployment pending.
