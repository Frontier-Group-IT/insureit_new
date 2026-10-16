-- PREPARED ONLY: operator-authorized Firebase UID enrollment, no production apply.
-- This function is invoked ONLY by a privileged server after revocation-checked
-- Firebase Admin JWT validation and independently approved customer identity.
begin;
create or replace function public.customer_firebase_enroll_approved(
 p_profile_id uuid, p_firebase_uid text, p_verified_phone text,
 p_operator_id uuid, p_evidence_digest text
) returns text language plpgsql security definer
set search_path = '' as $$
declare
 v_profile public.profiles%rowtype;
 v_auth_phone text;
 v_operator_allowed boolean;
 v_exists public.customer_firebase_identity_links%rowtype;
 v_count integer;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'service_role_required'; end if;
 if p_firebase_uid is null or length(p_firebase_uid) < 4 or length(p_firebase_uid) > 256 or
    p_verified_phone !~ '^\\+91[6-9][0-9]{9}$' or
    p_operator_id is null or p_evidence_digest !~ '^[a-f0-9]{64}$' then
   raise exception 'invalid_enrollment_request';
 end if;
 select exists (select 1 from public.profiles op where op.id=p_operator_id and op.role='it_super_user' and op.is_active=true) into v_operator_allowed;
 if v_operator_allowed is distinct from true then raise exception 'operator_not_authorized'; end if;
 -- Serialize enrollment for the same customer AND same Firebase UID.
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('firebase-customer:'||p_profile_id::text,0));
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('firebase-uid:'||p_firebase_uid,0));
 select * into v_profile from public.profiles where id=p_profile_id for update;
 if not found or v_profile.role <> 'customer' or v_profile.is_active is distinct from true then
   raise exception 'customer_not_eligible';
 end if;
 select u.phone into v_auth_phone from auth.users u where u.id=p_profile_id for update;
 if not found or v_auth_phone is null then raise exception 'auth_identity_missing'; end if;
 if v_profile.phone is null or v_auth_phone is null or
   regexp_replace(v_profile.phone,'[^0-9]','','g') !~ '^(91)?[6-9][0-9]{9}
   raise exception 'phone_mismatch';
 end if;
 select count(*) into v_count from public.customer_firebase_identity_links
   where firebase_project_id='insureit-customer-auth'
     and (profile_id=p_profile_id or firebase_uid=p_firebase_uid);
 if v_count>1 then raise exception 'mapping_conflict'; end if;
 select * into v_exists from public.customer_firebase_identity_links
   where firebase_project_id='insureit-customer-auth'
     and (profile_id=p_profile_id or firebase_uid=p_firebase_uid) for update;
 if found then
   if v_exists.profile_id <> p_profile_id or v_exists.firebase_uid <> p_firebase_uid
      or v_exists.verified_phone_at_approval <> p_verified_phone
      or v_exists.is_approved is distinct from true or v_exists.is_active is distinct from true then
      raise exception 'mapping_conflict';
   end if;
   return 'already_approved';
 end if;
 insert into public.customer_firebase_identity_links
 (firebase_project_id,firebase_uid,profile_id,verified_phone_at_approval,approved_at,is_approved,is_active)
 values ('insureit-customer-auth',p_firebase_uid,p_profile_id,p_verified_phone,now(),true,true);
 insert into public.customer_firebase_migration_audit
 (customer_profile_id,action,operator_id,evidence_digest)
 values (p_profile_id,'enrollment_approved',p_operator_id,p_evidence_digest);
 return 'enrolled';
end;
$;
revoke all on function public.customer_firebase_enroll_approved(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.customer_firebase_enroll_approved(uuid,text,text,uuid,text) to service_role;
commit;
 or
   regexp_replace(v_auth_phone,'[^0-9]','','g') !~ '^(91)?[6-9][0-9]{9}
   raise exception 'phone_mismatch';
 end if;
 select count(*) into v_count from public.customer_firebase_identity_links
   where firebase_project_id='insureit-customer-auth'
     and (profile_id=p_profile_id or firebase_uid=p_firebase_uid);
 if v_count>1 then raise exception 'mapping_conflict'; end if;
 select * into v_exists from public.customer_firebase_identity_links
   where firebase_project_id='insureit-customer-auth'
     and (profile_id=p_profile_id or firebase_uid=p_firebase_uid) for update;
 if found then
   if v_exists.profile_id <> p_profile_id or v_exists.firebase_uid <> p_firebase_uid
      or v_exists.verified_phone_at_approval <> p_verified_phone
      or v_exists.is_approved is distinct from true or v_exists.is_active is distinct from true then
      raise exception 'mapping_conflict';
   end if;
   return 'already_approved';
 end if;
 insert into public.customer_firebase_identity_links
 (firebase_project_id,firebase_uid,profile_id,verified_phone_at_approval,is_approved,is_active)
 values ('insureit-customer-auth',p_firebase_uid,p_profile_id,p_verified_phone,true,true);
 insert into public.customer_firebase_migration_audit
 (customer_profile_id,action,operator_id,evidence_digest)
 values (p_profile_id,'enrollment_approved',p_operator_id,p_evidence_digest);
 return 'enrolled';
end $$;
revoke all on function public.customer_firebase_enroll_approved(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.customer_firebase_enroll_approved(uuid,text,text,uuid,text) to service_role;
commit;
 or
   ('+91'||right(regexp_replace(v_profile.phone,'[^0-9]','','g'),10)) <> p_verified_phone
   or ('+91'||right(regexp_replace(v_auth_phone,'[^0-9]','','g'),10)) <> p_verified_phone then
   raise exception 'phone_mismatch';
 end if;
 select count(*) into v_count from public.customer_firebase_identity_links
   where firebase_project_id='insureit-customer-auth'
     and (profile_id=p_profile_id or firebase_uid=p_firebase_uid);
 if v_count>1 then raise exception 'mapping_conflict'; end if;
 select * into v_exists from public.customer_firebase_identity_links
   where firebase_project_id='insureit-customer-auth'
     and (profile_id=p_profile_id or firebase_uid=p_firebase_uid) for update;
 if found then
   if v_exists.profile_id <> p_profile_id or v_exists.firebase_uid <> p_firebase_uid
      or v_exists.verified_phone_at_approval <> p_verified_phone
      or v_exists.is_approved is distinct from true or v_exists.is_active is distinct from true then
      raise exception 'mapping_conflict';
   end if;
   return 'already_approved';
 end if;
 insert into public.customer_firebase_identity_links
 (firebase_project_id,firebase_uid,profile_id,verified_phone_at_approval,is_approved,is_active)
 values ('insureit-customer-auth',p_firebase_uid,p_profile_id,p_verified_phone,true,true);
 insert into public.customer_firebase_migration_audit
 (customer_profile_id,action,operator_id,evidence_digest)
 values (p_profile_id,'enrollment_approved',p_operator_id,p_evidence_digest);
 return 'enrolled';
end $$;
revoke all on function public.customer_firebase_enroll_approved(uuid,text,text,uuid,text) from public,anon,authenticated;
grant execute on function public.customer_firebase_enroll_approved(uuid,text,text,uuid,text) to service_role;
commit;
