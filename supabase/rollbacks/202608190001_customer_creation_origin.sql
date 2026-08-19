begin;

-- This rollback removes only the provenance columns introduced by
-- 202608190001_customer_creation_origin.sql. It does not delete customers,
-- customer relationships, or audit_logs rows.
drop trigger if exists protect_customer_creation_provenance on public.customers;
drop function if exists public.protect_customer_creation_provenance();

drop index if exists public.customers_origin_customer_id_idx;
drop index if exists public.customers_creation_channel_idx;

alter table public.customers
  drop constraint if exists customers_origin_customer_id_fkey,
  drop constraint if exists customers_creation_channel_check,
  drop column if exists origin_customer_id,
  drop column if exists creation_channel;

commit;
