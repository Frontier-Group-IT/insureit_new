-- Phase 3: verified Firebase JWT -> original INSUREIT profile UUID.
-- This is an additive resolver. It does NOT change existing RLS or allow
-- Firebase access before a separately reviewed policy migration.
CREATE OR REPLACE FUNCTION public.customer_firebase_profile_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ''
AS $function$
  SELECT l.profile_id
  FROM public.customer_firebase_identity_links l
  JOIN public.profiles p ON p.id = l.profile_id
  WHERE auth.jwt() ->> 'iss' = 'https://securetoken.google.com/insureit-customer-auth'
    AND auth.jwt() ->> 'aud' = 'insureit-customer-auth'
    AND auth.jwt() ->> 'role' = 'authenticated'
    AND nullif(auth.jwt() ->> 'sub', '') = l.firebase_uid
    AND l.firebase_project_id = 'insureit-customer-auth'
    AND l.verified_phone_at_approval = auth.jwt() ->> 'phone_number'
    AND l.is_active AND l.is_approved AND l.approved_at IS NOT NULL
    AND p.is_active AND p.role::text = 'customer'
  LIMIT 1
$function$;
REVOKE ALL ON FUNCTION public.customer_firebase_profile_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_firebase_profile_id() TO authenticated;
