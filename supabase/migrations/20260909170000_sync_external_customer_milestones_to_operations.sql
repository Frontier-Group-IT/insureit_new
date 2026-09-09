-- External Claim stage authority alignment.
--
-- User-approved rule:
-- - Customer External Claim milestone progress is also the official Operations stage position.
-- - Customer progress may advance Operations to the same stage, but must never move Operations backward.
-- - A fully completed 9-stage Customer External journey makes the Operations claim Claim Complete.
-- - Internal/SIBL claims are unaffected.

create or replace function public.external_claim_operations_stage_rank(p_status text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case
    when p_status in ('Draft', 'Accident Reported', 'Initial Documents Pending', 'Documents Pending') then 1
    when p_status in (
      'Initial Documents Submitted',
      'Initial Documents Verification Pending',
      'Documents Submitted',
      'Initial Documents Verified',
      'Claim Intimated',
      'Surveyor Appointed'
    ) then 2
    when p_status in (
      'Vehicle Inspected',
      'Spot Survey Completed',
      'Final Documents Awaited',
      'Final Documents Verification Pending',
      'Final Documents Submitted',
      'Final Documents Verified',
      'Claim Intimation',
      'Final Surveyor Details',
      'Survey Status'
    ) then 3
    when p_status in ('Survey Done', 'Estimate Submitted', 'Approval Pending', 'Work Approval Status') then 4
    when p_status in ('Work Approval Received', 'Under Repair', 'Repair Started', 'Repair Done', 'Repair Completed', 'RA Intimation') then 5
    when p_status = 'RA Intimation Done' then 6
    when p_status in ('Final Bill Submitted', 'DO Status') then 7
    when p_status = 'DO Submitted' then 8
    when p_status in ('Payment Stage', 'Claim Completion In Progress', 'Settlement Under Process', 'Claim Complete', 'Settled', 'Closed') then 9
    else 0
  end;
$$;

create or replace function public.external_claim_customer_completed_stage(p_claim_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_keys text[] := array[
    'spot_intimation',
    'spot_status',
    'claim_intimation',
    'work_approval',
    'repair_ri',
    'billing',
    'delivery_order',
    'vehicle_delivery',
    'payment_encashment'
  ];
  v_stage integer := 0;
  v_index integer;
begin
  for v_index in 1..array_length(v_keys, 1) loop
    if exists (
      select 1
      from public.claim_milestones cm
      where cm.claim_id = p_claim_id
        and cm.milestone_key::text = v_keys[v_index]
        and cm.milestone_status::text in ('completed', 'not_applicable')
    ) then
      v_stage := v_index;
    else
      exit;
    end if;
  end loop;

  return v_stage;
end;
$$;

create or replace function public.sync_external_claim_operations_stage(
  p_claim_id uuid,
  p_changed_by uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims%rowtype;
  v_customer_stage integer;
  v_operations_stage integer;
  v_target_status public.claim_status;
  v_changed_by uuid := p_changed_by;
begin
  select *
    into v_claim
    from public.claims
   where id = p_claim_id
   for update;

  if not found then
    return;
  end if;

  if coalesce(v_claim.policy_service_source::text, '') <> 'external'
     or v_claim.external_policy_id is null then
    return;
  end if;

  -- Never let Customer milestone synchronization reopen or overwrite an explicit
  -- Operations terminal decision.
  if v_claim.current_status::text in ('Rejected', 'Settled', 'Closed') then
    return;
  end if;

  v_customer_stage := public.external_claim_customer_completed_stage(p_claim_id);
  if v_customer_stage = 0 then
    return;
  end if;

  v_operations_stage := public.external_claim_operations_stage_rank(v_claim.current_status::text);

  -- Customer completion is an official forward floor for External Claims, not a
  -- rollback mechanism. If Operations is already further ahead, preserve it.
  if v_operations_stage > v_customer_stage then
    return;
  end if;

  v_target_status := case v_customer_stage
    when 1 then 'Accident Reported'::public.claim_status
    when 2 then 'Surveyor Appointed'::public.claim_status
    when 3 then 'Survey Status'::public.claim_status
    when 4 then 'Work Approval Status'::public.claim_status
    when 5 then 'RA Intimation'::public.claim_status
    when 6 then 'RA Intimation Done'::public.claim_status
    when 7 then 'DO Status'::public.claim_status
    when 8 then 'DO Submitted'::public.claim_status
    when 9 then 'Claim Complete'::public.claim_status
  end;

  if v_target_status is null or v_claim.current_status = v_target_status then
    return;
  end if;

  if v_changed_by is null then
    select cm.recorded_by
      into v_changed_by
      from public.claim_milestones cm
     where cm.claim_id = p_claim_id
       and cm.milestone_status::text in ('completed', 'not_applicable')
     order by cm.completed_at desc nulls last, cm.updated_at desc
     limit 1;
  end if;

  update public.claims
     set current_status = v_target_status
   where id = p_claim_id;

  insert into public.claim_status_history (
    claim_id,
    from_status,
    to_status,
    notes,
    changed_by
  ) values (
    p_claim_id,
    v_claim.current_status,
    v_target_status,
    format(
      'Customer External Claim progress synchronized Operations to stage %s of 9.',
      v_customer_stage
    ),
    v_changed_by
  );
end;
$$;

create or replace function public.sync_external_claim_operations_stage_from_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.sync_external_claim_operations_stage(
    new.claim_id,
    coalesce(new.recorded_by, auth.uid())
  );
  return new;
end;
$$;

revoke all on function public.external_claim_operations_stage_rank(text) from public;
revoke all on function public.external_claim_customer_completed_stage(uuid) from public;
revoke all on function public.sync_external_claim_operations_stage(uuid, uuid) from public;
revoke all on function public.sync_external_claim_operations_stage_from_milestone() from public;

-- Synchronize after any Customer milestone insert/update. The helper itself is
-- External-only and no-ops when the claim is already at or beyond that stage.
drop trigger if exists trg_sync_external_claim_operations_stage on public.claim_milestones;
create trigger trg_sync_external_claim_operations_stage
after insert or update on public.claim_milestones
for each row
execute function public.sync_external_claim_operations_stage_from_milestone();

-- Backfill existing External Claims such as claims whose Customer journey was
-- completed before this rule became authoritative.
do $$
declare
  v_claim_id uuid;
begin
  for v_claim_id in
    select id
    from public.claims
    where policy_service_source::text = 'external'
      and external_policy_id is not null
  loop
    perform public.sync_external_claim_operations_stage(v_claim_id, null);
  end loop;
end;
$$;
