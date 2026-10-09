-- Phase 2: guarded binding validator. Requires trusted server-side Admin SDK
-- token verification before any service-role process inserts/approves a link.
-- No customer RLS policies, login flow, or access privileges are changed.
CREATE OR REPLACE FUNCTION public.validate_customer_firebase_identity_link()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $body$
DECLARE
  profile_phone text;
  active_customer boolean;
BEGIN
  IF NEW.firebase_project_id <> 'insureit-customer-auth' THEN
    RAISE EXCEPTION 'Unrecognized Firebase project';
  END IF;
  IF NEW.is_approved OR NEW.is_active THEN
    SELECT p.phone, (p.role::text = 'customer' AND p.is_active)
    INTO profile_phone, active_customer
    FROM public.profiles p WHERE p.id = NEW.profile_id FOR SHARE;
    IF coalesce(active_customer,false) IS NOT TRUE
       OR profile_phone IS DISTINCT FROM NEW.verified_phone_at_approval THEN
      RAISE EXCEPTION 'Firebase identity cannot bind to this customer profile';
    END IF;
  END IF;
  RETURN NEW;
END;
$body$;
REVOKE ALL ON FUNCTION public.validate_customer_firebase_identity_link() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER validate_customer_firebase_identity_link_trigger
BEFORE INSERT OR UPDATE ON public.customer_firebase_identity_links
FOR EACH ROW EXECUTE FUNCTION public.validate_customer_firebase_identity_link();
