-- REVIEW ONLY — UNTESTED ON A SUPABASE PREVIEW BRANCH.
-- Prefer this PostgREST hook to editing Supabase-managed auth.uid().
-- Proven property: auth.uid() first reads request.jwt.claim.sub.
-- This hook may set that LOCAL GUC to an existing approved profile UUID
-- ONLY after checking the verified Firebase JWT claims against mapping.
--
-- WARNING: Supabase documentation confirms this affects Data API only;
-- Storage, Realtime and other services need separate authorization work.
--
-- Do not apply this globally until real Firebase signed-token tests, negative
-- cross-customer isolation, and legacy Supabase regression are green.
CREATE OR REPLACE FUNCTION public.customer_firebase_data_api_pre_request()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  claims jsonb;
  profile uuid;
BEGIN
  claims := nullif(current_setting('request.jwt.claims', true), '')::jsonb;
  IF claims IS NULL
    OR claims->>'iss' IS DISTINCT FROM 'https://securetoken.google.com/insureit-customer-auth'
  THEN
    -- Supabase Auth, service, anonymous and other request types are unchanged.
    RETURN;
  END IF;

  -- This verifies issuer, audience, role, UID, verified phone, active
  -- customer profile and admin-approved Firebase mapping. Database policies
  -- still enforce customer-specific access independently.
  profile := public.customer_firebase_profile_id();
  IF profile IS NULL THEN
    RAISE insufficient_privilege USING MESSAGE='Customer identity not authorized';
  END IF;

  -- Applies only to the current transaction. JWT claim JSON remains
  -- untouched, so the Firebase resolver can still see the original UID.
  PERFORM set_config('request.jwt.claim.sub', profile::text, true);
END
$function$;

-- PostgREST runs the hook under the effective API role.
REVOKE ALL ON FUNCTION public.customer_firebase_data_api_pre_request() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_firebase_data_api_pre_request()
  TO anon, authenticated, service_role;

-- MUST BE STAGED AND APPROVED SEPARATELY (do not uncomment in PR):
-- ALTER ROLE authenticator SET pgrst.db_pre_request =
--   'public.customer_firebase_data_api_pre_request';
-- NOTIFY pgrst, 'reload config';
--
-- Rollback (only after dependency review):
-- ALTER ROLE authenticator RESET pgrst.db_pre_request;
-- NOTIFY pgrst, 'reload config';
--
-- SECURITY GATE: Supabase API gateway must cryptographically validate Firebase
-- third-party tokens before PostgREST. JSON claims are not independently signed
-- inside this SQL function. Reject unlinked Firebase identities (do NOT fall
-- back to arbitrary sub UUID); verify concurrent impersonation attempts.
