#!/usr/bin/env bash
# Disposable synthetic PostgreSQL 17 ONLY. Never supply production DB URL.
set -euo pipefail
: "$REVIEW_TEST_DATABASE_URL"
case "$REVIEW_TEST_DATABASE_URL" in
  *127.0.0.1:5432/*|*localhost:5432/*) ;;
  *) echo "Refusing nonlocal database" >&2; exit 1 ;;
esac
export PGOPTIONS="-c client_min_messages=warning"
psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create function auth.role() returns text language sql stable
as $$select current_setting('request.jwt.claim.role',true)$$;
grant usage on schema auth,public to anon,authenticated,service_role;
create table public.profiles(id uuid primary key,role text not null,is_active boolean not null,phone text);
create table auth.users(id uuid primary key, phone text);
grant select on public.profiles to service_role;
insert into public.profiles values
 ('11111111-1111-4111-8111-111111111111','customer',true,'919876543210'),
 ('22222222-2222-4222-8222-222222222222','it_super_user',true,'911234567890'),
 ('33333333-3333-4333-8333-333333333333','it_super_user',true,'919999999999'),
 ('44444444-4444-4444-8444-444444444444','it_super_user',true,'919876543210'),
 ('55555555-5555-4555-8555-555555555555','customer',true,'919876543210'),
 ('66666666-6666-4666-8666-666666666666','customer',true,'919123456789');
insert into auth.users values
 ('11111111-1111-4111-8111-111111111111','919876543210'),
 ('44444444-4444-4444-8444-444444444444','919876543210'),
 -- Orphan Auth row using same number: must count as a non-Customer
 ('77777777-7777-4777-8777-777777777777','919876543210'),
 -- Orphan/Auth-only conflict on otherwise unique Customer #6666
 ('88888888-8888-4888-8888-888888888888','919123456789');
SQL

psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261017120000_customer_firebase_operator_review_and_collisions.sql
test "$(psql "$REVIEW_TEST_DATABASE_URL" -At -c "set request.jwt.claim.role='service_role';select non_customer_count::text||':'||other_customer_count::text from public.customer_firebase_phone_collision_counts('11111111-1111-4111-8111-111111111111')")" = 

# Profile-only comparisons would MISS this Customer: its number is unique in
# profiles, but a second auth.users principal has the same confirmed phone.
test "$(psql "$REVIEW_TEST_DATABASE_URL" -At -c "set request.jwt.claim.role='service_role';select non_customer_count::text||':'||other_customer_count::text from public.customer_firebase_phone_collision_counts('66666666-6666-4666-8666-666666666666')")" = 
if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.customer_firebase_enrollment_reviews
 (customer_profile_id,uid_digest,decision,reviewer_id,evidence_digest,
  consent_at,ownership_verified_at,expires_at)
 values ('11111111-1111-4111-8111-111111111111',repeat('a',64),'approved',
 '22222222-2222-4222-8222-222222222222',repeat('b',64),
 now()-interval '5 minutes',now()-interval '5 minutes',now()+interval '1 day');
SQL
then echo "ERROR: shared-phone insert permitted without second reviewer" >&2; exit 1
fi

psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.customer_firebase_enrollment_reviews
 (customer_profile_id,uid_digest,decision,reviewer_id,second_reviewer_id,
  evidence_digest,consent_at,ownership_verified_at,recovery_verified_at,expires_at)
 values ('11111111-1111-4111-8111-111111111111',repeat('a',64),'approved',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',repeat('b',64),
 now()-interval '10 minutes',now()-interval '8 minutes',
 now()-interval '7 minutes',now()+interval '1 day');
SQL

if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='service_role';
update public.customer_firebase_enrollment_reviews set decision='revoked' where customer_profile_id='11111111-1111-4111-8111-111111111111';
SQL
then echo "ERROR: audit UPDATE unexpectedly succeeded" >&2; exit 1
fi

if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='anon';
set role anon;
select * from public.customer_firebase_phone_collision_counts('11111111-1111-4111-8111-111111111111');
SQL
then echo "ERROR: anonymous phone collision RPC unexpectedly succeeded" >&2; exit 1
fi

psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/rollback/20261017120000_customer_firebase_operator_review_and_collisions_down.sql
test "$(psql "$REVIEW_TEST_DATABASE_URL" -Atc "select count(*) from public.customer_firebase_enrollment_reviews")" = "1"
test "$(psql "$REVIEW_TEST_DATABASE_URL" -Atc "select count(*) from pg_proc where proname='customer_firebase_phone_collision_counts'")" = "0"
echo 'PASS: synthetic approval, staff and orphan Auth phone collision, immutable audit, restricted RPC and data-preserving rollback'
SET\n2:1'

# A shared Customer+staff phone requires a second privileged reviewer.
if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.customer_firebase_enrollment_reviews
 (customer_profile_id,uid_digest,decision,reviewer_id,evidence_digest,
  consent_at,ownership_verified_at,expires_at)
 values ('11111111-1111-4111-8111-111111111111',repeat('a',64),'approved',
 '22222222-2222-4222-8222-222222222222',repeat('b',64),
 now()-interval '5 minutes',now()-interval '5 minutes',now()+interval '1 day');
SQL
then echo "ERROR: shared-phone insert permitted without second reviewer" >&2; exit 1
fi

psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.customer_firebase_enrollment_reviews
 (customer_profile_id,uid_digest,decision,reviewer_id,second_reviewer_id,
  evidence_digest,consent_at,ownership_verified_at,recovery_verified_at,expires_at)
 values ('11111111-1111-4111-8111-111111111111',repeat('a',64),'approved',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',repeat('b',64),
 now()-interval '10 minutes',now()-interval '8 minutes',
 now()-interval '7 minutes',now()+interval '1 day');
SQL

if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='service_role';
update public.customer_firebase_enrollment_reviews set decision='revoked' where customer_profile_id='11111111-1111-4111-8111-111111111111';
SQL
then echo "ERROR: audit UPDATE unexpectedly succeeded" >&2; exit 1
fi

if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='anon';
set role anon;
select * from public.customer_firebase_phone_collision_counts('11111111-1111-4111-8111-111111111111');
SQL
then echo "ERROR: anonymous phone collision RPC unexpectedly succeeded" >&2; exit 1
fi

psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/rollback/20261017120000_customer_firebase_operator_review_and_collisions_down.sql
test "$(psql "$REVIEW_TEST_DATABASE_URL" -Atc "select count(*) from public.customer_firebase_enrollment_reviews")" = "1"
test "$(psql "$REVIEW_TEST_DATABASE_URL" -Atc "select count(*) from pg_proc where proname='customer_firebase_phone_collision_counts'")" = "0"
echo 'PASS: synthetic approval, staff phone collision, immutable audit, restricted RPC and data-preserving rollback'
SET\n1:0'
if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.customer_firebase_enrollment_reviews
 (customer_profile_id,uid_digest,decision,reviewer_id,evidence_digest,
  consent_at,ownership_verified_at,expires_at)
 values ('66666666-6666-4666-8666-666666666666',repeat('c',64),'approved',
 '22222222-2222-4222-8222-222222222222',repeat('d',64),
 now()-interval '5 minutes',now()-interval '5 minutes',now()+interval '1 day');
SQL
then echo "ERROR: orphan Auth phone collision permitted single-review" >&2; exit 1
fi

# A shared Customer+staff phone requires a second privileged reviewer.
if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.customer_firebase_enrollment_reviews
 (customer_profile_id,uid_digest,decision,reviewer_id,evidence_digest,
  consent_at,ownership_verified_at,expires_at)
 values ('11111111-1111-4111-8111-111111111111',repeat('a',64),'approved',
 '22222222-2222-4222-8222-222222222222',repeat('b',64),
 now()-interval '5 minutes',now()-interval '5 minutes',now()+interval '1 day');
SQL
then echo "ERROR: shared-phone insert permitted without second reviewer" >&2; exit 1
fi

psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.customer_firebase_enrollment_reviews
 (customer_profile_id,uid_digest,decision,reviewer_id,second_reviewer_id,
  evidence_digest,consent_at,ownership_verified_at,recovery_verified_at,expires_at)
 values ('11111111-1111-4111-8111-111111111111',repeat('a',64),'approved',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',repeat('b',64),
 now()-interval '10 minutes',now()-interval '8 minutes',
 now()-interval '7 minutes',now()+interval '1 day');
SQL

if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='service_role';
update public.customer_firebase_enrollment_reviews set decision='revoked' where customer_profile_id='11111111-1111-4111-8111-111111111111';
SQL
then echo "ERROR: audit UPDATE unexpectedly succeeded" >&2; exit 1
fi

if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='anon';
set role anon;
select * from public.customer_firebase_phone_collision_counts('11111111-1111-4111-8111-111111111111');
SQL
then echo "ERROR: anonymous phone collision RPC unexpectedly succeeded" >&2; exit 1
fi

psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/rollback/20261017120000_customer_firebase_operator_review_and_collisions_down.sql
test "$(psql "$REVIEW_TEST_DATABASE_URL" -Atc "select count(*) from public.customer_firebase_enrollment_reviews")" = "1"
test "$(psql "$REVIEW_TEST_DATABASE_URL" -Atc "select count(*) from pg_proc where proname='customer_firebase_phone_collision_counts'")" = "0"
echo 'PASS: synthetic approval, staff phone collision, immutable audit, restricted RPC and data-preserving rollback'
SET\n2:1'

# A shared Customer+staff phone requires a second privileged reviewer.
if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.customer_firebase_enrollment_reviews
 (customer_profile_id,uid_digest,decision,reviewer_id,evidence_digest,
  consent_at,ownership_verified_at,expires_at)
 values ('11111111-1111-4111-8111-111111111111',repeat('a',64),'approved',
 '22222222-2222-4222-8222-222222222222',repeat('b',64),
 now()-interval '5 minutes',now()-interval '5 minutes',now()+interval '1 day');
SQL
then echo "ERROR: shared-phone insert permitted without second reviewer" >&2; exit 1
fi

psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
set request.jwt.claim.role='service_role';
insert into public.customer_firebase_enrollment_reviews
 (customer_profile_id,uid_digest,decision,reviewer_id,second_reviewer_id,
  evidence_digest,consent_at,ownership_verified_at,recovery_verified_at,expires_at)
 values ('11111111-1111-4111-8111-111111111111',repeat('a',64),'approved',
 '22222222-2222-4222-8222-222222222222',
 '33333333-3333-4333-8333-333333333333',repeat('b',64),
 now()-interval '10 minutes',now()-interval '8 minutes',
 now()-interval '7 minutes',now()+interval '1 day');
SQL

if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='service_role';
update public.customer_firebase_enrollment_reviews set decision='revoked' where customer_profile_id='11111111-1111-4111-8111-111111111111';
SQL
then echo "ERROR: audit UPDATE unexpectedly succeeded" >&2; exit 1
fi

if psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 >/dev/null 2>&1 <<'SQL'
set request.jwt.claim.role='anon';
set role anon;
select * from public.customer_firebase_phone_collision_counts('11111111-1111-4111-8111-111111111111');
SQL
then echo "ERROR: anonymous phone collision RPC unexpectedly succeeded" >&2; exit 1
fi

psql "$REVIEW_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/rollback/20261017120000_customer_firebase_operator_review_and_collisions_down.sql
test "$(psql "$REVIEW_TEST_DATABASE_URL" -Atc "select count(*) from public.customer_firebase_enrollment_reviews")" = "1"
test "$(psql "$REVIEW_TEST_DATABASE_URL" -Atc "select count(*) from pg_proc where proname='customer_firebase_phone_collision_counts'")" = "0"
echo 'PASS: synthetic approval, staff phone collision, immutable audit, restricted RPC and data-preserving rollback'
