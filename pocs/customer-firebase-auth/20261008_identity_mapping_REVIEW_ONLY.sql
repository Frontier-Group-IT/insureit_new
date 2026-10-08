-- REVIEW ONLY. DO NOT AUTO-APPLY TO ANY DATABASE.
-- Requires full JWT issuer verification, RLS/RPC review, and explicit approval.
BEGIN;
CREATE TABLE IF NOT EXISTS public.customer_firebase_identity_links (
  firebase_project_id text NOT NULL,
  firebase_uid text NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  verified_phone_at_approval text NOT NULL,
  is_approved boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (firebase_project_id, firebase_uid),
  CONSTRAINT firebase_customer_one_profile UNIQUE (profile_id),
  CONSTRAINT firebase_link_only_approved_active CHECK (NOT is_active OR (is_approved AND approved_at IS NOT NULL)),
  CONSTRAINT firebase_approved_phone_e164 CHECK (verified_phone_at_approval ~ '^\\+91[6-9][0-9]{9}$'),
  CONSTRAINT firebase_uid_nonempty CHECK (length(trim(firebase_uid)) BETWEEN 1 AND 128)
);
ALTER TABLE public.customer_firebase_identity_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_firebase_identity_links FROM PUBLIC, anon, authenticated;
-- No client policies; only separately reviewed privileged administration.
CREATE OR REPLACE FUNCTION public.customer_auth_profile_id()
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  claims jsonb := auth.jwt();
  token_sub text := claims ->> 'sub';
  token_issuer text := claims ->> 'iss';
  mapped_id uuid;
BEGIN
  IF claims IS NULL OR claims ->> 'role' <> 'authenticated' THEN
    RETURN NULL;
  END IF;
  IF token_issuer = 'https://securetoken.google.com/insureit-customer-auth' THEN
    IF coalesce(claims ->> 'aud','') <> 'insureit-customer-auth'
       OR coalesce(token_sub,'') = '' THEN RETURN NULL; END IF;
    SELECT link.profile_id INTO mapped_id
    FROM public.customer_firebase_identity_links AS link
    JOIN public.profiles AS profile ON profile.id = link.profile_id
    WHERE link.firebase_project_id = 'insureit-customer-auth'
      AND link.firebase_uid = token_sub
      AND link.is_approved AND link.is_active
      AND profile.role::text = 'customer'
      AND profile.is_active
    LIMIT 1;
    RETURN mapped_id;
  END IF;
  -- This issuer is intentionally a placeholder: this draft is not deployable.
  IF token_issuer = 'https://REPLACE_WITH_OWN_PROJECT.supabase.co/auth/v1'
     AND token_sub ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' THEN
    RETURN token_sub::uuid;
  END IF;
  RETURN NULL;
END;
$function$;
REVOKE ALL ON FUNCTION public.customer_auth_profile_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.customer_auth_profile_id() TO authenticated;
-- This does not update any existing RLS policies or signup/customer RPCs.
COMMIT;
