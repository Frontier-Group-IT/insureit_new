-- Harden the self-managed terminal state after the idempotent completion fix.
-- Legacy self-managed claims may already be in Settled, and older RPCs still
-- understand Settled as the terminal state. Treat both statuses as terminal
-- during the transition, normalize eligible legacy rows to Claim Complete,
-- and keep all public RPCs aligned with Claim Complete going forward.

create or replace function public.auto_settle_self_managed_claim_from_milestone()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims;
  v_completed_count integer;
begin
  select * into v_claim
  from public.claims
  where id = new.claim_id
  for update;

  if v_claim.id is null
     or v_claim.claim_service_mode <> 'self_managed'::public.claim_service_mode then
    return new;
  end if;

  -- Both values are reachable terminal states in existing production data.
  -- Neither should ever generate another completion notification on edits.
  if v_claim.current_status::text in ('Claim Complete', 'Settled') then
    return new;
  end if;

  select count(*) into v_completed_count
  from public.claim_milestones
  where claim_id = new.claim_id
    and milestone_key in (
      'spot_intimation','spot_status','claim_intimation','work_approval',
      'repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment'
    )
    and milestone_status in ('completed','not_applicable');

  if v_completed_count <> 9 then
    return new;
  end if;

  update public.claims
  set current_status = 'Claim Complete',
      assistance_status = case
        when assistance_status = 'requested'::public.claim_assistance_status
          then 'cancelled'::public.claim_assistance_status
        else assistance_status
      end,
      assistance_resolved_at = case
        when assistance_status = 'requested'::public.claim_assistance_status
          then now()
        else assistance_resolved_at
      end,
      updated_at = now()
  where id = new.claim_id;

  insert into public.notifications (
    customer_id, claim_id, title, message, status
  ) values (
    v_claim.customer_id,
    v_claim.id,
    'Claim Completed',
    'All 9 self-tracked claim milestones have been recorded. Your claim is now available as a completed claim history.',
    'unread'
  );

  return new;
end;
$$;

-- Normalize legacy self-managed claims that were previously auto-settled after
-- all nine milestones. This is a direct status correction and intentionally
-- does not insert a completion notification for historical completions.
update public.claims c
set current_status = 'Claim Complete',
    updated_at = now()
where c.claim_service_mode = 'self_managed'::public.claim_service_mode
  and c.current_status::text = 'Settled'
  and 9 = (
    select count(*)
    from public.claim_milestones cm
    where cm.claim_id = c.id
      and cm.milestone_key in (
        'spot_intimation','spot_status','claim_intimation','work_approval',
        'repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment'
      )
      and cm.milestone_status in ('completed','not_applicable')
  );

create or replace function public.request_claim_assistance(
  p_claim_id uuid,
  p_note text default null
)
returns public.claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_claim
  from public.claims
  where id = p_claim_id;

  if v_claim.id is null or not public.can_access_customer(v_claim.customer_id) then
    raise exception 'Claim not available.';
  end if;

  if v_claim.policy_id is null
     or v_claim.policy_service_source is distinct from 'external'::public.policy_service_source
     or v_claim.claim_service_mode <> 'self_managed'::public.claim_service_mode then
    raise exception 'Assistance can only be requested for a self-tracked customer policy claim.';
  end if;

  if v_claim.current_status::text in ('Claim Complete', 'Settled', 'Closed') then
    raise exception 'This claim is already complete.';
  end if;

  if v_claim.assistance_status = 'accepted'::public.claim_assistance_status then
    raise exception 'Sankalp assistance has already been accepted for this claim.';
  end if;

  if v_claim.assistance_status = 'requested'::public.claim_assistance_status then
    raise exception 'Assistance has already been requested for this claim.';
  end if;

  update public.claims
  set assistance_status = 'requested',
      assistance_requested_at = now(),
      assistance_requested_by = auth.uid(),
      assistance_resolved_at = null,
      assistance_resolved_by = null,
      assistance_notes = nullif(btrim(coalesce(p_note, '')), ''),
      updated_at = now()
  where id = p_claim_id
  returning * into v_claim;

  return v_claim;
end;
$$;

revoke all on function public.request_claim_assistance(uuid, text) from public;
revoke all on function public.request_claim_assistance(uuid, text) from anon;
grant execute on function public.request_claim_assistance(uuid, text) to authenticated;

create or replace function public.finalize_self_managed_claim_if_complete(p_claim_id uuid)
returns public.claims
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims;
  v_completed_count integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select * into v_claim
  from public.claims
  where id = p_claim_id
  for update;

  if v_claim.id is null or not public.can_access_customer(v_claim.customer_id) then
    raise exception 'Claim not available.';
  end if;

  if v_claim.claim_service_mode <> 'self_managed'::public.claim_service_mode then
    raise exception 'Only self-managed claims can be finalized here.';
  end if;

  if v_claim.current_status::text = 'Claim Complete' then
    return v_claim;
  end if;

  select count(*) into v_completed_count
  from public.claim_milestones
  where claim_id = p_claim_id
    and milestone_key in (
      'spot_intimation','spot_status','claim_intimation','work_approval',
      'repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment'
    )
    and milestone_status in ('completed','not_applicable');

  if v_completed_count <> 9 then
    return v_claim;
  end if;

  update public.claims
  set current_status = 'Claim Complete',
      assistance_status = case
        when assistance_status = 'requested'::public.claim_assistance_status
          then 'cancelled'::public.claim_assistance_status
        else assistance_status
      end,
      assistance_resolved_at = case
        when assistance_status = 'requested'::public.claim_assistance_status
          then now()
        else assistance_resolved_at
      end,
      updated_at = now()
  where id = p_claim_id
  returning * into v_claim;

  return v_claim;
end;
$$;

revoke all on function public.finalize_self_managed_claim_if_complete(uuid) from public;
revoke all on function public.finalize_self_managed_claim_if_complete(uuid) from anon;
grant execute on function public.finalize_self_managed_claim_if_complete(uuid) to authenticated;
