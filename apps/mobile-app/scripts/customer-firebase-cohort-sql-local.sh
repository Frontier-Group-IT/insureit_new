#!/usr/bin/env bash
# SOURCE ONLY: against disposable container PostgreSQL 17; NO Supabase production.
set -euo pipefail
: "$REVIEW_TEST_DATABASE_URL"
case "$REVIEW_TEST_DATABASE_URL" in
  *127.0.0.1:5432/*|*localhost:5432/*) ;;
  *) echo 'Refusing database outside disposable localhost' >&2; exit 1 ;;
esac
psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.role() returns text language sql stable
 as $$select current_setting('request.jwt.claim.role',true)$$;
grant usage on schema auth,public to anon,authenticated,service_role;
create table public.profiles(id uuid primary key,role text not null,is_active boolean not null,phone text);
create table auth.users(id uuid primary key,phone text,email text,email_confirmed_at timestamptz);
create table public.customer_firebase_identity_links(
 firebase_project_id text not null,firebase_uid text not null,
 profile_id uuid not null references public.profiles(id),
 verified_phone_at_approval text not null, approved_at timestamptz,
 is_approved boolean not null,is_active boolean not null,
 primary key(firebase_project_id,firebase_uid),unique(profile_id));
grant select on public.profiles to service_role;
grant select on auth.users to service_role;
grant select,insert on public.customer_firebase_identity_links to service_role;
insert into public.profiles values
 ('11111111-1111-4111-8111-111111111111','customer',true,'919876543210'),
 ('22222222-2222-4222-8222-222222222222','it_super_user',true,'919111111111'),
 ('33333333-3333-4333-8333-333333333333','it_super_user',true,'919222222222'),
 ('44444444-4444-4444-8444-444444444444','it_super_user',true,'919876543210');
insert into auth.users values
 ('11111111-1111-4111-8111-111111111111','919876543210',
  'c-11111111-1111-4111-8111-111111111111@customer-login.insureit.invalid',now());
SQL
for f in \
 supabase/migrations/20261016150000_customer_firebase_migration_audit.sql \
 supabase/migrations/20261016162000_customer_firebase_enrollment_atomic.sql \
 supabase/migrations/20261017120000_customer_firebase_operator_review_and_collisions.sql \
 supabase/migrations/20261017150000_customer_firebase_rollout_controls.sql \
 supabase/migrations/20261017160000_customer_firebase_enroll_reviewed_rpc.sql
do psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done

psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
set request.jwt.claim.role='service_role';
-- Every migration is default closed; operator has not switched any cohorts on.
do $test$
begin
 if not exists(select 1 from public.customer_firebase_rollout_control
   where enabled is false and paused is true) then
   raise exception 'rollout_control_not_closed';
 end if;
 if has_function_privilege('service_role',
   'public.customer_firebase_enroll_approved(uuid,text,text,uuid,text)','EXECUTE') then
   raise exception 'older_broad_enrollment_rpc_still_public_to_service_role';
 end if;
end;$test$;

-- Shared staff phone requires second verified active IT Super User.
insert into public.customer_firebase_enrollment_reviews
 (customer_profile_id,uid_digest,decision,reviewer_id,second_reviewer_id,
  evidence_digest,consent_at,ownership_verified_at,recovery_verified_at,expires_at)
values
 ('11111111-1111-4111-8111-111111111111',
  pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(
   'insureit-customer-auth:verified-synthetic-uid','UTF8')),'hex'),
  'approved','22222222-2222-4222-8222-222222222222',
  '33333333-3333-4333-8333-333333333333',repeat('a',64),
  now()-interval '10 minutes',now()-interval '9 minutes',
  now()-interval '8 minutes',now()+interval '1 day');

do $test$
declare result text;
begin
 result := public.customer_firebase_enroll_reviewed(
 '11111111-1111-4111-8111-111111111111','verified-synthetic-uid',
 '+919876543210','22222222-2222-4222-8222-222222222222',repeat('a',64));
 if result <> 'enrolled' then raise exception 'expected_enrolled'; end if;
 result := public.customer_firebase_enroll_reviewed(
 '11111111-1111-4111-8111-111111111111','verified-synthetic-uid',
 '+919876543210','22222222-2222-4222-8222-222222222222',repeat('a',64));
 if result <> 'already_approved' then raise exception 'idempotency_failed'; end if;
 if (select count(*) from public.customer_firebase_identity_links) <> 1 or
    (select count(*) from public.customer_firebase_migration_audit) <> 1 then
    raise exception 'atomic_enrollment_or_audit_mismatch';
 end if;
end;$test$;

-- Revocation (append only) overrides all prior approvals.
insert into public.customer_firebase_enrollment_reviews
 (customer_profile_id,uid_digest,decision,reviewer_id,evidence_digest,expires_at)
values(
 '11111111-1111-4111-8111-111111111111',repeat('b',64),'revoked',
 '22222222-2222-4222-8222-222222222222',repeat('a',64),now()+interval '1 day');

do $test$
declare denied boolean := false;
begin
 begin
   perform public.customer_firebase_enroll_reviewed(
    '11111111-1111-4111-8111-111111111111','verified-synthetic-uid',
    '+919876543210','22222222-2222-4222-8222-222222222222',repeat('a',64));
 exception when others then
   if SQLERRM = 'independent_review_not_approved' then denied:=true;
   else raise; end if;
 end;
 if not denied then raise exception 'revocation_not_enforced'; end if;
end;$test$;
SQL

for f in \
 supabase/rollback/20261017160000_customer_firebase_enroll_reviewed_rpc_down.sql \
 supabase/rollback/20261017120000_customer_firebase_operator_review_and_collisions_down.sql
do psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f" >/dev/null; done
test "$(psql "$REVIEW_TEST_DATABASE_URL" -Atqc \
 'select count(*) from public.customer_firebase_identity_links')" = '1'
test "$(psql "$REVIEW_TEST_DATABASE_URL" -Atqc \
 'select count(*) from public.customer_firebase_migration_audit')" = '1'
test "$(psql "$REVIEW_TEST_DATABASE_URL" -Atqc \
 'select count(*) from public.customer_firebase_enrollment_reviews')" = '2'
test "$(psql "$REVIEW_TEST_DATABASE_URL" -Atqc \
 "select count(*) from pg_proc where proname='customer_firebase_enroll_reviewed'")" = '0'
echo 'PASS: local same-UUID reviewed atomic link, shared phone, idempotency, revocation, closed cohort and preserved rollback'
