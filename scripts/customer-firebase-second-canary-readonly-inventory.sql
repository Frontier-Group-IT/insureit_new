-- INSUREIT Firebase second-canary / controlled rollout inventory.
-- READ ONLY, returns aggregate counts; no IDs, names, phone numbers, UID values,
-- OTPs, secrets, emails, or Customer records are returned.
-- Run only by authorized project administrator against the intended project.
-- Does NOT approve enrollment, assign a Customer, send OTP, or modify Auth.
BEGIN TRANSACTION READ ONLY;
WITH active_customers AS (
 SELECT p.id,
   public.customer_canonical_indian_phone(p.phone) AS canonical_phone,
   u.id AS auth_id,
   public.customer_canonical_indian_phone(u.phone) AS canonical_auth_phone,
   u.email, u.email_confirmed_at, u.phone_confirmed_at, u.banned_until,
   u.is_anonymous
 FROM public.profiles p
 LEFT JOIN auth.users u ON u.id=p.id
 WHERE p.role::text='customer' AND p.is_active IS TRUE
),
checklist AS (
 SELECT c.*,
  EXISTS (
    SELECT 1 FROM public.profiles other
    WHERE other.id<>c.id AND other.is_active IS TRUE
      AND c.canonical_phone IS NOT NULL
      AND public.customer_canonical_indian_phone(other.phone)=c.canonical_phone
  ) AS profile_phone_conflict,
  EXISTS (
    SELECT 1 FROM auth.users other
    WHERE other.id<>c.id
      AND c.canonical_phone IS NOT NULL
      AND public.customer_canonical_indian_phone(other.phone)=c.canonical_phone
  ) AS auth_phone_conflict,
  (SELECT count(*) FROM public.customer_firebase_identity_links l
   WHERE l.profile_id=c.id
     AND l.firebase_project_id='insureit-customer-auth') AS all_firebase_links,
  (SELECT count(*) FROM public.customer_firebase_identity_links l
   WHERE l.profile_id=c.id
     AND l.firebase_project_id='insureit-customer-auth'
     AND l.is_active IS TRUE AND l.is_approved IS TRUE
     AND l.approved_at IS NOT NULL
     AND l.verified_phone_at_approval=c.canonical_phone) AS approved_matching_links
 FROM active_customers c
),
cohort AS (
 SELECT *,
    auth_id=id AND canonical_phone IS NOT NULL
      AND canonical_auth_phone=canonical_phone
      AND is_anonymous IS DISTINCT FROM TRUE
      AND (banned_until IS NULL OR banned_until<=now()) AS valid_auth_principal,
    profile_phone_conflict OR auth_phone_conflict AS shared_phone
 FROM checklist
)
SELECT count(*) AS active_customers,
 count(*) FILTER (WHERE valid_auth_principal) AS valid_matching_auth_principals,
 count(*) FILTER (WHERE shared_phone) AS shared_phone_needs_review,
 count(*) FILTER (WHERE NOT shared_phone AND valid_auth_principal)
   AS unshared_auth_matched,
 count(*) FILTER (WHERE NOT shared_phone AND valid_auth_principal
   AND all_firebase_links=0 AND email IS NULL)
   AS unshared_unlinked_missing_auth_email,
 count(*) FILTER (WHERE NOT shared_phone AND valid_auth_principal
   AND approved_matching_links=1
   AND all_firebase_links=1
   AND email IS NOT NULL AND email_confirmed_at IS NOT NULL)
   AS unshared_linked_with_confirmed_auth_email,
 count(*) FILTER (WHERE all_firebase_links>1)
   AS multiple_firebase_links_requires_review,
 count(*) FILTER (WHERE canonical_phone IS NULL OR NOT valid_auth_principal)
   AS invalid_phone_or_auth_requires_review
FROM cohort;
ROLLBACK;
