-- Master records are business contacts, not proof of a prior app login.
-- Preserve all customer master rows and never attach them automatically.
begin;
create or replace function public.customer_firebase_registration_preflight(
  p_phone text, p_identity_hash text, p_phone_hash text
) returns text
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_phone10 text;
  v_ip_attempts integer;
  v_phone_attempts integer;
  v_profile_count integer;
  v_legacy_count integer;
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
    -- Existing Firebase UID bindings are verified only AFTER phone OTP by binder.
    return 'registered';
  end if;
  if v_profile_count > 1 or v_legacy_count > 0 then
    -- Never silently create a duplicate or grant access to an ambiguous master.
    return 'account_requires_review';
  end if;
  return 'not_registered';
end;
$$;

revoke all on function public.customer_firebase_registration_preflight(text,text,text) from public, anon, authenticated;
grant execute on function public.customer_firebase_registration_preflight(text,text,text) to service_role;
commit;
