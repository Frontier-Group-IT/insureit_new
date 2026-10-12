-- Verified legacy phone recovery, additive and deliberately narrow.
-- Eligibility: unique inactive customer profile joined to pre-confirmed
-- Supabase Auth phone; no ban, no customers/memberships, no Firebase link.
-- Only service_role may execute. Invoked exclusively after Firebase Admin
-- verifies fresh signed phone OTP on customer-firebase-bind.
begin;
create or replace function public.customer_firebase_recoverable_legacy_profile(p_phone text)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare v_phone text; v_id uuid; v_matches integer;
begin
  if current_user <> 'service_role'
     and coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
     and auth.role() <> 'service_role' then
    raise exception 'unauthorized_recovery_check' using errcode='42501';
  end if;
  v_phone:=regexp_replace(coalesce(p_phone,''),'[^0-9]','','g');
  if v_phone !~ '^91[6-9][0-9]{9}$' then return null; end if;
  v_phone:=right(v_phone,10);
  -- Multiple records sharing a number, including staff and imported
  -- customer master records, are *not* authorization by themselves.
  if (select count(*) from public.profiles p
    where right(regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'),10)=v_phone)>1 then return null; end if;
  select count(*),min(p.id) into v_matches,v_id
  from public.profiles p join auth.users u on u.id=p.id
  where p.role='customer' and p.is_active=false and
        u.phone_confirmed_at is not null and
        (u.banned_until is null or u.banned_until<=now()) and
        right(regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'),10)=v_phone and
        right(regexp_replace(coalesce(u.phone,''),'[^0-9]','','g'),10)=v_phone and
        not exists(select 1 from public.customers c where c.profile_id=p.id) and
        not exists(select 1 from public.customer_memberships m where m.profile_id=p.id) and
        not exists(select 1 from public.customer_firebase_identity_links f where f.profile_id=p.id) and
        not exists(select 1 from public.customer_onboarding_applications o
          where o.profile_id=p.id and o.status not in ('not_started','in_progress'));
  if v_matches<>1 then return null; end if;
  if (select count(*) from auth.users u where
      right(regexp_replace(coalesce(u.phone,''),'[^0-9]','','g'),10)=v_phone)<>1 then return null; end if;
  return v_id;
end;
$$;
revoke all on function public.customer_firebase_recoverable_legacy_profile(text) from public,anon,authenticated;
grant execute on function public.customer_firebase_recoverable_legacy_profile(text) to service_role;

create or replace function public.customer_firebase_activate_verified_legacy_profile(p_phone text)
returns uuid language plpgsql security definer set search_path=public,auth,pg_temp
as $$
declare v_id uuid;
begin
  if current_user <> 'service_role'
     and coalesce(current_setting('request.jwt.claim.role',true),'') <> 'service_role'
     and auth.role() <> 'service_role' then
    raise exception 'unauthorized_legacy_recovery' using errcode='42501';
  end if;
  v_id:=public.customer_firebase_recoverable_legacy_profile(p_phone);
  if v_id is null then return null; end if;
  perform 1 from public.profiles where id=v_id for update;
  -- Re-evaluate eligibility under the row lock.
  if public.customer_firebase_recoverable_legacy_profile(p_phone) is distinct from v_id then return null; end if;
  update public.profiles set is_active=true,updated_at=now()
  where id=v_id and role='customer' and is_active=false;
  if not found then return null; end if;
  return v_id;
end;
$$;
revoke all on function public.customer_firebase_activate_verified_legacy_profile(text) from public,anon,authenticated;
grant execute on function public.customer_firebase_activate_verified_legacy_profile(text) to service_role;
commit;
