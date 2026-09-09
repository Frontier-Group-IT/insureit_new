-- External Claim shared 9-stage authority.
--
-- Approved rule:
-- - Customer and Operations share one forward-only 9-stage position for External Claims.
-- - Customer completion may move Operations forward to the same stage, never backward.
-- - Operations may move the shared journey forward only through an explicit stage/status advance.
-- - Plain Operations "Save Details" writes must never advance the shared journey.
-- - When Operations moves to Stage N+1, the prior Customer milestone(s) are completed so
--   the Customer tracker opens on the same current stage.
-- - Internal/SIBL claims are unchanged.

create or replace function public.external_claim_shared_stage_rank(p_status text)
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

create or replace function public.sync_external_customer_stage_to_operations(
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
  v_has_sync_history boolean := false;
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

  -- Explicit terminal Operations decisions are never reopened by Customer edits.
  if v_claim.current_status::text in ('Rejected', 'Settled', 'Closed') then
    return;
  end if;

  v_customer_stage := public.external_claim_customer_completed_stage(p_claim_id);
  if v_customer_stage = 0 then
    return;
  end if;

  v_operations_stage := public.external_claim_shared_stage_rank(v_claim.current_status::text);

  -- Customer progress is a forward floor only. Preserve Operations if it is already
  -- at the same stage (including a more specific sub-status) or further ahead.
  -- Stage 9 is special: a complete 9/9 Customer journey completes the shared claim.
  if v_customer_stage < 9 and v_operations_stage >= v_customer_stage then
    return;
  end if;

  if v_customer_stage = 9 and v_claim.current_status::text = 'Claim Complete' then
    -- The older self-managed auto-settle trigger can complete the claim first.
    -- Keep one idempotent shared-stage audit event without inventing a false prior state.
    select exists (
      select 1
      from public.claim_status_history h
      where h.claim_id = p_claim_id
        and h.to_status::text = 'Claim Complete'
        and coalesce(h.notes, '') like 'Customer External Claim progress synchronized shared journey%'
    ) into v_has_sync_history;

    if not v_has_sync_history then
      insert into public.claim_status_history (claim_id, from_status, to_status, notes, changed_by)
      values (
        p_claim_id,
        v_claim.current_status,
        v_claim.current_status,
        'Customer External Claim progress synchronized shared journey to stage 9 of 9.',
        v_changed_by
      );
    end if;
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

  insert into public.claim_status_history (claim_id, from_status, to_status, notes, changed_by)
  values (
    p_claim_id,
    v_claim.current_status,
    v_target_status,
    format('Customer External Claim progress synchronized shared journey to stage %s of 9.', v_customer_stage),
    v_changed_by
  );
end;
$$;

create or replace function public.sync_external_customer_stage_to_operations_from_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only Customer-authored milestone progression drives this direction. Operations
  -- mirroring uses actor=sankalp and therefore cannot recurse into Operations status.
  if new.recorded_by_actor::text <> 'customer' then
    return new;
  end if;

  perform public.sync_external_customer_stage_to_operations(
    new.claim_id,
    coalesce(new.recorded_by, auth.uid())
  );
  return new;
end;
$$;

-- Any real forward Operations status change must be reflected in the Customer journey.
-- This deliberately watches claims.current_status rather than individual UI actions so
-- Stage 1, document verification transitions, and Stages 2-9 all share the same rule.
create or replace function public.sync_external_operations_stage_to_customer_from_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old_stage integer;
  v_new_stage integer;
  v_limit integer := 0;
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
  v_index integer;
  v_key text;
  v_details jsonb;
begin
  if coalesce(new.policy_service_source::text, '') <> 'external'
     or new.external_policy_id is null then
    return new;
  end if;

  -- Rejection is a terminal Operations decision, not forward Customer completion.
  if new.current_status::text = 'Rejected' then
    return new;
  end if;

  v_old_stage := public.external_claim_shared_stage_rank(old.current_status::text);
  v_new_stage := public.external_claim_shared_stage_rank(new.current_status::text);

  if v_new_stage = 0 or v_new_stage < v_old_stage then
    return new;
  end if;

  if new.current_status::text in ('Claim Complete', 'Settled', 'Closed') then
    v_limit := 9;
  elsif v_new_stage > v_old_stage then
    v_limit := v_new_stage - 1;
  else
    -- Movement within one canonical stage does not complete that stage.
    return new;
  end if;

  if v_limit <= 0 then
    return new;
  end if;

  for v_index in 1..least(v_limit, array_length(v_keys, 1)) loop
    v_key := v_keys[v_index];

    select csd.details
      into v_details
      from public.claim_stage_details csd
     where csd.claim_id = new.id
       and csd.details->>'milestone_key' = v_key
     order by csd.created_at desc
     limit 1;

    insert into public.claim_milestones (
      claim_id,
      milestone_key,
      milestone_status,
      details,
      completed_at,
      recorded_by,
      recorded_by_actor
    ) values (
      new.id,
      v_key::public.claim_milestone_key,
      'completed'::public.claim_milestone_status,
      coalesce(v_details, '{}'::jsonb),
      now(),
      auth.uid(),
      'sankalp'::public.claim_milestone_actor
    )
    on conflict (claim_id, milestone_key) do update
      set milestone_status = case
            when claim_milestones.milestone_status::text in ('completed', 'not_applicable')
              then claim_milestones.milestone_status
            else 'completed'::public.claim_milestone_status
          end,
          details = case
            when claim_milestones.milestone_status::text in ('completed', 'not_applicable')
              then claim_milestones.details
            else coalesce(claim_milestones.details, '{}'::jsonb) || excluded.details
          end,
          completed_at = case
            when claim_milestones.milestone_status::text in ('completed', 'not_applicable')
              then claim_milestones.completed_at
            else excluded.completed_at
          end,
          recorded_by = case
            when claim_milestones.milestone_status::text in ('completed', 'not_applicable')
              then claim_milestones.recorded_by
            else excluded.recorded_by
          end,
          recorded_by_actor = case
            when claim_milestones.milestone_status::text in ('completed', 'not_applicable')
              then claim_milestones.recorded_by_actor
            else excluded.recorded_by_actor
          end,
          updated_at = now();
  end loop;

  return new;
end;
$$;

revoke all on function public.external_claim_shared_stage_rank(text) from public;
revoke all on function public.external_claim_customer_completed_stage(uuid) from public;
revoke all on function public.sync_external_customer_stage_to_operations(uuid, uuid) from public;
revoke all on function public.sync_external_customer_stage_to_operations_from_milestone() from public;
revoke all on function public.sync_external_operations_stage_to_customer_from_claim() from public;

-- Keep the existing auto-settlement trigger intact. This trigger is Customer-only and
-- uses an actor guard so Operations milestone mirroring cannot recurse.
drop trigger if exists trg_sync_external_customer_stage_to_operations on public.claim_milestones;
create trigger trg_sync_external_customer_stage_to_operations
after insert or update of milestone_status, completed_at, details, recorded_by_actor on public.claim_milestones
for each row
execute function public.sync_external_customer_stage_to_operations_from_milestone();

-- Mirror every official forward External Claim status move back into Customer milestones.
drop trigger if exists trg_sync_external_operations_stage_to_customer on public.claims;
create trigger trg_sync_external_operations_stage_to_customer
after update of current_status on public.claims
for each row
when (old.current_status is distinct from new.current_status)
execute function public.sync_external_operations_stage_to_customer_from_claim();

-- Replace the managed-stage persistence function additively. Internal/SIBL behavior
-- is preserved; only External Claims gain the explicit-completion guard.
create or replace function public.persist_managed_claim_stage_transition_from_details()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims%rowtype;
  v_stage_key text;
  v_status text;
  v_rows integer := 0;
begin
  v_stage_key := coalesce(new.details->>'milestone_key', '');

  if v_stage_key not in (
    'spot_status',
    'claim_intimation',
    'work_approval',
    'repair_ri',
    'billing',
    'delivery_order',
    'vehicle_delivery',
    'payment_encashment'
  ) then
    return new;
  end if;

  if auth.uid() is null or new.created_by is distinct from auth.uid() then
    raise exception 'The workflow user does not match the authenticated user.';
  end if;

  if not public.is_operations_role() or not public.can_access_claim(auth.uid(), new.claim_id) then
    raise exception 'You do not have permission to update this managed claim stage.';
  end if;

  select *
    into v_claim
    from public.claims
   where id = new.claim_id
     and claim_service_mode = 'broker_managed'
   for update;

  if not found then
    raise exception 'Managed claim not found.';
  end if;

  -- Keep authoritative claim summary fields synchronized from every detail save.
  update public.claims
     set insurer_claim_no = case
           when new.details ? 'insurer_claim_no'
             and nullif(btrim(new.details->>'insurer_claim_no'), '') is not null
           then btrim(new.details->>'insurer_claim_no')
           else insurer_claim_no
         end,
         approved_amount = case
           when new.details ? 'approved_amount'
             and nullif(btrim(new.details->>'approved_amount'), '') is not null
           then (new.details->>'approved_amount')::numeric
           else approved_amount
         end,
         settlement_amount = case
           when new.details ? 'payment_received_amount'
             and nullif(btrim(new.details->>'payment_received_amount'), '') is not null
           then (new.details->>'payment_received_amount')::numeric
           else settlement_amount
         end
   where id = new.claim_id;

  -- External "Save Details" writes do not carry the server-only completion marker.
  -- Therefore they can update values but cannot silently advance the shared stage.
  if v_claim.policy_service_source::text = 'external'
     and not (new.details ? 'completed_at') then
    return new;
  end if;

  v_status := v_claim.current_status::text;

  if v_stage_key = 'spot_status'
     and v_status in (
       'Initial Documents Submitted',
       'Initial Documents Verification Pending',
       'Documents Submitted',
       'Initial Documents Verified',
       'Claim Intimated',
       'Surveyor Appointed'
     ) then
    update public.claims set current_status = 'Final Documents Awaited'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'claim_intimation'
     and v_status in (
       'Vehicle Inspected',
       'Spot Survey Completed',
       'Final Documents Awaited',
       'Final Documents Verification Pending',
       'Final Documents Submitted',
       'Final Documents Verified',
       'Claim Intimation',
       'Final Surveyor Details',
       'Survey Status'
     ) then
    update public.claims set current_status = 'Survey Done'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'work_approval'
     and v_status in ('Survey Done', 'Estimate Submitted', 'Approval Pending', 'Work Approval Status') then
    update public.claims set current_status = 'Work Approval Received'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'repair_ri'
     and v_status in ('Work Approval Received', 'Under Repair', 'Repair Started', 'Repair Done', 'Repair Completed', 'RA Intimation') then
    update public.claims set current_status = 'RA Intimation Done'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'billing'
     and v_status = 'RA Intimation Done' then
    update public.claims set current_status = 'Final Bill Submitted'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'delivery_order'
     and v_status in ('Final Bill Submitted', 'DO Status') then
    update public.claims set current_status = 'DO Submitted'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'vehicle_delivery'
     and v_status = 'DO Submitted' then
    update public.claims set current_status = 'Payment Stage'
     where id = new.claim_id and current_status::text = v_status;

  elsif v_stage_key = 'payment_encashment'
     and v_status in ('Payment Stage', 'Claim Completion In Progress', 'Settlement Under Process') then
    update public.claims set current_status = 'Claim Complete'
     where id = new.claim_id and current_status::text = v_status;

  else
    -- Historical/completed-stage edits deliberately do not change current_status.
    return new;
  end if;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then
    raise exception 'The claim stage could not be persisted.';
  end if;

  return new;
end;
$$;

revoke all on function public.persist_managed_claim_stage_transition_from_details() from public;

drop trigger if exists trg_persist_managed_claim_stage_transition on public.claim_stage_details;
create trigger trg_persist_managed_claim_stage_transition
after insert on public.claim_stage_details
for each row
execute function public.persist_managed_claim_stage_transition_from_details();

-- Bring existing External Claims forward to the Customer's latest contiguous stage.
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
    perform public.sync_external_customer_stage_to_operations(v_claim_id, null);
  end loop;
end;
$$;
