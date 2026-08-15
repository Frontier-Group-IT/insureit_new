# INSUREIT Local Backup and Restore Handoff

> **Created:** 2026-08-15 (IST)
>
> Never store database passwords, S3 credentials, API keys, private keys, customer documents, database dumps or other backup payloads in Git.

## Status

**IMPLEMENTED / NOT YET OPERATIONALLY VERIFIED**

Phase 1 local backup tooling is implemented in:

```text
tools/backup-manager/
```

No Windows scheduled task has been installed yet. No claim is made that a local backup or restore has succeeded until it is run on the designated Windows backup PC and an isolated restore drill passes.

## Production source

```text
Supabase project ref: ilzhsfqqjyppzzvfscmh
Region: ap-northeast-2
Canonical web portal: https://portal.insureit.in
```

As of implementation planning, live Supabase inspection showed the database and Storage footprint is small enough for frequent local backups. Storage is separate from database backup payloads and must be copied independently.

## Approved architecture

The backup set consists of:

1. Supabase CLI logical database dump:
   - `roles.sql`
   - `schema.sql`
   - `data.sql`
2. Supabase migration history:
   - `history_schema.sql`
   - `history_data.sql`
3. Every Supabase Storage bucket copied locally through the S3-compatible endpoint.
4. `manifest.json`
5. `checksums.json`
6. controlled `backup.log`

Backups are first written under `_inprogress/<backup>.partial`. They are moved into the normal backup root only after SHA-256 verification.

## Credential rule

Local unattended credentials are not stored in repository files.

On Windows, `Set-InsureITBackupSecrets.ps1` stores the database connection string and Storage S3 secret using Windows DPAPI in:

```text
%ProgramData%\InsureIT Backup\secrets.clixml
```

A future Task Scheduler job must run under the same Windows user that created the DPAPI file.

## Restore rule

- Restore is plan-only by default.
- First restore drill must target a new/isolated Supabase project.
- Production restore is blocked unless explicitly enabled and manually confirmed with `RESTORE PRODUCTION`.
- Storage restore uses copy semantics, never sync/delete semantics.
- After restore, reconcile key table/Auth counts and Storage object counts before using the recovered environment.
- The production release checklist Gate 11 remains incomplete until a dated isolated restore drill proves recovery and measured RPO/RTO.

## Retention rule

Default local retention:

```text
All 6-hour backups: 7 days
Daily representative: 30 days
Weekly representative: 12 weeks
Monthly representative: 12 months
```

Retention is dry-run by default and only considers backups with a healthy manifest.

## Next safe steps

1. Prepare the dedicated Windows backup PC/drive.
2. Install Docker Desktop, Supabase CLI, rclone and Git.
3. Configure `config.local.json` outside Git tracking.
4. Generate Supabase Storage S3 credentials and save them through the DPAPI helper.
5. Run preflight.
6. Create one manual full backup.
7. Run independent checksum verification.
8. Create an isolated Supabase recovery project and rehearse database + Storage restore.
9. Reconcile customers, vehicles, policies, claims, Auth users and Storage objects.
10. Only after the restore drill passes, install the fixed-interval Windows scheduled task and secondary/NAS copy.
