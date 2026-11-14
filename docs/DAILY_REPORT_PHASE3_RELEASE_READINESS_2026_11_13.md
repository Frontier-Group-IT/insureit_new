# Daily Report — Phase 3 release-readiness and non-destructive QA

Status: branch/PR only. Successful CI is NOT authenticated production UI acceptance.

## Dependency order
1. Phase 1 PR #4392: read-only Daily Report and sidebar.
2. Phase 2 PR #4395: stacked on Phase 1; adds privacy-safe nonblocking workflow audits.
3. Phase 3: stacked on Phase 2; adds authorization matrix tests and this release gate.
4. No merge or release without explicit approval; preserve dependency order and rerun workflows on updated head.

## Read-only production observations (13 Nov 2026)
- Last 30 days: policies 1,040 created / 1,040 attributed; intakes 888 / 888; Life/Health cases 7 / 7.
- Last 30 days: 2,822 audit events / 2,779 with an actor ID.
- These are source counts, not a deduplicated Daily Report total.
- The audit_logs table lacks an index for actor_id plus created_at; read-only EXPLAIN shows a sequential scan. No schema change was made. Evaluate an additive index only with separate approval and telemetry.

## Authenticated read-only acceptance matrix (manual, not yet performed)
| Account | Self | All | Expected boundary |
|---|---|---|---|
| Individual with view_reports | Own events | Own events | Peer/manager records never visible |
| Manager with hierarchical view_reports | Own events | Own + reporting descendants | Exclude unrelated teams |
| Authorized organization-wide role | Own events | Organization records | Must have explicit org scope |
| User lacking view_reports | Access denied | Access denied | Direct URL also denied |
| Unlinked employee profile | Own events | Own unless explicit org scope | Never infer broad permissions |

Check one-day Asia/Kolkata midnight boundaries, date/employee/type filters, 30-row pages, missing-actor exclusions, audit versus record-history labels, human-readable references and empty/error states. Check URL parameter tampering. No role impersonation or fabricated user records.

## Data coverage
- Existing policy/customer/vehicle audit events are not complete for all historical flows.
- Intake and case creation/finalization use attributable record timestamps, not invented audit records.
- Phase 2 writes review, attention, rejection, intake-response, case-edit and remark audit entries after confirmed successful operations.
- Raw remarks, rejection reasons, OCR contents and customer PII are not copied to the new audit helper.
- No dummy policy/customer/vehicle records may be created in production as QA without separate explicit approval.

## Release and performance gate
- Run Verify web portal on current PR head, including typecheck, lint and production build.
- Retain one-day IST window, bounded per-source DB queries and 30-item page; no unrestricted browser fetching.
- Observe production read-only query latency/CPU with permission-safe sessions. Audit actor/date index can be reviewed separately if measured load warrants it.
- Deployment targets must be verified (Vercel/Cloudflare); never equate GitHub merge with website deployment.
- User approval required for every merge, migration, production deploy or release.
- After an approved deploy, verify /reports/daily with at least individual, manager and administrator read-only sessions and check operational pages are unaffected.

## Rollback
- Reader/sidebar: redeploy previous approved frontend build.
- Phase 2 instrumentation: revert approved audit hooks or redeploy previous build; historical audit records should not be deleted.

## Known blockers
- No staging database or branch deployment is available for authenticated workflow testing.
- Manual hierarchy-role UI verification remains outstanding.
- Audit performance index is absent; do not change the production schema as part of this phase.
- Partner/mobile and other operational code paths require separate future coverage audits.

## Phase 4 completeness check (13 Nov 2026)

- Read-only 30-day samples show separate busiest days of 313 audit events, 127 policy creations and 113 intake creations. These maxima may have occurred on different dates; they must not be added into an observed report count.
- The previous 15-page ceiling is replaced with 40 pages of 30 items, retaining bounded per-source reads (up to 1,230 requested per source on the final page). Beyond 40 pages, show explicit truncation messaging rather than claim there are no more events.
- Audit policy-related tables now enter the Policy filter, while Policy and Claim subcategories are excluded from Other, with a regression test.
- Authenticated user, manager and organization UI acceptance remains necessary after an approved release; no preview environment is available.
- The missing audit actor/time index is a separate optimization recommendation. No SQL, production write, merge or deployment was performed.
