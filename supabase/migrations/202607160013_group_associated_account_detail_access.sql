-- Group parent read model for associated account details.
-- Covers both activated linked customers and in-flight onboarding applications.

drop policy if exists claim_status_history_read_accessible_customer on public.claim_status_history;
create policy claim_status_history_read_accessible_customer
on public.claim_status_history for select
to authenticated
using (
  exists (
    select 1
    from public.claims claim
    where claim.id = claim_status_history.claim_id
      and public.can_access_customer(claim.customer_id)
  )
);

drop policy if exists claim_tasks_read_accessible_customer on public.claim_tasks;
create policy claim_tasks_read_accessible_customer
on public.claim_tasks for select
to authenticated
using (
  exists (
    select 1
    from public.claims claim
    where claim.id = claim_tasks.claim_id
      and public.can_access_customer(claim.customer_id)
  )
);

create or replace function public.get_group_associated_account_detail(
  p_group_customer_id uuid,
  p_customer_id uuid default null,
  p_application_id uuid default null
)
returns table (
  account_source text,
  customer_id uuid,
  application_id uuid,
  partner_type text,
  account_title text,
  onboarding_status text,
  application_status text,
  details jsonb,
  contacts jsonb,
  documents jsonb,
  vehicle_count bigint,
  active_policy_count bigint,
  open_claim_count bigint,
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
  matched_application as (
    select application.*
    from authorized
    join public.customer_onboarding_applications application
      on authorized.allowed
     and application.group_customer_id = p_group_customer_id
     and (
       (p_application_id is not null and application.id = p_application_id)
       or (p_customer_id is not null and application.customer_id = p_customer_id)
     )
    order by application.updated_at desc nulls last, application.created_at desc
    limit 1
  ),
  matched_customer as (
    select child.*
    from authorized
    join public.customer_relationships relationship
      on authorized.allowed
     and relationship.parent_customer_id = p_group_customer_id
     and relationship.relationship_type = 'group_member'
     and relationship.is_active
     and relationship.status = 'active'
    join public.customers child
      on child.id = relationship.child_customer_id
    where p_customer_id is not null
      and child.id = p_customer_id
    limit 1
  )
  select
    case when customer.id is not null then 'linked_customer' else 'onboarding_application' end as account_source,
    customer.id as customer_id,
    application.id as application_id,
    coalesce(customer.partner_type::text, application.partner_type::text) as partner_type,
    coalesce(
      customer.company_name,
      customer.contact_name,
      application.draft_data->>'company_name',
      application.draft_data->>'dealership_name',
      application.draft_data->>'legal_trade_name',
      application.draft_data->>'contact_name',
      'Associated customer'
    ) as account_title,
    coalesce(customer.onboarding_status, application.status::text) as onboarding_status,
    application.status::text as application_status,
    jsonb_strip_nulls(jsonb_build_object(
      'customer_code', customer.customer_code,
      'company_name', coalesce(customer.company_name, application.draft_data->>'company_name', application.draft_data->>'dealership_name', application.draft_data->>'legal_trade_name'),
      'contact_name', coalesce(customer.contact_name, application.draft_data->>'contact_name', application.draft_data->>'corporate_creator_name', application.draft_data->>'dedicated_spoc_name'),
      'phone', coalesce(customer.phone, application.applicant_phone),
      'email', coalesce(customer.email, application.applicant_email),
      'address', coalesce(customer.address, application.draft_data->>'address_street'),
      'address_locality', application.draft_data->>'address_locality',
      'city', coalesce(customer.city, application.draft_data->>'city'),
      'state', coalesce(customer.state, application.draft_data->>'state'),
      'postal_code', coalesce(customer.postal_code, application.draft_data->>'postal_code'),
      'company_pan', application.draft_data->>'company_pan',
      'gst_number', application.draft_data->>'gst_number',
      'fleet_size_band', application.draft_data->>'fleet_size_band',
      'review_notes', application.draft_data->>'review_notes'
    )) as details,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'role', contact.contact_role,
          'name', contact.full_name,
          'phone', contact.phone,
          'email', contact.email,
          'status', contact.membership_status
        ) order by contact.contact_role)
        from public.customer_onboarding_contacts contact
        where application.id is not null
          and contact.application_id = application.id
      ),
      jsonb_build_array(jsonb_strip_nulls(jsonb_build_object(
        'role', 'primary_contact',
        'name', customer.contact_name,
        'phone', customer.phone,
        'email', customer.email,
        'status', customer.onboarding_status
      )))
    ) as contacts,
    coalesce(
      (
        select jsonb_agg(jsonb_build_object(
          'type', document.document_type,
          'file_name', document.file_name,
          'status', document.verification_status,
          'created_at', document.created_at
        ) order by document.created_at desc)
        from public.customer_onboarding_documents document
        where application.id is not null
          and document.application_id = application.id
      ),
      '[]'::jsonb
    ) as documents,
    (
      select count(*)
      from public.vehicles vehicle
      where customer.id is not null
        and vehicle.customer_id = customer.id
    ) as vehicle_count,
    (
      select count(*)
      from public.policies policy
      where customer.id is not null
        and policy.customer_id = customer.id
        and policy.end_date >= current_date
    ) as active_policy_count,
    (
      select count(*)
      from public.claims claim
      where customer.id is not null
        and claim.customer_id = customer.id
        and claim.current_status::text not in ('Closed', 'Settled', 'Rejected', 'Claim Complete')
    ) as open_claim_count,
    coalesce(customer.created_at, application.created_at) as created_at,
    coalesce(customer.updated_at, application.updated_at) as updated_at
  from matched_application application
  full join matched_customer customer
    on customer.id = application.customer_id
  where application.id is not null
     or customer.id is not null;
$$;

revoke all on function public.get_group_associated_account_detail(uuid, uuid, uuid) from public;
grant execute on function public.get_group_associated_account_detail(uuid, uuid, uuid) to authenticated;
