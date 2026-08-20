-- Keep manager-portal Individual / Proprietor customer creation aligned with the
-- mobile access model. The mobile app resolves customer accounts through
-- customer_memberships, so an approved website-created customer must have the
-- same active owner membership as a customer completed through the mobile app.
--
-- Safety properties:
-- - only manager_portal + individual_proprietor + approved applications qualify
-- - customer.profile_id must match the onboarding application's profile_id
-- - the profile must be an active customer profile
-- - suspended/revoked memberships are never reactivated automatically
-- - inserts are idempotent under UNIQUE(customer_id, profile_id)
-- - the historical repair is limited to the same verified provenance

create or replace function public.sync_manager_portal_customer_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_customer public.customers%rowtype;
  v_profile public.profiles%rowtype;
  v_membership public.customer_memberships%rowtype;
begin
  if new.source <> 'manager_portal'
     or new.partner_type <> 'individual_proprietor'
     or new.status <> 'approved'
     or new.customer_id is null
     or new.profile_id is null then
    return new;
  end if;

  select * into v_customer
  from public.customers
  where id = new.customer_id;

  if v_customer.id is null or v_customer.profile_id is distinct from new.profile_id then
    raise exception 'Approved manager-portal customer does not match its login profile.';
  end if;

  select * into v_profile
  from public.profiles
  where id = new.profile_id;

  if v_profile.id is null or v_profile.role::text <> 'customer' or not v_profile.is_active then
    raise exception 'Approved manager-portal customer requires an active customer login profile.';
  end if;

  select * into v_membership
  from public.customer_memberships
  where customer_id = new.customer_id
    and profile_id = new.profile_id
  for update;

  if v_membership.id is null then
    insert into public.customer_memberships (
      customer_id,
      profile_id,
      invited_phone,
      invited_email,
      membership_role,
      is_primary,
      status,
      created_by
    ) values (
      new.customer_id,
      new.profile_id,
      coalesce(v_customer.phone, new.applicant_phone),
      coalesce(v_customer.email, new.applicant_email),
      'owner',
      true,
      'active',
      coalesce(new.reviewed_by, new.initiated_by)
    )
    returning * into v_membership;

    insert into public.audit_logs (
      actor_id,
      action,
      table_name,
      record_id,
      new_data
    ) values (
      coalesce(new.reviewed_by, new.initiated_by),
      'create_manager_portal_customer_membership',
      'customer_memberships',
      v_membership.id,
      jsonb_build_object(
        'customer_id', new.customer_id,
        'profile_id', new.profile_id,
        'membership_role', 'owner',
        'status', 'active',
        'source', 'manager_portal_customer_approval'
      )
    );
  elsif v_membership.status = 'pending' then
    update public.customer_memberships
    set membership_role = 'owner',
        is_primary = true,
        status = 'active',
        invited_phone = coalesce(v_customer.phone, new.applicant_phone, invited_phone),
        invited_email = coalesce(v_customer.email, new.applicant_email, invited_email),
        updated_at = now()
    where id = v_membership.id;

    insert into public.audit_logs (
      actor_id,
      action,
      table_name,
      record_id,
      old_data,
      new_data
    ) values (
      coalesce(new.reviewed_by, new.initiated_by),
      'activate_manager_portal_customer_membership',
      'customer_memberships',
      v_membership.id,
      jsonb_build_object('status', 'pending'),
      jsonb_build_object(
        'customer_id', new.customer_id,
        'profile_id', new.profile_id,
        'membership_role', 'owner',
        'status', 'active',
        'source', 'manager_portal_customer_approval'
      )
    );
  end if;

  -- Existing active memberships are left unchanged. Suspended/revoked memberships
  -- are intentionally left unchanged so onboarding cannot bypass an access block.
  return new;
end;
$$;

drop trigger if exists sync_manager_portal_customer_membership_on_approval
  on public.customer_onboarding_applications;

create trigger sync_manager_portal_customer_membership_on_approval
after insert or update of status, customer_id, profile_id
on public.customer_onboarding_applications
for each row
when (
  new.source = 'manager_portal'
  and new.partner_type = 'individual_proprietor'
  and new.status = 'approved'
  and new.customer_id is not null
  and new.profile_id is not null
)
execute function public.sync_manager_portal_customer_membership();

