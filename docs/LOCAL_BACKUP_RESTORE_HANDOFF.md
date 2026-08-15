# INSUREIT Local Backup and Restore Handoff

> **Created:** 2026-08-15 (IST)
>
> Never store database passwords, S3 credentials, API keys, private keys, customer documents, database dumps or other backup payloads in Git.

## Status

**LOCAL BACKUP PROVEN / DR STANDBY PREPARED / FULL DR REFRESH NOT YET PROVEN**

The local backup toolkit lives in:

```text
tools/backup-manager/
```

A real production backup has completed and passed independent checksum verification. The designated second Supabase project has now been marked as an INSUREIT warm-standby DR target, but the first full database + Auth + Storage synchronization and failover web test are still pending. No Windows scheduled task is enabled yet.

## Production source

```text
Supabase project ref: ilzhsfqqjyppzzvfscmh
Region: ap-northeast-2
Canonical web portal: https://portal.insureit.in
```

## Proven local backup

First real backup:

```text
Backup ID: INSUREIT-20260815-205131
Path: F:\INSUREIT_BACKUPS\INSUREIT-20260815-205131
Payload files verified: 425
Storage objects: 420
Verified payload size: 158.91 MB
```

Storage object counts at backup time:

```text
claim-documents:        21
customer-documents:    390
posp-documents:          9
support-ticket-files:    0
Total:                  420
```

The independent verifier passed. This proves the local files and checksum inventory; it does not yet prove restoration.

## Warm-standby DR target

Approved target:

```text
Supabase project ref: jzuqlcysyqtyydukveir
Project name: insureit-assistant-preview-pr-249
Region: ap-south-1
Mode: standby
Target RPO: up to 6 hours after automation is enabled
```

The project is intentionally in a different region from production.

A protected DR control schema/table has been created on this target:

```text
insureit_dr_control.replica_state
```

The marker records:

```text
source_project_ref = ilzhsfqqjyppzzvfscmh
target_project_ref = jzuqlcysyqtyydukveir
mode               = standby
rpo_hours          = 6
```

Future DR synchronization tooling must validate this marker and must hard-block the production project before doing anything destructive.

## DR architecture

The desired steady state is a warm standby rather than active-active replication:

1. Every six hours create a new local production backup.
2. Independently verify the backup manifest and SHA-256 inventory.
3. If verification fails, stop immediately and leave the previous DR copy unchanged.
4. Refresh the DR database/Auth data from the exact verified backup using guarded transactional logic.
5. Mirror every Storage file byte to the DR Supabase S3 endpoint.
6. Reconcile key business data, Auth users, Storage counts and important RLS/functions/triggers.
7. Only after reconciliation succeeds mark the DR control row healthy with the backup ID/time.
8. Keep a separate Vercel deployment pointed only at the DR Supabase project and protected from normal user traffic while the DR mode is `standby`.
9. During a real incident, verify DR health first, then intentionally activate the backup web site.

The DR database must not accept normal application writes while it is being maintained as a standby; otherwise it would diverge from production and the next refresh could overwrite those writes.

## Backup set

Each local backup contains:

1. Supabase logical database dump:
   - `roles.sql`
   - `schema.sql`
   - `data.sql`
2. Supabase migration history:
   - `history_schema.sql`
   - `history_data.sql`
3. Every Supabase Storage bucket copied locally through the S3-compatible endpoint.
4. `manifest.json`
5. `checksums.json`
6. `backup.log`

Backups are written under `_inprogress/<backup>.partial` and promoted only after checksum verification.

## Credential separation

Production source credentials:

```text
%ProgramData%\InsureIT Backup\secrets.clixml
```

DR target credentials:

```text
%ProgramData%\InsureIT Backup\dr-secrets.clixml
```

Both are Windows DPAPI files and must be created/run under the same Windows account used by the future Task Scheduler job.

Production and DR credentials must never be mixed.

New DR helper files:

```text
tools/backup-manager/dr.config.example.json
tools/backup-manager/Set-InsureITDRSecrets.ps1
tools/backup-manager/Test-InsureITDR.ps1
```

`dr.config.local.json` is Git-ignored.

## Current target observations

Before the first DR overwrite, the target contained an existing INSUREIT-like schema from preview work, one Auth user, three empty Storage buckets and existing custom Storage RLS policies. Because it is not a blank Supabase project, a blind generic restore over the top is not acceptable as the scheduled DR mechanism.

The target currently needs the production Storage bucket set to be reconciled; in particular the production backup includes `posp-documents`.

## Restore/synchronization rule

- `Restore-InsureIT.ps1` remains plan-only by default.
- Production restore remains blocked unless explicitly allowed and manually confirmed with `RESTORE PRODUCTION`.
- The generic restore script is not yet the final scheduled warm-standby synchronizer because it does not clean/reconcile a non-empty target.
- The scheduled DR refresh must be guarded by the DR control marker, backup verification and target-ref checks.
- Database refresh must be transactional where practical so a database failure cannot leave a half-imported state.
- Storage bytes and database Storage metadata must both be verified.
- Custom changes to Supabase-managed `auth` and `storage` schemas must be validated separately because ordinary logical schema dumps treat these schemas specially.
- Do not call DR fully proven until a complete synchronization and application-level failover test has passed.

## Backup Vercel site

A separate Vercel project may run the same INSUREIT application against the DR Supabase target. It must use the DR project's own URL and API credentials, not production Supabase credentials.

Recommended operating mode:

```text
Normal state: backup Vercel deployment exists but is protected/standby.
Incident:     confirm last DR refresh is healthy, then activate backup site.
Recovery:     avoid dual-writes; choose one active backend until production is reconciled.
```

A future convenience hostname can be something like:

```text
dr.portal.insureit.in
```

No DNS or Vercel production change is required for the current DR preparation step.

## Retention rule

Default local retention:

```text
All 6-hour backups: 7 days
Daily representative: 30 days
Weekly representative: 12 weeks
Monthly representative: 12 months
```

Retention is dry-run by default and only considers backups with a healthy manifest.

## Immediate next safe steps

1. Generate DR-target Storage S3 credentials in `jzuqlcysyqtyydukveir`.
2. Save the DR database + S3 credentials locally with `Set-InsureITDRSecrets.ps1`; never paste secrets into chat.
3. Copy `dr.config.example.json` to the Git-ignored `dr.config.local.json`.
4. Run `Test-InsureITDR.ps1` against `INSUREIT-20260815-205131`; this is read-only.
5. Harden and run the first controlled full DR synchronization.
6. Reconcile business-table counts, 21 Auth users expected at the backup point, all four Storage bucket names and 420 Storage objects.
7. Verify RLS/functions/triggers, especially custom `auth`/`storage` changes.
8. Connect a separate Vercel project to the DR Supabase project and test login/read/write behavior while isolated from production users.
9. Measure refresh/failover duration and record RPO/RTO.
10. Only after those checks pass install the six-hour Windows Task Scheduler job and failure notification path.
