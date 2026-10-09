-- Normalize existing customer phone format without modifying business records.
-- Only accept exact Indian ten digits or prefix 91 + ten digits.
CREATE OR REPLACE FUNCTION public.customer_canonical_indian_phone(p_phone text)
RETURNS text LANGUAGE sql IMMUTABLE STRICT SET search_path=''
AS $phone$
  SELECT CASE WHEN regexp_replace(p_phone,'[^0-9]','','g') ~ '^(91)?[6-9][0-9]{9}$'
    THEN '+91' || right(regexp_replace(p_phone,'[^0-9]','','g'),10)
    ELSE NULL END
$phone$;
REVOKE ALL ON FUNCTION public.customer_canonical_indian_phone(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.customer_canonical_indian_phone(text) TO authenticated;
CREATE OR REPLACE FUNCTION public.validate_customer_firebase_identity_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=''
AS $body$
DECLARE
  profile_phone text;
  active_customer boolean;
  matching_profiles integer;
BEGIN
  IF NEW.firebase_project_id <> 'insureit-customer-auth' THEN
    RAISE EXCEPTION 'Unrecognized Firebase project';
  END IF;
  IF NEW.is_approved OR NEW.is_active THEN
    SELECT public.customer_canonical_indian_phone(p.phone),
           (p.role::text = 'customer' AND p.is_active)
    INTO profile_phone,active_customer
    FROM public.profiles p WHERE p.id=NEW.profile_id FOR SHARE;
    SELECT count(*) INTO matching_profiles
    FROM public.profiles p WHERE p.role::text='customer' AND p.is_active
      AND public.customer_canonical_indian_phone(p.phone)=NEW.verified_phone_at_approval;
    IF coalesce(active_customer,false) IS NOT TRUE
       OR profile_phone IS DISTINCT FROM NEW.verified_phone_at_approval
       OR matching_profiles<>1 THEN
      RAISE EXCEPTION 'Firebase identity cannot bind to this customer profile';
    END IF;
  END IF;
  RETURN NEW;
END;
$body$;
CREATE OR REPLACE FUNCTION public.customer_firebase_profile_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path=''
AS $body$
  SELECT l.profile_id FROM public.customer_firebase_identity_links l
  JOIN public.profiles p ON p.id=l.profile_id
  WHERE auth.jwt()->>'iss'='https://securetoken.google.com/insureit-customer-auth'
    AND auth.jwt()->>'aud'='insureit-customer-auth'
    AND auth.jwt()->>'role'='authenticated'
    AND nullif(auth.jwt()->>'sub','')=l.firebase_uid
    AND l.firebase_project_id='insureit-customer-auth'
    AND l.verified_phone_at_approval=auth.jwt()->>'phone_number'
    AND l.verified_phone_at_approval=public.customer_canonical_indian_phone(p.phone)
    AND l.is_active AND l.is_approved AND l.approved_at IS NOT NULL
    AND p.is_active AND p.role::text='customer'
  LIMIT 1
$body$;
