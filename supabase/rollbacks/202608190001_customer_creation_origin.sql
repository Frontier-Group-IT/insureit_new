begin;

-- This rollback removes the customer provenance/tracking infrastructure
-- introduced by 202608190001_customer_creation_origin.sql. It deliberately
-- does not delete customers, relationships, or audit history already written.
drop trigger if exists audit_customer_parent_relationship on public.customer_relationships;
drop function if exists public.audit_customer_parent_relationship();

drop trigger if exists classify_policy_onboarded_customer on public.policies;
drop function if exists public.classify_policy_onboarded_customer();

drop trigger if exists classify_direct_customer_onboarding on public.customer_onboarding_applications;
drop function if exists public.classify_direct_customer_onboarding();

drop trigger if exists audit_customer_business_edit on public.customers;
drop function if exists public.audit_customer_business_edit();

drop trigger if exists audit_customer_creation_provenance on public.customers;
drop function if exists public.audit_customer_creation_provenance();

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
