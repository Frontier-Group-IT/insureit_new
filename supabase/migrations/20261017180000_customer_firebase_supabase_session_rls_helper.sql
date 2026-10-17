-- DRAFT / UNAPPLIED: retain the existing Firebase-issuer helper path during
-- controlled migration to signed Supabase Customer UUID sessions.
-- Never run in production without independent security review and approval.
-- The existing pre-request adapter still invokes this function for Firebase JWTs.
BEGIN;
CREATE OR REPLACE FUNCTION public.customer_firebase_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT CASE
    WHEN auth.jwt()->>'iss' = 'https://securetoken.google.com/insureit-customer-auth'
      THEN (
        SELECT l.profile_id FROM public.customer_firebase_identity_links l
        JOIN public.profiles p ON p.id=l.profile_id
        WHERE auth.jwt()->>'aud'='insureit-customer-auth'
          AND auth.jwt()->>'role'='authenticated'
          AND nullif(auth.jwt()->>'sub','')=l.firebase_uid
          AND l.firebase_project_id='insureit-customer-auth'
          AND l.verified_phone_at_approval=auth.jwt()->>'phone_number'
          AND l.verified_phone_at_approval=public.customer_canonical_indian_phone(p.phone)
          AND l.is_active AND l.is_approved AND l.approved_at IS NOT NULL
          AND p.is_active AND p.role::text='customer'
        LIMIT 1
      )
    WHEN auth.jwt()->>'iss' = 'https://ilzhsfqqjyppzzvfscmh.supabase.co/auth/v1'
      AND auth.jwt()->>'role'='authenticated'
      THEN (
        SELECT p.id FROM public.profiles p
        JOIN auth.users u ON u.id=p.id
        WHERE p.id=(SELECT auth.uid())
          AND p.role::text='customer' AND p.is_active IS TRUE
          AND u.is_anonymous IS DISTINCT FROM TRUE
          AND (u.banned_until IS NULL OR u.banned_until<=now())
          AND public.customer_canonical_indian_phone(p.phone) IS NOT NULL
          AND public.customer_canonical_indian_phone(p.phone)=public.customer_canonical_indian_phone(u.phone)
          AND (
            SELECT count(*) FROM public.customer_firebase_identity_links l
            WHERE l.firebase_project_id='insureit-customer-auth'
              AND l.profile_id=p.id AND l.is_active IS TRUE AND l.is_approved IS TRUE
              AND l.approved_at IS NOT NULL
              AND l.verified_phone_at_approval=public.customer_canonical_indian_phone(p.phone)
          )=1
        LIMIT 1
      )
    ELSE NULL::uuid
  END
$function$;
COMMIT;
