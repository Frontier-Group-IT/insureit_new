-- Isolated INSUREIT PostgreSQL v2 recovery verifier ONLY.
-- NEVER run against Supabase platform or a real backup replacement database.
-- Source of role NAME allowlist: read-only pg_roles query on INSUREIT PG17.6,
-- Nov 11 2026. The source archive's filtered roles.sql was already imported.
-- Missing names are created as NOLOGIN placeholders with zero privileges.
-- Existence is necessary for a strict pg_restore; it does NOT reconstruct
-- authentic managed role attributes, memberships, passwords or RLS access.
DO $offline_roles$
DECLARE
  item text;
BEGIN
  FOREACH item IN ARRAY ARRAY[
    'anon',
    'authenticated',
    'authenticator',
    'cli_login_postgres',
    'dashboard_user',
    'postgres',
    'service_role',
    'supabase_admin',
    'supabase_auth_admin',
    'supabase_etl_admin',
    'supabase_privileged_role',
    'supabase_read_only_user',
    'supabase_realtime_admin',
    'supabase_replication_admin',
    'supabase_storage_admin'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = item) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', item);
    END IF;
  END LOOP;
END
$offline_roles$;
