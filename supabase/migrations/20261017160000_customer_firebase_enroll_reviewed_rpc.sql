-- SOURCE ONLY, NOT APPLIED. Requires prior reviewed-enrollment migration
-- and the prepared atomic enrollment RPC. Not exposed to anonymous or user JWTs.
-- Auth accounts, passwords, policies, vehicles, claims are NEVER edited here.
begin;
create or replace function public.customer_firebase_enroll_reviewed(
  p_profile_id uuid, p_firebase_uid text, p_verified_phone text,
  p_operator_id uuid, p_evidence_digest text
) returns text language plpgsql security definer set search_path = ''
as $body$
declare
  v_review public.customer_firebase_enrollment_reviews%rowtype;
  v_uid_digest text;
  v_non_customer_count integer;
  v_other_customer_count integer;
  v_profile public.profiles%rowtype;
  v_auth_phone text;
  v_alias text;
  v_auth_email text;
  v_auth_confirmed timestamptz;
  v_existing_link_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_profile_id is null or p_operator_id is null or
     p_firebase_uid is null or length(p_firebase_uid)<4 or length(p_firebase_uid)>256 or
     p_verified_phone is null or p_verified_phone !~ '^\+91[6-9][0-9]{9}$' or
     p_evidence_digest is null or p_evidence_digest !~ '^[a-f0-9]{64}$' then
    raise exception 'invalid_enrollment_request';
  end if;

  -- Canonical lock order, under a transaction, protects concurrent enrollments.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('firebase-customer:'||p_profile_id::text,0));
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('firebase-uid:'||p_firebase_uid,0));
  select * into v_profile from public.profiles
   where id=p_profile_id and role='customer' and is_active is true for update;
  if not found then raise exception 'canonical_customer_not_eligible'; end if;

  select phone,email,email_confirmed_at
   into v_auth_phone,v_auth_email,v_auth_confirmed
   from auth.users where id=p_profile_id for update;
  if not found or
     pg_catalog.regexp_replace(coalesce(v_profile.phone,''),'[^0-9]','','g')
       !~ '^(91)?[6-9][0-9]{9}$' or
     pg_catalog.regexp_replace(coalesce(v_auth_phone,''),'[^0-9]','','g')
       !~ '^(91)?[6-9][0-9]{9}$' or
     '+91'||right(pg_catalog.regexp_replace(v_profile.phone,'[^0-9]','','g'),10)
       <> p_verified_phone or
     '+91'||right(pg_catalog.regexp_replace(v_auth_phone,'[^0-9]','','g'),10)
       <> p_verified_phone then
    raise exception 'canonical_auth_identity_mismatch';
  end if;
  v_alias := 'c-'||lower(p_profile_id::text)||'@customer-login.insureit.invalid';
  if lower(coalesce(v_auth_email,'')) <> v_alias or v_auth_confirmed is null then
    raise exception 'protected_auth_alias_unavailable';
  end if;

  if not exists(select 1 from public.profiles where id=p_operator_id
    and role='it_super_user' and is_active is true) then
    raise exception 'trusted_operator_not_active';
  end if;

  -- PostgreSQL native SHA256, without exposing raw UID in review/audit journal.
  v_uid_digest:=pg_catalog.encode(
    pg_catalog.sha256(pg_catalog.convert_to('insureit-customer-auth:'||p_firebase_uid,'UTF8')),'hex');

  select * into v_review from public.customer_firebase_enrollment_reviews
  where customer_profile_id=p_profile_id order by id desc limit 1 for update;
  if not found or v_review.decision <> 'approved' or
    v_review.uid_digest <> v_uid_digest or
    v_review.reviewer_id <> p_operator_id or
    v_review.evidence_digest <> p_evidence_digest or
    v_review.expires_at <= now() or v_review.reviewed_at > now() or
    v_review.expires_at > v_review.reviewed_at + interval '14 days' or
    v_review.consent_at is null or v_review.ownership_verified_at is null or
    v_review.recovery_verified_at is null or
    v_review.recovery_verified_at > v_review.reviewed_at or
    v_review.consent_at > v_review.reviewed_at or
    v_review.ownership_verified_at > v_review.reviewed_at then
    raise exception 'independent_review_not_approved';
  end if;

  select c.non_customer_count,c.other_customer_count
    into v_non_customer_count,v_other_customer_count
  from public.customer_firebase_phone_collision_counts(p_profile_id) c;
  if v_non_customer_count is null or v_other_customer_count is null then
    raise exception 'phone_inventory_unavailable';
  end if;
  if v_non_customer_count>0 or v_other_customer_count>0 then
    if v_review.second_reviewer_id is null or
       v_review.second_reviewer_id=p_operator_id or
       not exists(select 1 from public.profiles where
         id=v_review.second_reviewer_id and role='it_super_user' and is_active=true) then
      raise exception 'shared_phone_second_review_required';
    end if;
  end if;

  select count(*) into v_existing_link_count
  from public.customer_firebase_identity_links where
    firebase_project_id='insureit-customer-auth' and
    (profile_id=p_profile_id or firebase_uid=p_firebase_uid);
  if v_existing_link_count > 1 then
    raise exception 'immutable_firebase_identity_conflict';
  end if;
  -- Reuse the reviewed, service-only atomic enrollment that holds the SAME
  -- advisory locks and independently checks canonical Auth phone and mapping.
  return public.customer_firebase_enroll_approved(
    p_profile_id,p_firebase_uid,p_verified_phone,p_operator_id,p_evidence_digest);
end;
$body$;

revoke all on function public.customer_firebase_enroll_reviewed(uuid,text,text,uuid,text)
 from public,anon,authenticated;
grant execute on function public.customer_firebase_enroll_reviewed(uuid,text,text,uuid,text)
 to service_role;
-- Older broad RPC is not a reviewed enrollment interface; make it inaccessible
-- to service_role directly. Security-definer owner can still invoke internally.
revoke execute on function public.customer_firebase_enroll_approved(uuid,text,text,uuid,text)
 from service_role;
comment on function public.customer_firebase_enroll_reviewed(uuid,text,text,uuid,text)
 is 'Prepared restricted, audited Firebase enrollment. Must only be invoked from a trusted operator-authenticated server after Firebase Admin verification. Not approved for deployment.';
commit;
