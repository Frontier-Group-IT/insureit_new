-- Make self-managed claim completion a single, idempotent database transition.
-- Completion is owned by the claim_milestones trigger so every milestone write
-- path is covered. The milestone RPC only persists milestone/financial data.

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
  -- Serialize completion checks per claim. This prevents concurrent milestone
  -- saves from creating the completion notification more than once.
  select * into v_claim
  from public.claims
  where id = new.claim_id
  for update;

  if v_claim.id is null
     or v_claim.claim_service_mode <> 'self_managed'::public.claim_service_mode then
    return new;
  end if;

  -- Once the claim has completed, later edits/saves must not perform another
  -- status write or create another completion notification.
  if v_claim.current_status::text = 'Claim Complete' then
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

  -- The notification is created only as part of the first transition from a
  -- non-complete state to Claim Complete.
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

-- Keep the existing trigger definition but point it at the corrected function.
drop trigger if exists trg_auto_settle_self_managed_claim on public.claim_milestones;
create trigger trg_auto_settle_self_managed_claim
after insert or update of milestone_status, completed_at, details
on public.claim_milestones
for each row
execute function public.auto_settle_self_managed_claim_from_milestone();

revoke all on function public.auto_settle_self_managed_claim_from_milestone() from public;
revoke all on function public.auto_settle_self_managed_claim_from_milestone() from anon;

-- Remove the second completion/status/notification path from the RPC. The
-- trigger above is now the sole authority for transitioning a self-managed
-- claim to Claim Complete.
create or replace function public.save_self_managed_milestone(
  p_claim_id uuid,
  p_milestone_key text,
  p_details jsonb,
  p_completed_at timestamptz default now()
)
returns public.claim_milestones
language plpgsql
security definer
set search_path = public
as $$
declare
  v_claim public.claims;
  v_result public.claim_milestones;
  v_bill numeric;
  v_do numeric;
  v_received numeric;
  v_milestone_key public.claim_milestone_key;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select * into v_claim from public.claims where id = p_claim_id;
  if v_claim.id is null or not public.can_access_customer(v_claim.customer_id) then
    raise exception 'Claim not available.';
  end if;
  if v_claim.claim_service_mode <> 'self_managed' then
    raise exception 'Only self-managed claims can be updated here.';
  end if;
  if coalesce(v_claim.assistance_status::text, 'not_requested') = 'accepted' then
    raise exception 'This claim is now managed by Sankalp.';
  end if;
  if p_milestone_key not in ('spot_intimation','spot_status','claim_intimation','work_approval','repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment') then
    raise exception 'Invalid milestone.';
  end if;

  v_milestone_key := p_milestone_key::public.claim_milestone_key;

  insert into public.claim_milestones (claim_id, milestone_key, milestone_status, details, completed_at, recorded_by, recorded_by_actor)
  values (p_claim_id, v_milestone_key, 'completed', coalesce(p_details,'{}'::jsonb), p_completed_at, auth.uid(), 'customer')
  on conflict (claim_id, milestone_key) do update
    set milestone_status='completed', details=excluded.details, completed_at=excluded.completed_at,
        recorded_by=auth.uid(), recorded_by_actor='customer', updated_at=now()
  returning * into v_result;

  if p_milestone_key in ('claim_intimation','work_approval','billing','delivery_order','payment_encashment') then
    insert into public.claim_financials (claim_id) values (p_claim_id)
    on conflict (claim_id) do nothing;

    if p_details ? 'estimate_amount' then
      update public.claim_financials set estimate_amount = nullif(p_details->>'estimate_amount','')::numeric where claim_id=p_claim_id;
    end if;
    if p_details ? 'approved_amount' then
      update public.claim_financials set approved_amount = nullif(p_details->>'approved_amount','')::numeric where claim_id=p_claim_id;
    end if;
    if p_details ? 'cashless' then
      update public.claim_financials set cashless = (p_details->>'cashless')::boolean where claim_id=p_claim_id;
    end if;
    if p_details ? 'bill_amount' then
      update public.claim_financials set bill_amount = nullif(p_details->>'bill_amount','')::numeric where claim_id=p_claim_id;
    end if;
    if p_details ? 'do_amount' then
      update public.claim_financials set do_amount = nullif(p_details->>'do_amount','')::numeric where claim_id=p_claim_id;
    end if;
    if p_details ? 'payment_received_amount' then
      update public.claim_financials set payment_received_amount = nullif(p_details->>'payment_received_amount','')::numeric where claim_id=p_claim_id;
    end if;

    select bill_amount, do_amount, payment_received_amount into v_bill, v_do, v_received
    from public.claim_financials where claim_id=p_claim_id;

    if v_bill is not null and v_do is not null then
      if v_do > v_bill then raise exception 'Delivery Order amount cannot exceed bill amount.'; end if;
      update public.claim_financials set customer_paid_amount = greatest(v_bill-v_do,0) where claim_id=p_claim_id;
    end if;
    if v_do is not null and v_received is not null then
      update public.claim_financials set further_deduction_amount = greatest(v_do-v_received,0) where claim_id=p_claim_id;
    end if;
  end if;

  return v_result;
end;
$$;

revoke all on function public.save_self_managed_milestone(uuid,text,jsonb,timestamptz) from public;
revoke all on function public.save_self_managed_milestone(uuid,text,jsonb,timestamptz) from anon;
grant execute on function public.save_self_managed_milestone(uuid,text,jsonb,timestamptz) to authenticated;
