# INSUREIT R7 — Protected read-only catalog audit (PROPOSED / NOT DISPATCHED)

This PR prepares a discovery-only GitHub Actions procedure following the bounded Storage R6 upload [#44078744327](https://github.com/Frontier-Group-IT/insureit_new/actions/runs/44078744327). The audit never copies or mutates SQL rows, Storage objects, RLS policies, grants, Auth triggers, Realtime, Edge Functions or secrets.

## Historical identity and scope

| Item | Reviewed value |
| --- | --- |
| Production source | Insureit_Web / ilzhsfqqjyppzzvfscmh |
| Recovery target | INSUREIT_VAPT_ISOLATED / klnodxnmlqbofolxxrsr |
| R4 SQL v2 snapshot | 20261117T041507Z |
| R6 Storage v1 snapshot | 20261116T225734Z |
| Bounded R6 sample | 304 files / 499,999,884 bytes / 8 private buckets |

**R4 and R6 are distinct snapshots.** This workflow compares the current source catalog with the restored isolated target and locks both historical run-identifying timestamps. It does NOT authenticate R2 snapshot contents, prove a latest R2 pointer, or establish consistent point-in-time recovery. Production is live and may drift after this PR.

## Safety controls

1. New workflow has only workflow_dispatch, requires main, exact isolated project confirmation and both historical snapshot identifiers. There is no schedule, deploy/upload step, or write permission beyond GitHub contents: read.
2. The source job uses the existing **insureit-production-backup** protected environment DATABASE_URL, verified against the fixed source host allowlist; all queries are only metadata/aggregate SELECT inside a transaction-scoped REPEATABLE READ, READ ONLY transaction with 10-second statement timeout. No source credential is exported to the target job.
3. The target job uses **insureit-recovery-isolated** secrets; fixed target allowlist, isolated CA, verify-full TLS, READ ONLY transaction and no Storage service-role key. Review protected environment reviewer requirements before manual dispatch.
4. Only fixed aggregate counters and a SHA-256 of sorted public table names (excluding the single reviewed recent source-only table) cross jobs. Never print user identities, customer rows, document paths, SQL policy definitions, passwords, secrets or raw token values.
5. Source drift beyond the known recent policy_intake_ai_processing_queue table, and target bucket/privacy/count/size/owner, grants, RLS or trigger changes, must stop for review. Source Storage object count is observed but not equated to older immutable R2 contents.
6. Zero production or isolated database writes: no R2 mutations, REST/Storage calls, migrations, Data API grants, Auth manipulation or app changes. GitHub PR CI receives no live credentials.

## Known recovery gaps (not corrected here)

- Source 35 Storage RLS policies versus isolated 0; all recovered sample objects currently have no owner_id. A source Storage policy depends on owner_id.
- Missing source auth.users.on_auth_user_created trigger; the target's public.handle_new_user function has already been compared by definition hash.
- 12 active production Edge Functions (8 with verify_jwt=false) versus 0 target. Five production Realtime publication entries versus 0 target.
- Recent source-only public.policy_intake_ai_processing_queue; distinguish live drift from the earlier R4 SQL snapshot before any reconciliation.
- Source has 2 public Storage buckets; target keeps all 8 private. MIME, ownership, service policies and API behavior are not equivalent.
- Production migration history differs; do not execute the 568 historical source migrations over an already restored target.
- Data API public-table privileges in the isolated target remain intentionally denied. Negative-access tests are a separate phase.

## Gate to complete this PR

- Require GitHub **Verify R2 backup code** and **Verify web portal** PR runs and review the synthetic R7 tests. Never merge with failing or pending checks.
- Maintain this as a draft PR: **do not merge, dispatch protected R7, deploy, or change production or the recovery target without later approval**.
- After later approval and merge, the human operator can choose to run the manual protected workflow from main with the two exact historical timestamps, fixed ref and isolation checkbox.
- If R7 fails on drift, treat it as REVIEW and reconcile privately. Do NOT weaken guards or rerun R4/R6 to force PASS.
- Actual R7 policy/permission/trigger/Realtime/Edge Function changes and customer/partner synthetic authentication tests require separate reviewed plans and explicit target-write approval. Full service DR remains NOT CERTIFIED.

Authoritative references: [master DR issue #4264](https://github.com/Frontier-Group-IT/insureit_new/issues/4264), [original handoff](./INSUREIT_SUPABASE_R2_STORAGE_BACKUP_HANDOFF_2026_10_31.md), and [full disaster-recovery certification plan](./INSUREIT_FULL_DISASTER_RECOVERY_CERTIFICATION_PLAN_2026_11_11.md).
