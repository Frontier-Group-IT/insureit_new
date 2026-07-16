-- Mobile Group dashboard read model for associated child customers.
-- Returns both activated linked customers and in-flight onboarding applications.

create or replace function public.get_group_child_account_overview(
  p_group_customer_id uuid
)
returns table (
  row_id text,
  customer_id uuid,
  application_id uuid,
  customer_code text,
  partner_type text,
  company_name text,
  contact_name text,
  phone text,
  city text,
  state text,
  onboarding_status text,
  application_status text,
  account_source text,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  with authorized as (
    select public.can_manage_group_associated_onboarding(p_group_customer_id, auth.uid()) as allowed
  ),
  linked_customers as (
    select
      ('customer:' || child.id::text) as row_id,
      child.id as customer_id,
      application.id as application_id,
      child.customer_code,
      child.partner_type::text as partner_type,
      child.company_name,
      child.contact_name,
      child.phone,
      child.city,
      child.state,
      child.onboarding_status,
      coalesce(application.status::text, 'approved') as application_status,
      'linked_customer'::text as account_source,
      child.created_at,
      child.updated_at
    from authorized
    join public.customer_relationships relationship
      on authorized.allowed
     and relationship.parent_customer_id = p_group_customer_id
     and relationship.relationship_type = 'group_member'
     and relationship.is_active
     and relationship.status = 'active'
    join public.customers child
      on child.id = relationship.child_customer_id
    left join public.customer_onboarding_applications application
      on application.customer_id = child.id
     and application.group_customer_id = p_group_customer_id
  ),
  onboarding_applications as (
    select
      ('application:' || application.id::text) as row_id,
      application.customer_id,
      application.id as application_id,
      null::text as customer_code,
      application.partner_type::text as partner_type,
      coalesce(
        application.draft_data->>'company_name',
        application.draft_data->>'dealership_name',
        application.draft_data->>'legal_trade_name',
        application.draft_data->>'contact_name',
        'Pending customer'
      ) as company_name,
      coalesce(
        application.draft_data->>'dedicated_spoc_name',
        application.draft_data->>'corporate_creator_name',
        application.draft_data->>'owner_name',
        application.draft_data->>'contact_name',
        application.draft_data->>'representative_name',
        'Pending contact'
      ) as contact_name,
      application.applicant_phone as phone,
      application.draft_data->>'city' as city,
      application.draft_data->>'state' as state,
      application.status::text as onboarding_status,
      application.status::text as application_status,
      'onboarding_application'::text as account_source,
      application.created_at,
      application.updated_at
    from authorized
    join public.customer_onboarding_applications application
      on authorized.allowed
     and application.group_customer_id = p_group_customer_id
     and application.status not in ('approved', 'cancelled')
  )
  select *
  from (
    select * from linked_customers
    union all
    select application.*
    from onboarding_applications application
    where not exists (
      select 1
      from linked_customers linked
      where linked.application_id = application.application_id
         or linked.customer_id = application.customer_id
    )
  ) overview_rows
  order by
    case when account_source = 'linked_customer' then 0 else 1 end,
    updated_at desc nulls last,
    created_at desc nulls last;
$$;

revoke all on function public.get_group_child_account_overview(uuid) from public;
grant execute on function public.get_group_child_account_overview(uuid) to authenticated;
