#!/usr/bin/env bash
# Disposable PostgreSQL policy-shape test. NEVER target production.
set -euo pipefail
: "$RLS_TEST_DATABASE_URL"
case "$RLS_TEST_DATABASE_URL" in
  *'@127.0.0.1:5432/'*|*'@localhost:5432/'*) ;;
  *) echo 'Refusing non-loopback target' >&2; exit 1 ;;
esac
psql "$RLS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
create role authenticated nologin;
create role anon nologin;
create schema auth;
create schema storage;
create function auth.uid() returns uuid language sql stable
as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.customers(id uuid primary key,profile_id uuid);
create table public.customer_memberships(customer_id uuid,profile_id uuid,status text);
create table public.vehicles(id uuid,customer_id uuid);
create table public.policies(id uuid,customer_id uuid);
create table public.claims(id uuid,customer_id uuid);
create table public.customer_onboarding_applications(id uuid,profile_id uuid);
create table public.policy_documents(policy_id uuid,storage_path text);
create table public.claim_documents(customer_id uuid,storage_path text);
create table storage.objects(bucket_id text,name text);
create function public.can_access_customer(v uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.customer_memberships m
 where m.customer_id=v and m.profile_id=auth.uid() and m.status='active')$$;
create function public.can_access_customer(viewer uuid,target uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select viewer=auth.uid() and exists(
 select 1 from public.customers c where c.id=target and c.profile_id=viewer)$$;
alter table public.customers enable row level security;
alter table public.vehicles enable row level security;
alter table public.policies enable row level security;
alter table public.claims enable row level security;
alter table public.customer_onboarding_applications enable row level security;
alter table storage.objects enable row level security;
-- Representative live permissive OR-policy shapes, not full production parity.
create policy own_or_member on public.customers for select to authenticated
using(profile_id=auth.uid() or public.can_access_customer(id));
create policy vehicles_owner on public.vehicles for select to authenticated
using(public.can_access_customer(auth.uid(),customer_id));
create policy vehicles_member on public.vehicles for select to authenticated
using(public.can_access_customer(customer_id));
create policy policies_owner on public.policies for select to authenticated
using(public.can_access_customer(auth.uid(),customer_id));
create policy policies_member on public.policies for select to authenticated
using(public.can_access_customer(customer_id));
create policy claims_owner on public.claims for select to authenticated
using(public.can_access_customer(auth.uid(),customer_id));
create policy claims_member on public.claims for select to authenticated
using(public.can_access_customer(customer_id));
create policy onboarding_self on public.customer_onboarding_applications
for select to authenticated using(profile_id=auth.uid());
create policy storage_customer_self on storage.objects for select to public
using(bucket_id='customer-documents' and exists(select 1 from public.customers c
 where c.profile_id=auth.uid() and split_part(name,'/',1)=c.id::text));
create policy storage_application_self on storage.objects for select to authenticated
using(bucket_id='customer-documents' and exists(
 select 1 from public.customer_onboarding_applications a
 where a.profile_id=auth.uid() and split_part(name,'/',1)=a.id::text));
create policy storage_policy_self on storage.objects for select to authenticated
using(bucket_id='policy-documents' and exists(select 1
 from public.policy_documents d join public.policies p on p.id=d.policy_id
 join public.customers c on c.id=p.customer_id
 where d.storage_path=name and c.profile_id=auth.uid()));
create policy storage_claim_member on storage.objects for select to authenticated
using(bucket_id='claim-documents' and exists(select 1 from public.claim_documents d
 where d.storage_path=name and public.can_access_customer(d.customer_id)));
grant usage on schema public,auth,storage to authenticated,anon;
grant select on public.customers,public.vehicles,public.policies,public.claims,
public.customer_onboarding_applications,storage.objects to authenticated,anon;
insert into public.customers values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','11111111-1111-4111-8111-111111111111'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','22222222-2222-4222-8222-222222222222');
insert into public.vehicles values
('aaaaaaaa-0000-4000-8000-000000000001','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-0000-4000-8000-000000000001','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.policies values
('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-0000-4000-8000-000000000002','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.claims values
('aaaaaaaa-0000-4000-8000-000000000003','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
('bbbbbbbb-0000-4000-8000-000000000003','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
insert into public.customer_onboarding_applications values
('aaaaaaaa-0000-4000-8000-000000000004','11111111-1111-4111-8111-111111111111'),
('bbbbbbbb-0000-4000-8000-000000000004','22222222-2222-4222-8222-222222222222');
insert into public.policy_documents values
('aaaaaaaa-0000-4000-8000-000000000002','aaaaaaaa-doc.pdf'),
('bbbbbbbb-0000-4000-8000-000000000002','bbbbbbbb-doc.pdf');
insert into public.claim_documents values
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','aaaaaaaa-claim.pdf'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','bbbbbbbb-claim.pdf');
insert into storage.objects values
('customer-documents','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/id.pdf'),
('customer-documents','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb/id.pdf'),
('customer-documents','aaaaaaaa-0000-4000-8000-000000000004/app.pdf'),
('customer-documents','bbbbbbbb-0000-4000-8000-000000000004/app.pdf'),
('policy-documents','aaaaaaaa-doc.pdf'),('policy-documents','bbbbbbbb-doc.pdf'),
('claim-documents','aaaaaaaa-claim.pdf'),('claim-documents','bbbbbbbb-claim.pdf');
SQL
A='11111111-1111-4111-8111-111111111111'
B='22222222-2222-4222-8222-222222222222'
STAFF='33333333-3333-4333-8333-333333333333'
counts() {
 local uid="$1" role="$2"
 psql "$RLS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -Atqc "
 set role $role;
 select set_config('request.jwt.claim.sub','$uid',false);
 select (select count(*) from public.customers)::text||'|'||
 (select count(*) from public.vehicles)||'|'||
 (select count(*) from public.policies)||'|'||
 (select count(*) from public.claims)||'|'||
 (select count(*) from public.customer_onboarding_applications)||'|'||
 (select count(*) from storage.objects);" | tail -n1
}
assert_counts() {
 local got
 got="$(counts "$1" "$2")"
 [[ "$got" == "$3" ]] || {
 echo "RLS and Storage scope mismatch: $got != $3" >&2; exit 1; }
}
assert_counts "$A" authenticated '1|1|1|1|1|4'
assert_counts "$B" authenticated '1|1|1|1|1|4'
assert_counts "$STAFF" authenticated '0|0|0|0|0|0'
assert_counts "$A" anon '0|0|0|0|0|0'
psql "$RLS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "
insert into public.customer_memberships values
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','$A','active')"
assert_counts "$A" authenticated '2|2|2|2|1|5'
psql "$RLS_TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "
update public.customer_memberships set status='revoked' where profile_id='$A'"
assert_counts "$A" authenticated '1|1|1|1|1|4'
echo 'PASS disposable representative Customer A/B policy, membership revocation and Storage path isolation; NOT full production parity.'
