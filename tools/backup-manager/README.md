# INSUREIT Local Backup Manager

This toolkit creates independent local backups of the INSUREIT Supabase database and Storage files and maintains a separate Supabase project as a warm disaster-recovery standby.

## Safety model

- Production backup operations are read-only.
- A backup is written to a `.partial` folder first and promoted only after checksum verification.
- Production backup secrets and DR-target secrets are stored separately with Windows DPAPI under `%ProgramData%\InsureIT Backup\`.
- Retention is dry-run by default.
- Restore and DR-refresh tooling are plan-only by default unless an explicit execute switch and confirmation phrase are supplied.
- Production restore is blocked unless it is explicitly allowed.
- The DR Supabase project is a standby target, not an active-active writable database.
- A failed or unverified local backup must never replace the last known-good DR copy.
- A failed or incomplete DR refresh leaves the marker non-healthy and blocks a later unattended refresh until it is inspected.
- The six-hour scheduled refresh must run under the same Windows user that created the DPAPI credential files.

## Current production source

- Supabase project ref: `ilzhsfqqjyppzzvfscmh`
- Region: `ap-northeast-2`
- Canonical web portal: `https://portal.insureit.in`
- Local backup root: `F:\INSUREIT_BACKUPS`

## Current warm-standby DR target

- Supabase project ref: `jzuqlcysyqtyydukveir`
- Project name: `insureit-assistant-preview-pr-249`
- Region: `ap-south-1`
- Mode: `standby`
- RPO objective: refresh after each successful six-hour production backup

The DR project contains a protected `insureit_dr_control.replica_state` marker recording the approved production-to-DR relationship. DR write tooling must validate this marker and must reject the production project as a target.

## Proven baseline

The first full recovery drill used backup `INSUREIT-20260815-205131` and completed successfully.

Verified baseline results:

- production and DR semantic schema catalogs matched exactly: `3116` vs `3116`, `0` differences
- 21 Auth users restored
- 4 Storage buckets restored
- 420 Storage objects restored and byte-checked
- total Storage bytes restored: `163551368`
- 22 custom `storage.objects` RLS policies restored
- `auth.users.on_auth_user_created` restored
- 207 Supabase migration-history rows restored
- DR control marker moved to `baseline_restored`

This proves the manual production-backup-to-DR recovery path. It does not make the system active-active and does not authorize unattended production restore.

## Prerequisites on the Windows backup PC

1. Docker Desktop
2. Supabase CLI
3. rclone
4. Git
5. PostgreSQL `psql` 17

The Supabase CLI logical database backup is split into roles, schema and data. Storage file bytes are copied separately through Supabase's S3-compatible endpoint.

## Credentials

Production unattended credentials:

```powershell
.\Set-InsureITBackupSecrets.ps1
```

Default production credential file:

```text
%ProgramData%\InsureIT Backup\secrets.clixml
```

DR credentials:

```powershell
Copy-Item .\dr.config.example.json .\dr.config.local.json
.\Set-InsureITDRSecrets.ps1
```

Default DR credential file:

```text
%ProgramData%\InsureIT Backup\dr-secrets.clixml
```

Never reuse the production credential file as the DR target credential file.

## Backup format v2

`Backup-InsureIT.ps1` now produces format-v2 backups. V2 keeps the original database and Storage payload and adds the recovery artifacts that were missing from the first v1 backup.

A v2 backup contains:

```text
F:\INSUREIT_BACKUPS\
  INSUREIT-YYYYMMDD-HHmmss\
    database\
      roles.sql
      schema.sql
      data.sql
      history_schema.sql
      history_data.sql
    metadata\
      managed-schema.json
    migrations\
      <exact supabase/migrations snapshot from the recorded Git commit>
    storage\
      <every production Storage bucket and object>
    manifest.json
    checksums.json
    backup.log
```

V2 adds two critical recovery artifacts:

