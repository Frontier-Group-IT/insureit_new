-- PREPARED ROLLBACK ONLY. Do not run without review.
-- Revokes future service usage but RETAINS all historical review decisions.
-- This is an intentionally data-preserving rollback, not a destructive DROP TABLE.
begin;
revoke all on function public.customer_firebase_phone_collision_counts(uuid)
  from public, anon, authenticated, service_role;
drop function if exists public.customer_firebase_phone_collision_counts(uuid);
revoke insert on public.customer_firebase_enrollment_reviews from service_role;
revoke usage on sequence public.customer_firebase_enrollment_reviews_id_seq from service_role;
-- Freeze review journal rather than delete evidence, existing signed approvals or audit.
comment on table public.customer_firebase_enrollment_reviews is
 'Frozen Firebase migration review history after rollback; retain all rows for audit. No public access.';
commit;
