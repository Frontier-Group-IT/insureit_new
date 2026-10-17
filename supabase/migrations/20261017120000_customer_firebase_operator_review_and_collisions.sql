-- SOURCE ONLY / PREPARED DDL. NOT APPROVED OR APPLIED TO PRODUCTION.
-- Dependent on existing canonical profiles and Supabase Auth. No Auth writes.
-- No mobile/public endpoint uses this table or RPC yet.
begin;

create table if not exists public.customer_firebase_enrollment_reviews (
  id bigint generated always as identity primary key,
  customer_profile_id uuid not null references public.profiles(id) on delete restrict,
  -- SHA256("insureit-customer-auth:" || Firebase UID), never raw Firebase UID.
  uid_digest text not null check (uid_digest ~ '^[a-f0-9]{64}$'),
  decision text not null check (decision in ('approved','denied','revoked')),
  reviewer_id uuid not null references public.profiles(id) on delete restrict,
  second_reviewer_id uuid references public.profiles(id) on delete restrict,
  evidence_digest text not null check (evidence_digest ~ '^[a-f0-9]{64}$'),
  consent_at timestamptz,
  ownership_verified_at timestamptz,
  recovery_verified_at timestamptz,
  cohort_approved_at timestamptz,
  reviewed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint customer_firebase_review_secondary_separation
    check (second_reviewer_id is null or second_reviewer_id <> reviewer_id),
  constraint customer_firebase_approved_proof_required
    check (decision <> 'approved' or
      (consent_at is not null and ownership_verified_at is not null)),
  constraint customer_firebase_review_time_order
    check (expires_at > reviewed_at and expires_at <= reviewed_at + interval '14 days'),
  constraint customer_firebase_review_cohort_recovery_required
    check (cohort_approved_at is null or recovery_verified_at is not null)
);

create index if not exists customer_firebase_review_latest_customer_idx
  on public.customer_firebase_enrollment_reviews(customer_profile_id, id desc);
create index if not exists customer_firebase_review_uid_digest_idx
  on public.customer_firebase_enrollment_reviews(uid_digest, id desc);

alter table public.customer_firebase_enrollment_reviews enable row level security;
revoke all on public.customer_firebase_enrollment_reviews from public, anon, authenticated;
revoke all on sequence public.customer_firebase_enrollment_reviews_id_seq from public, anon, authenticated;
grant select, insert on public.customer_firebase_enrollment_reviews to service_role;
grant usage, select on sequence public.customer_firebase_enrollment_reviews_id_seq to service_role;

-- Validate reviewers independently in the database as a second defensive gate.
-- This is not a substitute for server-side verified operator session proof.
create or replace function public.customer_firebase_review_insert_guard()
returns trigger language plpgsql security invoker set search_path = '' as $body$
declare
  v_staff_count integer;
  v_other_customer_count integer;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = new.customer_profile_id and role = 'customer' and is_active is true
  ) then
    raise exception 'canonical_customer_not_active';
  end if;
  if new.reviewer_id = new.customer_profile_id or not exists (
    select 1 from public.profiles
    where id = new.reviewer_id and role = 'it_super_user' and is_active is true
  ) then
    raise exception 'privileged_review_required';
  end if;
  if new.second_reviewer_id is not null and
    (new.second_reviewer_id = new.customer_profile_id or not exists (
      select 1 from public.profiles
      where id = new.second_reviewer_id and role = 'it_super_user'
        and is_active is true
    )) then
    raise exception 'independent_second_reviewer_required';
  end if;
  if new.consent_at > new.reviewed_at or
      new.ownership_verified_at > new.reviewed_at or
      new.recovery_verified_at > new.reviewed_at or
      new.cohort_approved_at > new.reviewed_at then
    raise exception 'future_dated_review_evidence';
  end if;
  if new.decision = 'approved' then
    select c.non_customer_count,c.other_customer_count
    into v_staff_count,v_other_customer_count
    from public.customer_firebase_phone_collision_counts(new.customer_profile_id) c;
    if v_staff_count > 0 or v_other_customer_count > 0 then
      if new.second_reviewer_id is null then
        raise exception 'shared_phone_second_reviewer_required';
      end if;
    end if;
  end if;
  return new;
end;
$body$;
revoke all on function public.customer_firebase_review_insert_guard()
  from public, anon, authenticated;
drop trigger if exists trg_customer_firebase_review_insert_guard
  on public.customer_firebase_enrollment_reviews;
create trigger trg_customer_firebase_review_insert_guard
before insert on public.customer_firebase_enrollment_reviews
for each row execute function public.customer_firebase_review_insert_guard();

-- Every review is immutable, including service-role DML. New decisions (such
-- as REVOCATION) are appended and override prior approval by descending id.
create or replace function public.customer_firebase_review_append_only()
returns trigger language plpgsql set search_path = '' as $body$
begin
  raise exception 'firebase_review_immutable';
end;
$body$;
revoke all on function public.customer_firebase_review_append_only()
  from public, anon, authenticated;
drop trigger if exists trg_customer_firebase_reviews_immutable
  on public.customer_firebase_enrollment_reviews;
create trigger trg_customer_firebase_reviews_immutable
before update or delete on public.customer_firebase_enrollment_reviews
for each row execute function public.customer_firebase_review_append_only();

-- Restricted server collision count. Normalizes both plain and +91 prefixes
-- and counts ALL profiles, including inactive; no phones/UUIDs are returned.
create or replace function public.customer_firebase_phone_collision_counts(
  p_customer_id uuid
)
returns table(non_customer_count integer,other_customer_count integer)
language plpgsql security definer
set search_path = ''
as $body$
declare
  v_phone_digits text;
  v_phone text;
begin
  if auth.role() is distinct from 'service_role' then
    raise exception 'service_role_required';
  end if;
  select pg_catalog.regexp_replace(coalesce(phone,''),'[^0-9]','','g')
  into v_phone_digits from public.profiles
  where id=p_customer_id and role='customer' and is_active is true;
  if v_phone_digits is null or v_phone_digits !~ '^(91)?[6-9][0-9]{9}$' then
    raise exception 'canonical_customer_phone_missing';
  end if;
  v_phone := right(v_phone_digits,10);
  return query
  select
    count(*) filter (where role is distinct from 'customer')::integer,
    count(*) filter (where role = 'customer')::integer
  from public.profiles p
  where p.id <> p_customer_id
    and pg_catalog.regexp_replace(coalesce(p.phone,''),'[^0-9]','','g')
      ~ '^(91)?[6-9][0-9]{9}$'
    and right(pg_catalog.regexp_replace(coalesce(p.phone,''),'[^0-9]','','g'),10)
      = v_phone;
end;
$body$;

revoke all on function public.customer_firebase_phone_collision_counts(uuid)
  from public, anon, authenticated;
grant execute on function public.customer_firebase_phone_collision_counts(uuid)
  to service_role;

comment on table public.customer_firebase_enrollment_reviews is
  'PREPARED restricted append-only decisions. Digest only; no OTP, phone, JWT, UID or customer document content. Approvals must originate from independently authenticated privileged operator review, not public request JSON.';
commit;
