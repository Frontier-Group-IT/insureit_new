-- Test-only Supabase role-name fixtures for a disposable offline PostgreSQL 17 container.
-- These placeholder roles have NOLOGIN, NOSUPERUSER, NOCREATEDB,
-- NOCREATEROLE, NOREPLICATION and NOBYPASSRLS.
-- They intentionally do not model real Supabase role permissions or services.
-- NEVER apply to the managed INSUREIT database or a production deployment.
DO $fixture$
DECLARE role_name text;
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'anon',
    'authenticated',
    'authenticator',
    'service_role',
    'supabase_admin',
    'supabase_auth_admin',
    'supabase_storage_admin',
    'supabase_realtime_admin',
    'supabase_functions_admin',
    'supabase_etl_admin',
    'dashboard_user',
    'pgbouncer'
  ]
  LOOP
    -- Supabase's patched Postgres reserves supabase_* names. It ships
    -- predefined platform roles; do not attempt to forge missing reserved
    -- roles. The strict roles.sql import will report any missing dependency.
    IF left(role_name, 9) = 'supabase_' THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_roles WHERE rolname = role_name) THEN
      EXECUTE format('CREATE ROLE %I NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS', role_name);
    END IF;
  END LOOP;
END
$fixture$;
