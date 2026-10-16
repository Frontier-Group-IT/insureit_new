-- PREPARED ONLY. Apply ONLY after review and approval. Never as part of CI against production.
-- Requires the preceding service-only customer_firebase_migration_audit migration.
BEGIN;

CREATE OR REPLACE FUNCTION public.customer_firebase_enroll_approved(
  p_profile_id uuid,
  p_firebase_uid text,
  p_verified_phone text,
  p_operator_id uuid,
  p_evidence_digest text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_customer public.profiles%ROWTYPE;
  v_auth_phone text;
  v_operator_allowed boolean;
  v_link public.customer_firebase_identity_links%ROWTYPE;
  v_matches integer;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;
  IF p_profile_id IS NULL OR p_firebase_uid IS NULL
      OR length(p_firebase_uid) < 4 OR length(p_firebase_uid) > 256
      OR p_verified_phone IS NULL
      OR p_verified_phone !~ '^\+91[6-9][0-9]{9}$'
      OR p_operator_id IS NULL
      OR p_evidence_digest IS NULL
      OR p_evidence_digest !~ '^[a-f0-9]{64}$' THEN
    RAISE EXCEPTION 'invalid_enrollment_request';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles operator_profile
    WHERE operator_profile.id = p_operator_id
      AND operator_profile.role = 'it_super_user'
      AND operator_profile.is_active IS TRUE
  ) INTO v_operator_allowed;
  IF v_operator_allowed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'operator_not_authorized';
  END IF;

  -- Canonical lock order and distinct key domains prevent concurrent reassignments.
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('firebase-customer:' || p_profile_id::text, 0)
  );
  PERFORM pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('firebase-uid:' || p_firebase_uid, 0)
  );
  SELECT * INTO v_customer FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND OR v_customer.role <> 'customer'
      OR v_customer.is_active IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'customer_not_eligible';
  END IF;

  SELECT phone INTO v_auth_phone FROM auth.users WHERE id = p_profile_id FOR UPDATE;
  IF NOT FOUND OR v_auth_phone IS NULL OR v_customer.phone IS NULL THEN
    RAISE EXCEPTION 'auth_identity_missing';
  END IF;
  IF pg_catalog.regexp_replace(v_customer.phone, '[^0-9]', '', 'g')
      !~ '^(91)?[6-9][0-9]{9}$'
    OR pg_catalog.regexp_replace(v_auth_phone, '[^0-9]', '', 'g')
      !~ '^(91)?[6-9][0-9]{9}$'
    OR ('+91' || right(pg_catalog.regexp_replace(v_customer.phone, '[^0-9]', '', 'g'), 10))
      <> p_verified_phone
    OR ('+91' || right(pg_catalog.regexp_replace(v_auth_phone, '[^0-9]', '', 'g'), 10))
      <> p_verified_phone THEN
    RAISE EXCEPTION 'phone_mismatch';
  END IF;

  SELECT count(*) INTO v_matches
  FROM public.customer_firebase_identity_links
  WHERE firebase_project_id = 'insureit-customer-auth'
    AND (profile_id = p_profile_id OR firebase_uid = p_firebase_uid);
  IF v_matches > 1 THEN
    RAISE EXCEPTION 'mapping_conflict';
  END IF;

  SELECT * INTO v_link
  FROM public.customer_firebase_identity_links
  WHERE firebase_project_id = 'insureit-customer-auth'
    AND (profile_id = p_profile_id OR firebase_uid = p_firebase_uid)
  FOR UPDATE;
  IF FOUND THEN
    IF v_link.profile_id <> p_profile_id
        OR v_link.firebase_uid <> p_firebase_uid
        OR v_link.verified_phone_at_approval <> p_verified_phone
        OR v_link.is_approved IS DISTINCT FROM true
        OR v_link.is_active IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'mapping_conflict';
    END IF;
    RETURN 'already_approved';
  END IF;

  INSERT INTO public.customer_firebase_identity_links (
    firebase_project_id, firebase_uid, profile_id, verified_phone_at_approval,
    approved_at, is_approved, is_active
  ) VALUES (
    'insureit-customer-auth', p_firebase_uid, p_profile_id, p_verified_phone,
    now(), true, true
  );
  INSERT INTO public.customer_firebase_migration_audit (
    customer_profile_id, action, operator_id, evidence_digest
  ) VALUES (
    p_profile_id, 'enrollment_approved', p_operator_id, p_evidence_digest
  );
  RETURN 'enrolled';
END;
$function$;

REVOKE ALL ON FUNCTION public.customer_firebase_enroll_approved(uuid,text,text,uuid,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_firebase_enroll_approved(uuid,text,text,uuid,text)
  TO service_role;
COMMIT;