1. `metadata/managed-schema.json` captures the exact production customizations that normal Supabase logical schema dumps do not safely reproduce: all policies on `storage.objects` plus `auth.users.on_auth_user_created`.
2. `migrations/` is an exact Git snapshot of `supabase/migrations` from the same commit recorded in `manifest.json`.

The backup fails instead of being promoted if the managed-schema capture is missing, the migration snapshot is empty, the repository HEAD changes while the backup is running, or any payload checksum fails.

The first independently verified v2 backup is `INSUREIT-20260816-165742`. It verified 650 payload files, 224 migration files, 22 Storage policies, 1 Auth trigger, and 420 Storage objects.

## Manual v2 backup

Preflight:

```powershell
.\Backup-InsureIT.ps1 -ConfigPath .\config.local.json -PreflightOnly
```

A successful v2 preflight reports the project, `Backup format: v2`, and the Git commit that will be snapshotted.

Run a full backup:

```powershell
.\Backup-InsureIT.ps1 -ConfigPath .\config.local.json
```

Then verify independently:

```powershell
.\Verify-InsureITBackup.ps1 -BackupPath "F:\INSUREIT_BACKUPS\INSUREIT-YYYYMMDD-HHmmss"
```

The v2 verifier checks SHA-256 and length for every payload file, exact checksum coverage, the managed-schema artifact, the migration snapshot and Storage folder structure. Legacy v1 backups remain verifiable.

## Managed schema repair

For a controlled DR rebuild, the managed-schema artifact from a v2 backup can be supplied directly to:

```powershell
.\Repair-InsureITDRManagedSchema.ps1 `
  -DefinitionsPath "F:\INSUREIT_BACKUPS\INSUREIT-YYYYMMDD-HHmmss\metadata\managed-schema.json"
```

The script remains plan-only unless `-Execute` is supplied and still hard-blocks production.

## Storage recovery

After database metadata is restored, physical Storage bytes must be restored separately. Because `storage.objects` metadata may already exist before the underlying object bytes, the Storage recovery tool force-uploads local backup bytes and then performs a downloaded byte comparison:

```powershell
.\Restore-InsureITDRStorage.ps1 `
  -BackupPath "F:\INSUREIT_BACKUPS\INSUREIT-YYYYMMDD-HHmmss"
```

Run without `-Execute` first. The execution path targets only the approved DR S3 endpoint.

## Non-destructive warm-standby refresh

`Sync-InsureITDR.ps1` is the guarded refresh path for an already-proven DR baseline. It does **not** reset the Supabase project and it never writes to production.

Plan only:

```powershell
.\Sync-InsureITDR.ps1 `
  -BackupPath "F:\INSUREIT_BACKUPS\INSUREIT-YYYYMMDD-HHmmss"
```

Before any DR write, the script:

- independently verifies the v2 backup again
- validates production and DR credential/project separation
- validates the protected `standby` marker
- rejects an older backup by default
- rejects a DR marker already in `refreshing` or `failed`
- requires exact live production/DR semantic schema parity with `Compare-InsureITDRSchema.ps1 -FailOnDifference`

Manual execution requires:

```powershell
.\Sync-InsureITDR.ps1 `
  -BackupPath "F:\INSUREIT_BACKUPS\INSUREIT-YYYYMMDD-HHmmss" `
  -Execute
