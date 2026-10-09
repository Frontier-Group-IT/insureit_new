-- REVIEW ONLY: do not apply until policy regression and rollback validation.
-- This narrow compatibility repair prevents non-UUID Firebase JWT subjects from
-- throwing SQLSTATE 22P02 inside existing auth.uid()-based RLS policies.
-- Valid legacy Supabase subjects still return the same UUID.
-- Does NOT itself authorize a Firebase user: Firebase read policies must
-- still invoke the independently verified customer_firebase_profile_id().
--
-- WARNING: Supabase owns auth.uid(). Changing it affects EVERY app role and
-- 136 public policies + storage policies. Verify upgrade ownership, grants,
-- dependency graph, SQL semantics and legacy session behavior first.
--
-- IMPORTANT: this is a proposal, not a production migration.
CREATE OR REPLACE FUNCTION auth.uid()
RETURNS uuid
LANGUAGE sql
STABLE
AS $function$
  SELECT CASE
    WHEN coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    ) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN coalesce(
      nullif(current_setting('request.jwt.claim.sub', true), ''),
      nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
    )::uuid
    ELSE NULL::uuid
  END
$function$;
-- Rollback: restore original Supabase auth.uid() definition from the
-- live pre-change pg_get_functiondef('auth.uid()'::regprocedure) snapshot.
