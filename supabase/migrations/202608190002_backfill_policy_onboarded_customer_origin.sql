begin;

-- Historical customers were intentionally introduced as `legacy` when
-- creation provenance was added. Backfill only cases where the database gives
-- strong transaction-level evidence that the customer was created by Policy
-- Onboarding.
--
-- Conservative evidence required:
--   1. customer is still legacy and is Individual / Proprietor;
--   2. the earliest linked policy was created within one second of the customer;
--   3. there is no approved direct customer-onboarding application for it;
--   4. there is no Group/Corporate/Dealership parent relationship established
--      at creation time.
--
-- This intentionally leaves ambiguous historical records as legacy.

create temporary table policy_onboarding_customer_backfill_candidates
on commit drop
as
select
  c.id as customer_id,
  c.created_by,
  c.created_at as customer_created_at,
  min(p.created_at) as earliest_policy_created_at
from public.customers c
join public.policies p
  on p.customer_id = c.id
where c.creation_channel = 'legacy'
  and c.partner_type = 'individual_proprietor'
  and not exists (
    select 1
    from public.customer_onboarding_applications coa
    where coa.customer_id = c.id
      and coa.status = 'approved'
  )
  and not exists (
    select 1
    from public.customer_relationships cr
    join public.customers parent
      on parent.id = cr.parent_customer_id
    where cr.child_customer_id = c.id
      and parent.partner_type in ('group', 'corporate', 'dealership')
      and abs(extract(epoch from (cr.created_at - c.created_at))) <= 60
  )
group by c.id, c.created_by, c.created_at
having abs(extract(epoch from (min(p.created_at) - c.created_at))) <= 1;

-- Record exactly which rows this migration classified. This marker makes the
-- data change reversible without deleting any audit history.
insert into public.audit_logs (
  actor_id,
  action,
  table_name,
  record_id,
  old_data,
  new_data
)
select
  candidate.created_by,
  'customer_creation_origin_backfilled',
  'customers',
  candidate.customer_id,
  jsonb_build_object(
    'creation_channel', 'legacy'
  ),
  jsonb_build_object(
    'creation_channel', 'policy_onboarding',
    'backfill_reason', 'earliest_policy_created_within_1_second_of_customer',
    'customer_created_at', candidate.customer_created_at,
    'earliest_policy_created_at', candidate.earliest_policy_created_at
  )
from policy_onboarding_customer_backfill_candidates candidate;

-- The existing provenance/audit triggers then create the normal Customer
-- Created activity with Via: Policy Onboarding. No existing audit row is
-- overwritten or deleted.
update public.customers c
set
  creation_channel = 'policy_onboarding',
  origin_customer_id = null
from policy_onboarding_customer_backfill_candidates candidate
where c.id = candidate.customer_id
  and c.creation_channel = 'legacy';

commit;
