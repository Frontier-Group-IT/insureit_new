# INSUREIT Local Backup Manager

This toolkit creates independent local backups of the INSUREIT Supabase database and Storage files and prepares a separate Supabase project as a warm disaster-recovery standby.

## Safety model

- Backups are read-only against production.
- A backup is written to a `.partial` folder first and is promoted only after checksum verification.
- Production backup secrets and DR-target secrets are stored separately with Windows DPAPI under `%ProgramData%\InsureIT Backup\`.
- Retention is dry-run by default.
- Restore is plan-only by default.
- Production restore is blocked unless it is explicitly allowed and the operator types `RESTORE PRODUCTION`.
- The DR Supabase project is intentionally a standby target, not an active-active writable database.
- A failed or unverified local backup must never replace the last known-good DR copy.
- No Windows scheduled task is enabled until the first DR synchronization and reconciliation have passed.

## Current production source

- Supabase project ref: `ilzhsfqqjyppzzvfscmh`
- Region: `ap-northeast-2`
- Canonical web portal: `https://portal.insureit.in`
- Current local backup root: `F:\INSUREIT_BACKUPS`

## Current warm-standby DR target

- Supabase project ref: `jzuqlcysyqtyydukveir`
- Project name: `insureit-assistant-preview-pr-249`
- Region: `ap-south-1`
- Intended state: `standby`
- Intended refresh objective: after each successful 6-hour local backup

The target contains a protected `insureit_dr_control.replica_state` marker that records the approved production-to-DR relationship. DR tooling must validate this marker and reject the production project before any future destructive synchronization is allowed.

This cross-region standby is intended to provide a second runnable Supabase backend if the production project becomes unavailable. It is a warm standby with a target RPO of up to six hours, not synchronous replication.

## Prerequisites on the Windows backup PC

1. Docker Desktop
2. Supabase CLI
3. rclone
4. Git
5. PostgreSQL `psql` 17

The Supabase CLI database dump path follows Supabase's supported logical-backup pattern: roles, schema and data are exported separately. Storage file bytes are copied separately through Supabase's S3-compatible endpoint.

## Production backup credentials

Production unattended credentials are saved with:

```powershell
.\Set-InsureITBackupSecrets.ps1
```

Default DPAPI file:

```text
%ProgramData%\InsureIT Backup\secrets.clixml
```

## DR standby credentials

Create a local DR config:

```powershell
Copy-Item .\dr.config.example.json .\dr.config.local.json
```

Store the DR project's database and S3 credentials separately:

```powershell
.\Set-InsureITDRSecrets.ps1
```

Default DPAPI file:

```text
%ProgramData%\InsureIT Backup\dr-secrets.clixml
```

Never reuse the production credential file as the DR target credential file.

## Manual backup

Run preflight:

```powershell
.\Backup-InsureIT.ps1 -ConfigPath .\config.local.json -PreflightOnly
```

Run a full backup:

```powershell
.\Backup-InsureIT.ps1 -ConfigPath .\config.local.json
```

Verify it independently:

```powershell
.\Verify-InsureITBackup.ps1 -BackupPath "F:\INSUREIT_BACKUPS\INSUREIT-YYYYMMDD-HHmmss"
```

The first real backup, `INSUREIT-20260815-205131`, completed successfully and later passed independent verification: 425 payload files, 420 Storage objects, and 158.91 MB verified. This proves the backup payload and checksums, but does not by itself prove disaster recovery.

## Backup layout

```text
F:\INSUREIT_BACKUPS\
  INSUREIT-20260815-205131\
    database\
      roles.sql
      schema.sql
      data.sql
      history_schema.sql
      history_data.sql
    storage\
      claim-documents\
      customer-documents\
      posp-documents\
      support-ticket-files\
    manifest.json
    checksums.json
    backup.log
```

Every future Storage bucket discovered through the production S3 endpoint is included automatically.

## Read-only DR preflight

After `dr.config.local.json` and `dr-secrets.clixml` exist, validate the backup and the DR target without changing DR data:

