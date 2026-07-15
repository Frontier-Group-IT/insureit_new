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

  select exists (
    select 1
    from public.get_accessible_customer_contexts() context_row
    where context_row.customer_id = v_application.group_customer_id
      and context_row.partner_type = 'group'
      and context_row.access_source = 'direct'
      and coalesce(context_row.membership_role, '') in (
        'owner',
        'admin',
        'manager',
        'group_owner',
        'group_admin'
      )
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
