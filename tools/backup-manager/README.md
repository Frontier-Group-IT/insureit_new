# INSUREIT Local Backup Manager

This toolkit creates independent local backups of the INSUREIT Supabase database and Storage files.

## Safety model

- Backups are read-only against production.
- A backup is written to a `.partial` folder first and is promoted only after checksum verification.
- Secrets are never stored in Git. On Windows they are stored with DPAPI in `%ProgramData%\InsureIT Backup\secrets.clixml`.
- Retention is dry-run by default.
- Restore is plan-only by default.
- Production restore is blocked unless it is explicitly allowed and the operator types `RESTORE PRODUCTION`.
- No scheduled task is installed in Phase 1. First prove one manual backup and one isolated restore.

## Current production source

- Supabase project ref: `ilzhsfqqjyppzzvfscmh`
- Region: `ap-northeast-2`
- Suggested local root: `D:\INSUREIT_BACKUPS`

The project ref and region are not secrets. Database passwords and S3 access keys are secrets and must never be committed.

## Prerequisites on the Windows backup PC

1. Docker Desktop
2. Supabase CLI
3. rclone
4. Git
5. `psql` only when performing a restore

The Supabase CLI database dump path follows Supabase's supported logical-backup pattern: roles, schema and data are exported separately. Storage files are copied through Supabase's S3-compatible endpoint.

## Phase 1: manual backup

From `tools\backup-manager`:

```powershell
Copy-Item .\config.example.json .\config.local.json
notepad .\config.local.json
```

Set only non-secret settings such as `backupRoot`. Then save the credentials securely:

```powershell
.\Set-InsureITBackupSecrets.ps1
```

Run preflight only:

```powershell
.\Backup-InsureIT.ps1 -ConfigPath .\config.local.json -PreflightOnly
```

Run the first real backup:

```powershell
.\Backup-InsureIT.ps1 -ConfigPath .\config.local.json
```

Verify it again independently:

```powershell
.\Verify-InsureITBackup.ps1 -BackupPath "D:\INSUREIT_BACKUPS\INSUREIT-YYYYMMDD-HHmmss"
```

## Backup layout

```text
D:\INSUREIT_BACKUPS\
  INSUREIT-20260815-140000\
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
      ...
    manifest.json
    checksums.json
    backup.log
```

Every future Storage bucket discovered through the S3 endpoint is included automatically.

## Retention

Preview only:

```powershell
.\Invoke-InsureITRetention.ps1 -ConfigPath .\config.local.json
```

Actually delete only backups that are outside the retention policy:

```powershell
.\Invoke-InsureITRetention.ps1 -ConfigPath .\config.local.json -Apply
```

Default policy:

- keep every backup for 7 days
- then keep one backup per day up to 30 days
- then one backup per week up to 12 weeks
- then one backup per month up to 12 months

Only folders with a healthy manifest are eligible for retention deletion.

## Restore

A restore must first be rehearsed into a new/isolated Supabase project.

Plan only:

```powershell
.\Restore-InsureIT.ps1 `
  -BackupPath "D:\INSUREIT_BACKUPS\INSUREIT-YYYYMMDD-HHmmss" `
  -TargetProjectRef "new-project-ref" `
  -TargetRegion "ap-northeast-2"
```

Execute an isolated database + Storage restore:

```powershell
$env:INSUREIT_RESTORE_DB_URL = "postgresql://..."
$env:INSUREIT_RESTORE_S3_ACCESS_KEY_ID = "..."
$env:INSUREIT_RESTORE_S3_SECRET_ACCESS_KEY = "..."

.\Restore-InsureIT.ps1 `
  -BackupPath "D:\INSUREIT_BACKUPS\INSUREIT-YYYYMMDD-HHmmss" `
  -TargetProjectRef "new-project-ref" `
  -TargetRegion "ap-northeast-2" `
  -ExecuteDatabase `
  -ExecuteStorage
```

Clear the temporary environment variables after the restore session.

Production restore is intentionally blocked by default. Do not use `-AllowProductionRestore` until an isolated restore drill has passed and a production recovery has been explicitly approved.

## Phase 2 after the first manual backup passes

1. Reconcile database and Storage counts from the backup.
2. Restore into an isolated Supabase project.
3. Verify customers, vehicles, policies, claims, Auth users and document counts.
4. Measure restore duration and confirm RPO/RTO.
5. Only then install a Windows Task Scheduler job at the approved interval.
6. Add a second local/NAS copy and failure notifications.

## Important limitations

- This toolkit backs up the Supabase database and Storage object contents. Vercel environment variables, Supabase Auth provider settings, custom SMTP settings, DNS, AWS gateway secrets and third-party credentials require separate secure configuration recovery documentation.
- Database dumps include Auth user data, but a different Supabase project can have different JWT/API configuration, so users may need to sign in again after disaster recovery.
- Storage metadata is present in the database dump while file bytes are backed up separately. Always verify both after restore.
- Never commit a database dump, Storage backup, S3 credentials or database connection string to this repository.