```powershell
.\Test-InsureITDR.ps1 `
  -BackupPath "F:\INSUREIT_BACKUPS\INSUREIT-20260815-205131"
```

The preflight checks:

- backup checksum verification
- source and target project refs
- hard block against targeting production
- the protected DR control marker and `standby` mode
- DR database connectivity
- DR S3 connectivity
- which Storage bucket names are still missing on the target

## DR refresh design

The approved end-state for the six-hour job is:

1. Create a new production backup locally.
2. Independently verify checksums and manifest.
3. If verification fails, stop and keep the existing DR copy untouched.
4. Refresh the DR database/Auth data from that exact healthy backup using guarded, transactional restore logic.
5. Mirror Storage file bytes to the DR project's S3 endpoint.
6. Reconcile key business data, Auth-user count, Storage object counts and important schema/security objects.
7. Only after reconciliation succeeds, mark the DR control row healthy with the backup ID and completion time.
8. Keep the backup Vercel deployment in standby/protected mode until failover is intentionally activated.

The DR refresh implementation must not use a blind restore over a non-empty target. The current generic `Restore-InsureIT.ps1` remains a guarded restore tool, not the final scheduled warm-standby synchronizer.

## Backup Vercel site

A separate Vercel project can run the same INSUREIT web application against the DR Supabase project. It must use the DR project's own:

- Supabase URL
- publishable/anon key as applicable
- server-side secret/service-role key as applicable
- any required Auth/provider configuration

Do not copy production database passwords or production Supabase API keys into the backup Vercel project.

Keep the backup site protected or otherwise out of normal user traffic while the DR project is in `standby`. During a real failover, first confirm the latest DR health marker and reconciliation state, then activate the backup web site. A simple future option is a dedicated hostname such as `dr.portal.insureit.in` pointing to the backup Vercel project.

## Retention

Preview only:

```powershell
.\Invoke-InsureITRetention.ps1 -ConfigPath .\config.local.json
```

Apply retention:

```powershell
.\Invoke-InsureITRetention.ps1 -ConfigPath .\config.local.json -Apply
```

Default local retention:

- every backup for 7 days
- one daily representative up to 30 days
- one weekly representative up to 12 weeks
- one monthly representative up to 12 months

Only folders with a healthy manifest are eligible for retention deletion.

## Generic restore

Plan only:

```powershell
.\Restore-InsureIT.ps1 `
  -BackupPath "F:\INSUREIT_BACKUPS\INSUREIT-YYYYMMDD-HHmmss" `
  -TargetProjectRef "isolated-project-ref" `
  -TargetRegion "target-region"
```

Production restore is intentionally blocked by default. Do not use `-AllowProductionRestore` until an isolated restore drill has passed and production recovery has been explicitly approved.

## Remaining DR proof before scheduling

1. Save DR database + S3 credentials with `Set-InsureITDRSecrets.ps1`.
2. Run `Test-InsureITDR.ps1` successfully.
3. Perform the first controlled full synchronization of `INSUREIT-20260815-205131` into the DR target.
4. Verify customers, vehicles, policies, claims, Auth users, database functions/triggers/RLS and every Storage bucket/object count.
5. Verify the backup Vercel site can log in and operate against DR without touching production.
6. Measure restore/refresh duration and record RPO/RTO.
7. Only then install the six-hour Windows Task Scheduler job.
8. Add failure notifications and eventually a second physical/NAS copy of the local backup set.

## Important limitations

- Supabase database backups do not contain Storage file bytes; database metadata and actual Storage objects must both be protected and reconciled.
- Supabase Auth provider settings, SMTP settings, API keys, Edge Functions, Realtime settings, custom domains/DNS, AWS gateway secrets and third-party credentials are not all recreated by a logical database dump. They need a separate DR configuration checklist.
- Custom changes inside Supabase-managed `auth` and `storage` schemas require explicit verification because normal logical schema dumps intentionally treat those managed schemas specially.
- A second Supabase project has its own JWT/API credentials. Existing sessions may not survive failover and users may need to sign in again.
- Never commit database dumps, Storage payloads, database passwords, S3 secrets, service-role keys or connection strings to this repository.
