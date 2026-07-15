alter table public.customer_onboarding_applications
  add column if not exists group_customer_id uuid references public.customers(id) on delete restrict;

create index if not exists idx_customer_onboarding_group_customer
  on public.customer_onboarding_applications(group_customer_id, status, created_at desc);

create or replace function public.submit_group_associated_onboarding_application(
  p_application_id uuid,
  p_draft_data jsonb
)
returns public.customer_onboarding_applications
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_application public.customer_onboarding_applications;
  v_group public.customers;
  v_allowed boolean := false;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_application
  from public.customer_onboarding_applications
  where id = p_application_id
  for update;

  if v_application.id is null then
    raise exception 'Onboarding application not found';
  end if;

  if v_application.profile_id is distinct from v_user_id
     or v_application.initiated_by is distinct from v_user_id then
    raise exception 'You cannot submit this onboarding application';
  end if;

  if v_application.partner_type not in ('corporate', 'individual_proprietor', 'dealership') then
    raise exception 'Unsupported associated customer type';
  end if;

  if v_application.group_customer_id is null then
    raise exception 'Group account is required';
  end if;

  select * into v_group
  from public.customers
  where id = v_application.group_customer_id;

  if v_group.id is null or coalesce(v_group.partner_type, '') <> 'group' then
    raise exception 'A valid Group account is required';
  end if;

  select exists (
    select 1
    from public.customers c
    where c.id = v_application.group_customer_id
      and c.profile_id = v_user_id
  ) or exists (
    select 1
    from public.customer_memberships cm
    where cm.customer_id = v_application.group_customer_id
      and cm.profile_id = v_user_id
      and cm.status = 'active'
      and coalesce(cm.membership_role, '') in ('owner', 'admin', 'manager', 'group_owner', 'group_admin')
  ) into v_allowed;

  if not v_allowed then
    raise exception 'You do not have permission to add customers to this Group';
  end if;

  update public.customer_onboarding_applications
  set draft_data = p_draft_data,
      status = 'submitted',
      current_step = greatest(current_step, 4),
      submitted_at = now(),
      updated_at = now()
  where id = p_application_id
  returning * into v_application;

  return v_application;
end;
$$;

grant execute on function public.submit_group_associated_onboarding_application(uuid, jsonb) to authenticated;
