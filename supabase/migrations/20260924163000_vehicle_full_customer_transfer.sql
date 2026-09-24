begin;

create or replace function public.transfer_vehicle_customer_v1(
  p_vehicle_id uuid,
  p_new_customer_id uuid,
  p_effective_date date,
  p_reason text,
  p_actor_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vehicle public.vehicles%rowtype;
  v_old_customer_id uuid;
  v_actor_role text;
  v_policy_ids uuid[] := '{}'::uuid[];
  v_external_policy_ids uuid[] := '{}'::uuid[];
  v_claim_ids uuid[] := '{}'::uuid[];
  v_counts jsonb := '{}'::jsonb;
  v_count integer := 0;
begin
  if p_vehicle_id is null or p_new_customer_id is null or p_actor_profile_id is null then
    raise exception 'Vehicle, destination customer and actor are required.';
  end if;

  if p_effective_date is null or p_effective_date > current_date then
    raise exception 'Transfer effective date must be today or earlier.';
  end if;

  if nullif(btrim(coalesce(p_reason, '')), '') is null or length(btrim(p_reason)) < 5 then
    raise exception 'Enter a clear transfer reason.';
  end if;

  select role::text into v_actor_role
  from public.profiles
  where id = p_actor_profile_id
    and coalesce(is_active, true) = true;

  if v_actor_role is null then
    raise exception 'Active actor profile not found.';
  end if;

  if v_actor_role not in ('manager','admin','super_admin','it_super_user') then
    raise exception 'Only a Manager or Administrator can transfer vehicle ownership.';
  end if;

  select * into v_vehicle
  from public.vehicles
  where id = p_vehicle_id
  for update;

  if not found then
    raise exception 'Vehicle not found.';
  end if;

  v_old_customer_id := v_vehicle.customer_id;

  if v_old_customer_id = p_new_customer_id then
    raise exception 'Destination customer is already the current vehicle owner.';
  end if;

  if not exists (
    select 1
    from public.customers c
    where c.id = p_new_customer_id
      and lower(coalesce(c.status, 'active')) = 'active'
  ) then
    raise exception 'Destination customer is not active or does not exist.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_policy_ids
  from public.policies
  where vehicle_id = p_vehicle_id;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_external_policy_ids
  from public.external_policies
  where vehicle_id = p_vehicle_id;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_claim_ids
  from public.claims
  where vehicle_id = p_vehicle_id;

  insert into public.vehicle_ownership_history(
    vehicle_id,
    previous_customer_id,
    customer_id,
    effective_from,
    change_reason,
    confirmed_by
  )
  values (
    p_vehicle_id,
    v_old_customer_id,
    p_new_customer_id,
    p_effective_date,
    btrim(p_reason),
    p_actor_profile_id
  );

  update public.policies
  set customer_id = p_new_customer_id,
      updated_at = now()
  where vehicle_id = p_vehicle_id
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('policies', v_count);

  update public.external_policies
  set customer_id = p_new_customer_id,
      updated_at = now()
  where vehicle_id = p_vehicle_id
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('externalPolicies', v_count);

  update public.claims
  set customer_id = p_new_customer_id,
      updated_at = now()
  where vehicle_id = p_vehicle_id
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('claims', v_count);

  update public.claim_documents
  set customer_id = p_new_customer_id,
      updated_at = now()
  where claim_id = any(v_claim_ids)
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('claimDocuments', v_count);

  update public.notifications
  set customer_id = p_new_customer_id,
      updated_at = now()
  where claim_id = any(v_claim_ids)
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('claimNotifications', v_count);

  update public.support_tickets
  set customer_id = p_new_customer_id,
      updated_at = now()
  where claim_id = any(v_claim_ids)
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('supportTickets', v_count);

  update public.customer_activity_events
  set customer_id = p_new_customer_id,
      updated_at = now()
  where (
      vehicle_id = p_vehicle_id
      or policy_id = any(v_policy_ids)
      or claim_id = any(v_claim_ids)
    )
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('customerActivityEvents', v_count);

  update public.customer_documents
  set customer_id = p_new_customer_id,
      updated_at = now()
  where external_policy_id = any(v_external_policy_ids)
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('customerDocuments', v_count);

  update public.intermediary_commission_ledger
  set customer_id = p_new_customer_id,
      updated_at = now()
  where policy_id = any(v_policy_ids)
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('commissionLedger', v_count);

  update public.intermediary_referrals
  set customer_id = p_new_customer_id,
      updated_at = now()
  where policy_id = any(v_policy_ids)
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('intermediaryReferrals', v_count);

  update public.service_enquiries
  set customer_id = p_new_customer_id,
      updated_at = now()
  where vehicle_id = p_vehicle_id
    and customer_id is distinct from p_new_customer_id;
  get diagnostics v_count = row_count;
  v_counts := v_counts || jsonb_build_object('serviceEnquiries', v_count);

  delete from public.vehicle_customer_links
  where vehicle_id = p_vehicle_id;

  insert into public.vehicle_customer_links(
    vehicle_id,
    customer_id,
    relationship_type,
    is_primary,
    created_by
  )
  values (
    p_vehicle_id,
    p_new_customer_id,
    'primary',
    true,
    p_actor_profile_id
  )
  on conflict (vehicle_id, customer_id) do update
  set relationship_type = 'primary',
      is_primary = true,
      created_by = excluded.created_by;

  update public.vehicles
  set customer_id = p_new_customer_id,
      updated_at = now()
  where id = p_vehicle_id;

  insert into public.audit_logs(
    actor_id,
    action,
    table_name,
    record_id,
    old_data,
    new_data
  )
  values (
    p_actor_profile_id,
    'vehicle_customer_transferred',
    'vehicles',
    p_vehicle_id,
    jsonb_build_object(
      'customer_id', v_old_customer_id,
      'effective_date', p_effective_date,
      'reason', btrim(p_reason)
    ),
    jsonb_build_object(
      'customer_id', p_new_customer_id,
      'effective_date', p_effective_date,
      'reason', btrim(p_reason),
      'transferred_dependencies', v_counts
    )
  );

  return jsonb_build_object(
    'ok', true,
    'vehicleId', p_vehicle_id,
    'previousCustomerId', v_old_customer_id,
    'customerId', p_new_customer_id,
    'effectiveDate', p_effective_date,
    'transferredDependencies', v_counts
  );
end;
$$;

revoke all on function public.transfer_vehicle_customer_v1(uuid,uuid,date,text,uuid) from public, anon, authenticated;
grant execute on function public.transfer_vehicle_customer_v1(uuid,uuid,date,text,uuid) to service_role;

comment on function public.transfer_vehicle_customer_v1(uuid,uuid,date,text,uuid) is
  'Atomically transfers a vehicle and all customer-scoped policy, claim and related dependencies to one destination customer while recording ownership and audit history. Service-role only.';

commit;
