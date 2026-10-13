-- PRODUCTION-SAFE TRANSACTION TEST
-- Requires existing active customer profiles; all identity test inserts are
-- ROLLED BACK. Only synthetic JWT claims (not signed Firebase tokens) are tested.
-- This verifies mapping, UUID compatibility, and customer-scoped reads, NOT
-- Firebase's external cryptographic token validation at the API gateway.
BEGIN;

INSERT INTO public.customer_firebase_identity_links
(firebase_project_id,firebase_uid,profile_id,verified_phone_at_approval,approved_at,is_approved,is_active)
SELECT 'insureit-customer-auth',
 'firebase-transaction-regression-nonuuid',
 p.id,public.customer_canonical_indian_phone(p.phone),now(),true,true
FROM public.profiles p
WHERE p.role='customer' AND p.is_active
 AND public.customer_canonical_indian_phone(p.phone) IS NOT NULL
ORDER BY p.id LIMIT 1;

SELECT set_config('request.jwt.claims',(
 SELECT jsonb_build_object(
 'iss','https://securetoken.google.com/insureit-customer-auth',
 'aud','insureit-customer-auth',
 'role','authenticated',
 'sub','firebase-transaction-regression-nonuuid',
 'phone_number',l.verified_phone_at_approval)::text
 FROM public.customer_firebase_identity_links l
 WHERE l.firebase_uid='firebase-transaction-regression-nonuuid'
),true);
SET LOCAL ROLE authenticated;
SELECT public.customer_firebase_data_api_pre_request();

DO $tests$
BEGIN
 IF auth.uid() IS DISTINCT FROM public.customer_firebase_profile_id() THEN
  RAISE EXCEPTION 'Canonical Firebase profile mismatch';
 END IF;
 IF (SELECT count(*) FROM public.profiles) <> 1 THEN
  RAISE EXCEPTION 'Profile isolation failed';
 END IF;
 IF (SELECT count(*) FROM public.customers
       WHERE NOT public.customer_firebase_can_read_customer(id)) <> 0 THEN
  RAISE EXCEPTION 'Customer isolation failed';
 END IF;
 IF (SELECT count(*) FROM public.vehicles
       WHERE NOT public.customer_firebase_can_read_customer(customer_id)) <> 0 THEN
  RAISE EXCEPTION 'Vehicle isolation failed';
 END IF;
 IF (SELECT count(*) FROM public.policies
       WHERE NOT public.customer_firebase_can_read_customer(customer_id)) <> 0 THEN
  RAISE EXCEPTION 'Policy isolation failed';
 END IF;
 IF (SELECT count(*) FROM public.claims
       WHERE NOT public.customer_firebase_can_read_customer(customer_id)) <> 0 THEN
  RAISE EXCEPTION 'Claims isolation failed';
 END IF;
 IF (SELECT count(*) FROM public.customer_memberships
       WHERE profile_id <> public.customer_firebase_profile_id()) <> 0 THEN
  RAISE EXCEPTION 'Membership isolation failed';
 END IF;
 IF (SELECT count(*) FROM public.customer_onboarding_applications
       WHERE profile_id <> public.customer_firebase_profile_id()) <> 0 THEN
  RAISE EXCEPTION 'Onboarding isolation failed';
 END IF;
 IF (SELECT count(*) FROM public.claim_documents
       WHERE NOT public.customer_firebase_can_read_customer(customer_id)) <> 0 THEN
  RAISE EXCEPTION 'Claim document isolation failed';
 END IF;
 IF (SELECT count(*) FROM public.external_policies
       WHERE NOT public.customer_firebase_can_read_customer(customer_id)) <> 0 THEN
  RAISE EXCEPTION 'External policy isolation failed';
 END IF;
END
$tests$;

-- Transaction rollback removes the synthetic UID approval.
ROLLBACK;
