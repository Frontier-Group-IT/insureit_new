-- OFFLINE RESTORE TARGET ONLY; never apply to production.
-- The pinned Supabase Postgres image includes auth.uid, auth.role, auth.email,
-- but not auth.jwt(). It is owned by Supabase-managed roles, so do not
-- replace those existing platform functions or alter schema permissions.
-- Installed by local scoped supabase_auth_admin in a network-disabled Docker.
-- Definition verified by read-only pg_get_functiondef on live INSUREIT 2026-11-08.
CREATE OR REPLACE FUNCTION auth.jwt()
RETURNS jsonb LANGUAGE sql STABLE
AS $function$
  SELECT coalesce(
    nullif(current_setting('request.jwt.claim', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')
  )::jsonb
$function$;
