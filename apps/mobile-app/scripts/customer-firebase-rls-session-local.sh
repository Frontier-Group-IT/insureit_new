#!/usr/bin/env bash
# PostgreSQL 17 synthetic RLS contract test. No production credentials or data.
set -euo pipefail
: "$RLS_TEST_DATABASE_URL"
case "$RLS_TEST_DATABASE_URL" in
  *127.0.0.1:5432/*|*localhost:5432/*) ;;
  *) echo "Refusing non-loopback target" >&2; exit 1 ;;
esac
psql "$RLS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
create role authenticated nologin;
create role anon nologin;
create schema auth;
create function auth.jwt() returns jsonb language sql stable as
$$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
create function auth.uid() returns uuid language sql stable as
$$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create function auth.role() returns text language sql stable as
$$select auth.jwt()->>'role'$$;
create table auth.users(id uuid primary key,phone text,is_anonymous boolean default false,banned_until timestamptz);
create table public.profiles(id uuid primary key,role text not null,is_active boolean not null,phone text);
create table public.customer_firebase_identity_links(
  firebase_project_id text not null,firebase_uid text not null,
  profile_id uuid not null,verified_phone_at_approval text not null,
  is_approved boolean,is_active boolean,approved_at timestamptz);
create table public.customers(id uuid primary key,profile_id uuid not null);
create table public.customer_memberships(customer_id uuid,profile_id uuid,status text);
create table public.customer_records(id uuid primary key,customer_id uuid not null,kind text);
create function public.customer_canonical_indian_phone(v text) returns text
language sql immutable as $$
 select case when regexp_replace(coalesce(v,''),'[^0-9]','','g') ~ '^(91)?[6-9][0-9]{9}$'
 then '+91'||right(regexp_replace(v,'[^0-9]','','g'),10) else null end
$$;
-- Existing production helper placeholder, replaced by the reviewed migration.
create function public.customer_firebase_profile_id() returns uuid
language sql stable as 'select null::uuid';
-- Existing production policy relationship helper; tested with the proposed
-- Supabase UUID session helper, not a Firebase JWT used as a data credential.
create function public.customer_firebase_can_read_customer(v uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select v is not null and public.customer_firebase_profile_id() is not null
 and exists(select 1 from public.customers c where c.id=v and
   (c.profile_id=public.customer_firebase_profile_id() or
    exists(select 1 from public.customer_memberships m where m.customer_id=c.id
      and m.profile_id=public.customer_firebase_profile_id() and m.status='active')))
$$;
grant usage on schema auth,public to authenticated;
grant select on public.customer_records to authenticated;
alter table public.customer_records enable row level security;
create policy synthetic_customer_select on public.customer_records for select to authenticated
using(public.customer_firebase_can_read_customer(customer_id));
insert into public.profiles values
 ('11111111-1111-4111-8111-111111111111','customer',true,'919876543210'),
 ('22222222-2222-4222-8222-222222222222','customer',true,'919111111111'),
 ('33333333-3333-4333-8333-333333333333','it_super_user',true,'919876543210');
insert into auth.users(id,phone) values
 ('11111111-1111-4111-8111-111111111111','919876543210'),
 ('22222222-2222-4222-8222-222222222222','919111111111'),
 ('33333333-3333-4333-8333-333333333333','919876543210');
insert into public.customer_firebase_identity_links values
 ('insureit-customer-auth','firebase-A','11111111-1111-4111-8111-111111111111',
  '+919876543210',true,true,now()),
 ('insureit-customer-auth','firebase-B','22222222-2222-4222-8222-222222222222',
  '+919111111111',true,true,now());
insert into public.customers values
 ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
 ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
insert into public.customer_records values
 ('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','policy'),
 ('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','vehicle'),
 ('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','claim');
SQL
psql "$RLS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/migrations/20261017180000_customer_firebase_supabase_session_rls_helper.sql

ISS='https://ilzhsfqqjyppzzvfscmh.supabase.co/auth/v1'
A='11111111-1111-4111-8111-111111111111'
B='22222222-2222-4222-8222-222222222222'
STAFF='33333333-3333-4333-8333-333333333333'
query_count() {
  local who="$1" issuer="$2" role="$3"
  psql "$RLS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "
    set role authenticated;
    select set_config('request.jwt.claim.sub','$who',false);
    select set_config('request.jwt.claims',
      '{\"iss\":\"$issuer\",\"role\":\"$role\",\"aud\":\"authenticated\"}',false);
    select count(*) from public.customer_records;" | tail -n 1
}
assert_count() {
  local actual
  actual="$(query_count "$1" "$2" "$3")"
  [[ "$actual" == "$4" ]] || {
    echo "Synthetic Customer RLS count assertion failed" >&2; exit 1;
  }
}
assert_count "$A" "$ISS" authenticated 2
assert_count "$B" "$ISS" authenticated 1
# Staff sharing Customer A's phone gets NO Customer A records.
assert_count "$STAFF" "$ISS" authenticated 0
# Firebase JWT issuer must NEVER access PostgREST as a Supabase session.
assert_count "$A" 'https://securetoken.google.com/insureit-customer-auth' authenticated 0
assert_count "$A" "$ISS" anon 0
psql "$RLS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qc "
 update public.customer_firebase_identity_links set is_active=false
 where profile_id='$A';"
assert_count "$A" "$ISS" authenticated 0
psql "$RLS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qc "
 update public.customer_firebase_identity_links set is_active=true,
 verified_phone_at_approval='+919900000000' where profile_id='$A';"
assert_count "$A" "$ISS" authenticated 0
psql "$RLS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qc "
 update public.customer_firebase_identity_links
 set verified_phone_at_approval='+919876543210' where profile_id='$A';
 insert into public.customer_firebase_identity_links values
 ('insureit-customer-auth','duplicated-A','$A','+919876543210',true,true,now());"
assert_count "$A" "$ISS" authenticated 0
psql "$RLS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -qc "
 delete from public.customer_firebase_identity_links where firebase_uid='duplicated-A';"
assert_count "$A" "$ISS" authenticated 2
psql "$RLS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
  -f supabase/rollback/20261017180000_customer_firebase_supabase_session_rls_helper_down.sql
assert_count "$A" "$ISS" authenticated 0
echo 'PASS: synthetic original Supabase UUID Customer A/B RLS isolation, shared staff phone denial, UID revocation, duplicate fail-close and rollback'
