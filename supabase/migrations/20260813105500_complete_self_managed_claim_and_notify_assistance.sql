create or replace function public.save_self_managed_milestone(
  p_claim_id uuid,
  p_milestone_key text,
  p_details jsonb,
  p_completed_at timestamptz default now()
)
returns public.claim_milestones
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_claim public.claims;
  v_result public.claim_milestones;
  v_bill numeric;
  v_do numeric;
  v_received numeric;
  v_milestone_key public.claim_milestone_key;
  v_completed_count integer;
  v_was_complete boolean := false;
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

  v_was_complete := v_claim.current_status::text = 'Claim Complete';
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

  select count(*) into v_completed_count
  from public.claim_milestones
  where claim_id = p_claim_id
    and milestone_key in ('spot_intimation','spot_status','claim_intimation','work_approval','repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment')
    and milestone_status in ('completed','not_applicable');

  if v_completed_count = 9 then
    update public.claims
    set current_status = 'Claim Complete', updated_at = now()
    where id = p_claim_id;

    if not v_was_complete then
      insert into public.notifications (customer_id, claim_id, title, message, status)
      values (v_claim.customer_id, p_claim_id, 'Claim journey complete', 'All 9 self-tracked claim milestones have been recorded. Your claim is now available as a completed claim history.', 'unread');
    end if;
  end if;

  return v_result;
end;
$function$;

create or replace function public.resolve_claim_assistance(
  p_claim_id uuid,
  p_decision text,
  p_note text default null
)
returns public.claims
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_claim public.claims;
  v_role text;
  v_decision text := lower(btrim(coalesce(p_decision, '')));
  v_message text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  v_role := public.current_app_role()::text;
  if v_role not in ('claim_processor','manager','admin','super_admin','it_super_user') then
    raise exception 'You are not authorised to review claim assistance requests.';
  end if;
  if v_decision not in ('accepted','declined') then
    raise exception 'Decision must be accepted or declined.';
  end if;

  select * into v_claim from public.claims where id = p_claim_id for update;
  if v_claim.id is null then raise exception 'Claim not available.'; end if;
  if v_claim.external_policy_id is null then raise exception 'This is not an external-policy claim.'; end if;
  if v_claim.assistance_status <> 'requested' then raise exception 'This claim does not have a pending assistance request.'; end if;

  if v_decision = 'accepted' then
    update public.claims
    set assistance_status = 'accepted', claim_service_mode = 'broker_managed', policy_service_source = 'external',
        assistance_resolved_at = now(), assistance_resolved_by = auth.uid(),
        assistance_notes = coalesce(nullif(btrim(coalesce(p_note, '')), ''), assistance_notes),
        assigned_to = coalesce(assigned_to, auth.uid()), updated_at = now()
    where id = p_claim_id returning * into v_claim;
    v_message := 'Sankalp has accepted your assistance request. This claim is now being handled by the Claims Desk.';
  else
    update public.claims
    set assistance_status = 'declined', claim_service_mode = 'self_managed',
        assistance_resolved_at = now(), assistance_resolved_by = auth.uid(),
        assistance_notes = coalesce(nullif(btrim(coalesce(p_note, '')), ''), assistance_notes), updated_at = now()
    where id = p_claim_id returning * into v_claim;
    v_message := 'Sankalp has reviewed your assistance request. The claim remains self-tracked and you can continue updating it in the app.';
  end if;

  insert into public.notifications (customer_id, claim_id, title, message, status)
  values (v_claim.customer_id, p_claim_id,
          case when v_decision='accepted' then 'Sankalp assistance accepted' else 'Assistance request reviewed' end,
          v_message, 'unread');

  return v_claim;
end;
$function$;

revoke all on function public.save_self_managed_milestone(uuid,text,jsonb,timestamptz) from anon;
grant execute on function public.save_self_managed_milestone(uuid,text,jsonb,timestamptz) to authenticated;
revoke all on function public.resolve_claim_assistance(uuid,text,text) from anon;
grant execute on function public.resolve_claim_assistance(uuid,text,text) to authenticated;
