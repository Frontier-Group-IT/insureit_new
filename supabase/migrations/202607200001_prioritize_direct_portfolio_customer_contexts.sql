-- Return customer contexts in a deterministic account-priority order.
-- This prevents mobile dashboard selection from depending on UUID/order returned by PostgREST.

create or replace function public.get_accessible_customer_contexts()
returns table (
  customer_id uuid,
  customer_code text,
  partner_type text,
  company_name text,
  contact_name text,
  membership_id uuid,
  membership_role text,
  access_source text,
  group_customer_id uuid,
  group_name text
)
language sql
stable
security definer
set search_path = public
as $$
  with recursive direct_accounts as (
    select
      customer.id as customer_id,
      customer.customer_code,
      customer.partner_type::text as partner_type,
      customer.company_name,
      customer.contact_name,
      membership.id as membership_id,
      membership.membership_role,
      'direct'::text as access_source,
      parent_relationship.parent_customer_id as group_customer_id,
      parent_customer.company_name as group_name
    from public.customer_memberships membership
    join public.customers customer
      on customer.id = membership.customer_id
    left join public.customer_relationships parent_relationship
      on parent_relationship.child_customer_id = customer.id
     and parent_relationship.relationship_type = 'group_member'
     and parent_relationship.is_active
     and parent_relationship.status = 'active'
    left join public.customers parent_customer
      on parent_customer.id = parent_relationship.parent_customer_id
    where membership.profile_id = auth.uid()
      and membership.status = 'active'
  ),
  managed_children as (
    select
      child.id as customer_id,
      child.customer_code,
      child.partner_type::text as partner_type,
      child.company_name,
      child.contact_name,
      direct_accounts.membership_id,
      direct_accounts.membership_role,
      'group_child'::text as access_source,
      parent.id as group_customer_id,
      parent.company_name as group_name
    from direct_accounts
    join public.customers parent
      on parent.id = direct_accounts.customer_id
    join public.customer_relationships relationship
      on relationship.parent_customer_id = parent.id
     and relationship.relationship_type = 'group_member'
     and relationship.is_active
     and relationship.status = 'active'
    join public.customers child
      on child.id = relationship.child_customer_id
    where parent.partner_type::text in ('group', 'corporate', 'dealership')
    union all
    select
      child.id as customer_id,
      child.customer_code,
      child.partner_type::text as partner_type,
      child.company_name,
      child.contact_name,
      managed_children.membership_id,
      managed_children.membership_role,
      'group_child'::text as access_source,
      parent.id as group_customer_id,
      parent.company_name as group_name
    from managed_children
    join public.customers parent
      on parent.id = managed_children.customer_id
    join public.customer_relationships relationship
      on relationship.parent_customer_id = parent.id
     and relationship.relationship_type = 'group_member'
     and relationship.is_active
     and relationship.status = 'active'
    join public.customers child
      on child.id = relationship.child_customer_id
  ),
  combined_contexts as (
    select * from direct_accounts
    union all
    select child.*
    from managed_children child
    where not exists (
      select 1
      from direct_accounts direct
      where direct.customer_id = child.customer_id
    )
  ),
  deduped_contexts as (
    select distinct on (combined_contexts.customer_id)
      combined_contexts.customer_id,
      combined_contexts.customer_code,
      combined_contexts.partner_type,
      combined_contexts.company_name,
      combined_contexts.contact_name,
      combined_contexts.membership_id,
      combined_contexts.membership_role,
      combined_contexts.access_source,
      combined_contexts.group_customer_id,
      combined_contexts.group_name
    from combined_contexts
    order by
      combined_contexts.customer_id,
      case
        when combined_contexts.access_source = 'direct' then 0
        else 1
      end,
      combined_contexts.company_name nulls last,
      combined_contexts.contact_name
  )
  select *
  from deduped_contexts
  order by
    case
      when access_source = 'direct' and partner_type = 'group' then 0
      when access_source = 'direct' and partner_type = 'dealership' then 1
      when access_source = 'direct' and partner_type = 'corporate' then 2
      when access_source = 'direct' then 3
      else 4
    end,
    company_name nulls last,
    contact_name;
$$;

revoke all on function public.get_accessible_customer_contexts() from public;
grant execute on function public.get_accessible_customer_contexts() to authenticated;
