-- Self-contained repair for the Group hierarchy context function.
-- This can be run even when migration 202607150006 failed and rolled back.

alter table public.customer_relationships
  add column if not exists status text not null default 'active',
  add column if not exists effective_from timestamptz not null default now(),
  add column if not exists effective_to timestamptz,
  add column if not exists approved_by uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();

update public.customer_relationships
set status = case when is_active then 'active' else 'inactive' end
where status is distinct from case when is_active then 'active' else 'inactive' end;

alter table public.customer_relationships
  drop constraint if exists customer_relationships_status_check;

alter table public.customer_relationships
  add constraint customer_relationships_status_check
  check (status in ('active', 'inactive', 'ended'));

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
  with direct_accounts as (
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
      parent_group.company_name as group_name
    from public.customer_memberships membership
    join public.customers customer
      on customer.id = membership.customer_id
    left join public.customer_relationships parent_relationship
      on parent_relationship.child_customer_id = customer.id
      and parent_relationship.relationship_type = 'group_member'
      and parent_relationship.is_active
      and parent_relationship.status = 'active'
    left join public.customers parent_group
      on parent_group.id = parent_relationship.parent_customer_id
    where membership.profile_id = auth.uid()
      and membership.status = 'active'
  ),
  group_children as (
    select
      child.id as customer_id,
      child.customer_code,
      child.partner_type::text as partner_type,
      child.company_name,
      child.contact_name,
      group_membership.id as membership_id,
      group_membership.membership_role,
      'group_child'::text as access_source,
      parent.id as group_customer_id,
      parent.company_name as group_name
    from public.customer_memberships group_membership
    join public.customers parent
      on parent.id = group_membership.customer_id
    join public.customer_relationships relationship
      on relationship.parent_customer_id = parent.id
      and relationship.relationship_type = 'group_member'
      and relationship.is_active
      and relationship.status = 'active'
    join public.customers child
      on child.id = relationship.child_customer_id
    where group_membership.profile_id = auth.uid()
      and group_membership.status = 'active'
      and parent.partner_type::text = 'group'
  ),
  combined_contexts as (
    select * from direct_accounts
    union all
    select child.*
    from group_children child
    where not exists (
      select 1
      from direct_accounts direct
      where direct.customer_id = child.customer_id
    )
  )
  select
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
    case when combined_contexts.access_source = 'direct' then 0 else 1 end,
    combined_contexts.company_name nulls last,
    combined_contexts.contact_name;
$$;

revoke all on function public.get_accessible_customer_contexts() from public;
grant execute on function public.get_accessible_customer_contexts() to authenticated;