```

and the exact interactive confirmation phrase printed by the tool.

The execution path:

1. changes only the DR marker to `refreshing`
2. keeps the existing DR schema and project infrastructure intact
3. starts one DR database transaction and sets `session_replication_role = replica`
4. deletes only rows from tables represented in the verified `data.sql` and migration-history dump
5. replays the exact COPY data from that backup in the same transaction
6. verifies every restored COPY-table row count, Auth-user count, Storage metadata count, policy count and Auth trigger count
7. force-uploads every Storage object, removes stale physical DR objects with exact sync, and performs `rclone check --download`
8. reruns the exact production/DR schema comparator
9. records the new backup ID and sets the DR marker to `healthy` only after all checks pass

If anything fails after refresh starts, the marker is changed to `failed` while the last known-good backup ID remains recorded. A later unattended run is blocked until the failure is inspected.

`-Unattended` exists for the future scheduled job but is deliberately blocked until the marker has first reached `healthy` through one successful manual non-destructive refresh.

## DR refresh design

The approved six-hour warm-standby workflow is:

1. Create a new v2 production backup locally.
2. Independently verify its manifest, checksums, managed schema and migration snapshot.
3. If verification fails, stop and keep the existing DR copy untouched.
4. Confirm exact production/DR schema parity before changing DR data.
5. Refresh DR public/Auth/Storage database data transactionally from that exact backup without doing a destructive project reset.
6. Verify managed-schema and security-object counts remain intact.
7. Force-mirror and byte-check Storage files against the same backup.
8. Reconcile table counts, Auth users, Storage metadata/bytes and schema/security objects.
9. Only after all checks succeed, update the DR control marker with the new backup ID and `healthy` refresh state.
10. Apply local retention only after the backup and DR refresh workflow has completed successfully.

A full Supabase project reset is a bootstrap/recovery operation only. It is not the normal six-hour refresh method.

If production schema changes, the fail-closed comparator stops the refresh before DR is modified. Schema migration of the standby must then be handled deliberately before automatic refresh resumes.

## Backup Vercel site

A separate Vercel project can run the same INSUREIT web application against the DR Supabase project. It must use the DR project's own Supabase URL and DR API/server credentials. Do not copy production Supabase API keys or production database credentials into the standby Vercel project.

Keep the backup site protected and out of normal traffic while the DR project is in `standby`. During failover, first verify the latest DR marker and health checks, then intentionally activate the standby site. A future dedicated hostname can be `dr.portal.insureit.in`.

## Retention

Preview:

```powershell
.\Invoke-InsureITRetention.ps1 -ConfigPath .\config.local.json
```

Apply:

```powershell
.\Invoke-InsureITRetention.ps1 -ConfigPath .\config.local.json -Apply
```

Default local retention:

- every backup for 7 days
- one daily representative up to 30 days
- one weekly representative up to 12 weeks
- one monthly representative up to 12 months

Only folders with a healthy manifest are eligible for retention deletion.

## Important limitations

- Logical database backups do not contain physical Storage file bytes; both metadata and object bytes must be protected and reconciled.
- Auth provider settings, SMTP settings, API keys, Edge Functions, Realtime settings, custom domains/DNS, AWS gateway secrets and third-party credentials are not all recreated by database dumps. Maintain a separate DR configuration checklist for these external settings.
- Custom changes inside Supabase-managed `auth` and `storage` schemas require explicit capture and verification. V2 currently captures the exact managed customizations proven by the INSUREIT recovery drill: `storage.objects` policies and `auth.users.on_auth_user_created`.
- If new custom managed-schema objects are introduced elsewhere, update the v2 capture/restore allowlist before relying on them for disaster recovery.
- A second Supabase project has its own JWT/API credentials. Existing sessions may not survive failover and users may need to sign in again.
- Never commit database dumps, Storage payloads, database passwords, S3 secrets, service-role keys or connection strings to this repository.

## Next controlled milestone

1. Pull the current backup-manager tooling to the Windows backup PC.
2. Run `Sync-InsureITDR.ps1` in plan-only mode against the independently verified v2 backup `INSUREIT-20260816-165742`.
3. Review the exact table/Auth/Storage counts and schema-parity gate.
4. Run one manual `-Execute` non-destructive DR refresh.
5. Reconfirm the DR marker is `healthy` and perform application smoke tests.
6. Only after that proof passes, install the six-hour Windows Task Scheduler job.
7. Then configure and smoke-test the protected standby Vercel project against the DR Supabase project.