-- Repair only already-approved website-created Individual / Proprietor customers
-- whose customer/profile linkage is internally consistent and whose profile is active.
-- Suspended/revoked memberships are excluded from this repair.
with eligible as (
  select distinct on (application.customer_id, application.profile_id)
    application.customer_id,
    application.profile_id,
    coalesce(customer.phone, application.applicant_phone) as invited_phone,
    coalesce(customer.email, application.applicant_email) as invited_email,
    coalesce(application.reviewed_by, application.initiated_by) as actor_id
  from public.customer_onboarding_applications application
  join public.customers customer
    on customer.id = application.customer_id
   and customer.profile_id = application.profile_id
  join public.profiles profile
    on profile.id = application.profile_id
   and profile.role::text = 'customer'
   and profile.is_active
  where application.source = 'manager_portal'
    and application.partner_type = 'individual_proprietor'
    and application.status = 'approved'
    and application.customer_id is not null
    and application.profile_id is not null
  order by application.customer_id, application.profile_id, application.completed_at desc nulls last, application.created_at desc
),
inserted as (
  insert into public.customer_memberships (
    customer_id,
    profile_id,
    invited_phone,
    invited_email,
    membership_role,
    is_primary,
    status,
    created_by
  )
  select
    eligible.customer_id,
    eligible.profile_id,
    eligible.invited_phone,
    eligible.invited_email,
    'owner',
    true,
    'active',
    eligible.actor_id
  from eligible
  where not exists (
    select 1
    from public.customer_memberships membership
    where membership.customer_id = eligible.customer_id
      and membership.profile_id = eligible.profile_id
  )
  on conflict (customer_id, profile_id) do nothing
  returning id, customer_id, profile_id, created_by
)
insert into public.audit_logs (
  actor_id,
  action,
  table_name,
  record_id,
  new_data
)
select
  inserted.created_by,
  'backfill_manager_portal_customer_membership',
  'customer_memberships',
  inserted.id,
  jsonb_build_object(
    'customer_id', inserted.customer_id,
    'profile_id', inserted.profile_id,
    'membership_role', 'owner',
    'status', 'active',
    'source', 'migration_20260820144500'
  )
from inserted;

with eligible as (
  select distinct on (application.customer_id, application.profile_id)
    application.customer_id,
    application.profile_id,
    coalesce(customer.phone, application.applicant_phone) as invited_phone,
    coalesce(customer.email, application.applicant_email) as invited_email,
    coalesce(application.reviewed_by, application.initiated_by) as actor_id
  from public.customer_onboarding_applications application
  join public.customers customer
    on customer.id = application.customer_id
   and customer.profile_id = application.profile_id
  join public.profiles profile
    on profile.id = application.profile_id
   and profile.role::text = 'customer'
   and profile.is_active
  where application.source = 'manager_portal'
    and application.partner_type = 'individual_proprietor'
    and application.status = 'approved'
    and application.customer_id is not null
    and application.profile_id is not null
  order by application.customer_id, application.profile_id, application.completed_at desc nulls last, application.created_at desc
),
updated as (
  update public.customer_memberships membership
  set membership_role = 'owner',
      is_primary = true,
      status = 'active',
      invited_phone = coalesce(eligible.invited_phone, membership.invited_phone),
      invited_email = coalesce(eligible.invited_email, membership.invited_email),
      updated_at = now()
  from eligible
  where membership.customer_id = eligible.customer_id
    and membership.profile_id = eligible.profile_id
    and membership.status = 'pending'
  returning membership.id, membership.customer_id, membership.profile_id, eligible.actor_id
)
insert into public.audit_logs (
  actor_id,
  action,
  table_name,
  record_id,
  old_data,
  new_data
)
select
  updated.actor_id,
  'backfill_activate_manager_portal_customer_membership',
  'customer_memberships',
  updated.id,
  jsonb_build_object('status', 'pending'),
  jsonb_build_object(
    'customer_id', updated.customer_id,
    'profile_id', updated.profile_id,
    'membership_role', 'owner',
    'status', 'active',
    'source', 'migration_20260820144500'
  )
from updated;
