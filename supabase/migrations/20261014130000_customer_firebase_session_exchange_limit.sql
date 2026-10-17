-- INSUREIT Customer Firebase SMS -> Supabase Auth session gate.
-- PRE-DEPLOYMENT REVIEW ONLY: additive, never apply as a side-effect of merging.
-- Local CI MUST validate grants, concurrent attempts and replay protection.
-- Rate limit + Firebase auth_time single-use guard. No phone/OTP/email stored.
-- Rollback: DROP FUNCTION public.customer_firebase_session_exchange_consume(text,bigint,integer);
--           DROP TABLE public.customer_firebase_session_exchange_limits;
create table if not exists public.customer_firebase_session_exchange_limits (
  firebase_uid text primary key,
  last_auth_time bigint not null,
  next_allowed_at timestamptz not null
);

alter table public.customer_firebase_session_exchange_limits enable row level security;
revoke all on public.customer_firebase_session_exchange_limits from public, anon, authenticated;
grant select, insert, update, delete on public.customer_firebase_session_exchange_limits to service_role;

-- Atomic consumption. A Firebase ID token can be refreshed repeatedly but
-- Firebase auth_time remains the same for that PHONE sign-in event. Consume
-- the same event only once, even after the cooldown expires. A new SMS sign-in
-- must have a strictly newer auth_time and pass the cooldown. Concurrent
-- requests for a UID cannot both return true.
create or replace function public.customer_firebase_session_exchange_consume(
  p_firebase_uid text,
  p_auth_time bigint,
  p_interval_seconds integer default 120
) returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_allowed boolean;
  v_now bigint := floor(extract(epoch from now()))::bigint;
begin
  if p_firebase_uid is null or length(p_firebase_uid) < 2 or length(p_firebase_uid) > 128
     or p_auth_time is null or p_auth_time > v_now + 30 or p_auth_time < v_now - 300
     or p_interval_seconds is null or p_interval_seconds < 60 or p_interval_seconds > 3600 then
    return false;
  end if;

  insert into public.customer_firebase_session_exchange_limits(
    firebase_uid, last_auth_time, next_allowed_at
  ) values (
    p_firebase_uid, p_auth_time,
    now() + make_interval(secs => p_interval_seconds)
  )
  on conflict (firebase_uid) do update
    set last_auth_time = excluded.last_auth_time,
        next_allowed_at = excluded.next_allowed_at
    where public.customer_firebase_session_exchange_limits.next_allowed_at <= now()
      and public.customer_firebase_session_exchange_limits.last_auth_time < excluded.last_auth_time
  returning true into v_allowed;

  return coalesce(v_allowed, false);
end;
$$;

revoke all on function public.customer_firebase_session_exchange_consume(text,bigint,integer)
  from public, anon, authenticated;
grant execute on function public.customer_firebase_session_exchange_consume(text,bigint,integer)
  to service_role;

comment on table public.customer_firebase_session_exchange_limits is
  'Service-only Firebase phone sign-in single-use and cooldown gate; stores UID/auth_time, no OTP, phone, email or bearer token.';
