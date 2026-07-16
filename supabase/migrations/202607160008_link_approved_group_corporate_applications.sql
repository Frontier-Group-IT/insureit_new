-- Link approved mobile-created Corporate customers back to their parent Group.
-- Earlier approval code promoted the Corporate customer but did not create the hierarchy row.

insert into public.customer_relationships (
  parent_customer_id,
  child_customer_id,
  relationship_type,
  is_active,
  status,
  effective_from,
  effective_to,
  created_by,
  approved_by,
  updated_at
)
select
  application.group_customer_id,
  application.customer_id,
  'group_member',
  true,
  'active',
  coalesce(application.completed_at, application.reviewed_at, application.updated_at, now()),
  null,
  application.reviewed_by,
  application.reviewed_by,
  now()
from public.customer_onboarding_applications application
join public.customers parent_customer
  on parent_customer.id = application.group_customer_id
 and parent_customer.partner_type = 'group'
 and parent_customer.onboarding_status = 'active'
join public.customers child_customer
  on child_customer.id = application.customer_id
 and child_customer.partner_type = 'corporate'
 and child_customer.onboarding_status = 'active'
where application.partner_type = 'corporate'
  and application.status = 'approved'
  and application.group_customer_id is not null
  and application.customer_id is not null
  and not exists (
    select 1
    from public.customer_relationships relationship
    where relationship.child_customer_id = application.customer_id
      and relationship.relationship_type = 'group_member'
      and relationship.is_active
      and relationship.status = 'active'
  )
on conflict do nothing;
