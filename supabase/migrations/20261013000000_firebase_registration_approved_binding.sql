-- Firebase OTP registration-preflight fix. No customer data writes.
-- Reversible by redeploying the prior function definition.
CREATE OR REPLACE FUNCTION public.customer_firebase_registration_preflight(p_phone text, p_identity_hash text, p_phone_hash text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
declare
  v_phone10 text;
  v_ip_attempts integer;
  v_phone_attempts integer;
  v_profile_count integer;
  v_legacy_count integer;
  v_confirmed_customer_count integer;
  v_unconfirmed_customer_count integer;
  v_key text;
begin
  -- Edge Function uses service_role only; a caller cannot invoke this RPC directly.
  if coalesce(current_setting('request.jwt.claim.role', true),'') <> 'service_role'
     and auth.role() <> 'service_role' then
    raise exception 'preflight_not_authorized' using errcode = '42501';
  end if;
  v_phone10 := regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g');
  if v_phone10 !~ '^91[6-9][0-9]{9}$' or
     p_identity_hash !~ '^[0-9a-f]{64}$' or p_phone_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid_preflight_parameters' using errcode = '22023';
  end if;
  v_phone10 := right(v_phone10, 10);
  -- Bounded per-client and per-target-phone issuance, transactional counters.
  for v_key in
    select key from (
      values ('ip:' || p_identity_hash), ('phone:' || p_phone_hash)
    ) as keys(key) order by key
  loop
    perform pg_advisory_xact_lock(hashtextextended(v_key, 0));
    insert into public.customer_firebase_preflight_attempts(identity_hash,window_started_at,attempt_count)
    values(v_key,now(),1)
    on conflict (identity_hash) do update set
      window_started_at = case when public.customer_firebase_preflight_attempts.window_started_at < now() - interval '1 hour'
        then now() else public.customer_firebase_preflight_attempts.window_started_at end,
      attempt_count = case when public.customer_firebase_preflight_attempts.window_started_at < now() - interval '1 hour'
        then 1 else public.customer_firebase_preflight_attempts.attempt_count+1 end;
  end loop;
  select attempt_count into v_ip_attempts
    from public.customer_firebase_preflight_attempts where identity_hash='ip:'||p_identity_hash;
  select attempt_count into v_phone_attempts
    from public.customer_firebase_preflight_attempts where identity_hash='phone:'||p_phone_hash;
  if v_ip_attempts > 30 or v_phone_attempts > 10 then return 'rate_limited'; end if;

  select count(*) into v_profile_count from public.profiles p
   where p.role='customer' and p.is_active = true
    and right(regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'),10)=v_phone10;
  select count(*) into v_legacy_count from auth.users u
   where right(regexp_replace(coalesce(u.phone,''),'[^0-9]','','g'),10)=v_phone10;

  if v_profile_count = 1 then
    -- An active profile does not mean that old Supabase phone signup finished.
    -- Verified Firebase OTP may complete this SAME customer profile safely,
    -- without creating a duplicate or assigning any staff profile.
    select
      count(*) filter (where u.phone_confirmed_at is not null),
      count(*) filter (where u.phone_confirmed_at is null)
    into v_confirmed_customer_count, v_unconfirmed_customer_count
    from public.profiles p
    left join auth.users u on u.id = p.id
    where p.role='customer' and p.is_active = true
      and right(regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'),10)=v_phone10;
    -- Accept a pre-approved active Firebase mapping for the unique customer
    -- without modifying legacy Supabase phone confirmation.
    if exists (
      select 1 from public.customer_firebase_identity_links l
      join public.profiles p2 on p2.id = l.profile_id
      where l.firebase_project_id = 'insureit-customer-auth'
        and l.is_approved = true and l.is_active = true
        and l.verified_phone_at_approval = '+91' || v_phone10
        and p2.role = 'customer' and p2.is_active = true
        and right(regexp_replace(coalesce(p2.phone,''),'[^0-9]','','g'),10) = v_phone10
    ) then return 'registered'; end if;
    if v_confirmed_customer_count = 1 then return 'registered'; end if;
    if v_unconfirmed_customer_count = 1 then return 'signup_incomplete'; end if;
    return 'account_requires_review';
  end if;
  if v_profile_count > 1 or v_legacy_count > 0 then
    -- Never silently create a duplicate or grant access to an ambiguous master.
    return 'account_requires_review';
  end if;
  return 'not_registered';
end;
$function$

