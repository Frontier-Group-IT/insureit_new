-- Customer OTP-only session bridge throttle. REVIEW/DEPLOY SEPARATELY.
-- Additive, single public table protected by RLS and service_role-only grants.
-- DO NOT apply until full release approval; old 0.3.0 does not depend on this.
-- Rollback: DROP FUNCTION public.customer_firebase_session_exchange_consume(text, integer);
--           DROP TABLE public.customer_firebase_session_exchange_limits;
create table if not exists public.customer_firebase_session_exchange_limits (
  firebase_uid text primary key,
  next_allowed_at timestamptz not null
);

alter table public.customer_firebase_session_exchange_limits enable row level security;
revoke all on public.customer_firebase_session_exchange_limits from public, anon, authenticated;
grant select, insert, update, delete on public.customer_firebase_session_exchange_limits to service_role;

-- Atomic INSERT ... ON CONFLICT WHERE conditional UPDATE. Concurrent identical
-- requests cannot both create a sign-in challenge inside the same period.
create or replace function public.customer_firebase_session_exchange_consume(
  p_firebase_uid text,
  p_interval_seconds integer default 120
) returns boolean
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  v_allowed boolean;
begin
  if p_firebase_uid is null or length(p_firebase_uid) < 2 or length(p_firebase_uid) > 128
     or p_interval_seconds < 60 or p_interval_seconds > 3600 then
    return false;
  end if;
  insert into public.customer_firebase_session_exchange_limits(firebase_uid,next_allowed_at)
    values (p_firebase_uid, now() + make_interval(secs => p_interval_seconds))
  on conflict (firebase_uid) do update
      set next_allowed_at = excluded.next_allowed_at
    where public.customer_firebase_session_exchange_limits.next_allowed_at <= now()
  returning true into v_allowed;
  return coalesce(v_allowed, false);
end;
$$;
revoke all on function public.customer_firebase_session_exchange_consume(text, integer) from public, anon, authenticated;
grant execute on function public.customer_firebase_session_exchange_consume(text, integer) to service_role;

comment on table public.customer_firebase_session_exchange_limits
  is 'Privileged-only one-use Customer Firebase verified-phone session exchange rate limiter. No contact PII; rollout-gated.';
