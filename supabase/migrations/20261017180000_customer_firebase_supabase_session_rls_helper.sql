-- SOURCE ONLY, UNAPPLIED. Requires separate RLS/security review and owner approval.
-- Production's existing Firebase-specific helper checks Firebase JWT iss/aud/UID,
-- but the proven Android bridge ends in a genuine Supabase Auth session.
-- This proposed rewrite binds the same canonical Auth UUID to one approved
-- Customer link; it NEVER accepts a Firebase JWT as a PostgREST data session.
--
-- Review the complete set of permissive RLS policies before applying:
-- an additional permissive policy may allow reads independently of this helper.
BEGIN;

CREATE OR REPLACE FUNCTION public.customer_firebase_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT p.id
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.id = (SELECT auth.uid())
    AND (SELECT auth.role()) = 'authenticated'
    AND (SELECT auth.jwt()->>'iss') =
        'https://ilzhsfqqjyppzzvfscmh.supabase.co/auth/v1'
    AND p.role::text = 'customer'
    AND p.is_active IS TRUE
    AND u.is_anonymous IS DISTINCT FROM TRUE
    AND (u.banned_until IS NULL OR u.banned_until <= now())
    AND public.customer_canonical_indian_phone(p.phone) IS NOT NULL
    AND public.customer_canonical_indian_phone(p.phone) =
        public.customer_canonical_indian_phone(u.phone)
    AND (
      SELECT count(*) FROM public.customer_firebase_identity_links l
      WHERE l.firebase_project_id = 'insureit-customer-auth'
        AND l.profile_id = p.id
        AND l.is_active IS TRUE
        AND l.is_approved IS TRUE
        AND l.approved_at IS NOT NULL
        AND l.verified_phone_at_approval =
            public.customer_canonical_indian_phone(p.phone)
    ) = 1
  LIMIT 1
$function$;

-- Preserve existing caller/role grants. This rewrite does not add new grants
-- or change any policy, Auth UUID, Firebase enrollment or customer records.
COMMIT;
