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

  insert into public.claim_milestones (claim_id, milestone_key, milestone_status, details, completed_at, recorded_by, recorded_by_actor)
  values (p_claim_id, p_milestone_key, 'completed', coalesce(p_details,'{}'::jsonb), p_completed_at, auth.uid(), 'customer')
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

grant execute on function public.save_self_managed_milestone(uuid,text,jsonb,timestamptz) to authenticated;
