begin;
-- Completion follows the same managed-claim milestones and mandatory fields
-- as Operations. The existing trigger performs the actual status transition.
create or replace function public.partner_app_complete_claim_stage(
  p_claim_id uuid, p_milestone_key text, p_fields jsonb
) returns text language plpgsql security definer set search_path=public,auth as $fn$
declare
  v_claim public.claims%rowtype;
  v_old text;
  v_next text;
  v_stage public.claim_status;
  v_allowed_statuses text[];
  v_allowed_fields text[];
  v_required_fields text[];
  v_field text;
  v_details jsonb;
begin
  if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim not available in Partner scope' using errcode='42501';
  end if;
  select * into v_claim from public.claims where id=p_claim_id for update;
  if not found or v_claim.claim_service_mode::text<>'broker_managed' then
    raise exception 'Only authorized managed claims can be progressed' using errcode='42501';
  end if;
  v_old:=v_claim.current_status::text;
  if v_old in ('Claim Complete','Settled','Closed','Rejected') then
    raise exception 'This claim is closed to stage progression' using errcode='22023';
  end if;
  if p_fields is null or jsonb_typeof(p_fields)<>'object' or pg_column_size(p_fields)>12000 then
    raise exception 'Invalid stage fields' using errcode='22023';
  end if;
  case p_milestone_key
    when 'spot_status' then
      v_allowed_statuses:=array['Initial Documents Submitted','Initial Documents Verification Pending','Documents Submitted','Initial Documents Verified','Claim Intimated','Surveyor Appointed'];
      v_allowed_fields:=array['spot_survey_done_date','surveyor_name','surveyor_phone','surveyor_email'];
      v_required_fields:=array['spot_survey_done_date'];
      if v_claim.policy_service_source::text is distinct from 'external' then
        v_required_fields:=v_required_fields||array['surveyor_name','surveyor_phone','surveyor_email'];
      end if;
      v_stage:='Surveyor Appointed';
      v_next:='Final Documents Awaited';
    when 'claim_intimation' then
      v_allowed_statuses:=array['Vehicle Inspected','Spot Survey Completed','Final Documents Awaited','Final Documents Verification Pending','Final Documents Submitted','Final Documents Verified','Claim Intimation','Final Surveyor Details','Survey Status'];
      v_allowed_fields:=array['claim_intimation_date','dealership_name','dealership_location','gate_in_date','estimate_amount'];
      v_required_fields:=v_allowed_fields;
      v_stage:='Survey Status';
      v_next:='Survey Done';
    when 'work_approval' then
      v_allowed_statuses:=array['Survey Done','Estimate Submitted','Approval Pending','Work Approval Status'];
      v_allowed_fields:=array['approval_received_date','cashless'];
      v_required_fields:=v_allowed_fields;
      v_stage:='Work Approval Status';
      v_next:='Work Approval Received';
    when 'repair_ri' then
      v_allowed_statuses:=array['Work Approval Received','Under Repair','Repair Started','Repair Done','Repair Completed','RA Intimation'];
      v_allowed_fields:=array['repair_complete_date','ri_done_date'];
      v_required_fields:=v_allowed_fields;
      v_stage:='RA Intimation';
      v_next:='RA Intimation Done';
    when 'billing' then
      v_allowed_statuses:=array['RA Intimation Done'];
      v_allowed_fields:=array['bill_date','bill_amount'];
      v_required_fields:=v_allowed_fields;
      v_stage:='Final Bill Submitted';
      v_next:='Final Bill Submitted';
    when 'delivery_order' then
      v_allowed_statuses:=array['Final Bill Submitted','DO Status'];
      v_allowed_fields:=array['assessment_received','do_date','do_amount'];
      v_required_fields:=v_allowed_fields;
      v_stage:='DO Status';
      v_next:='DO Submitted';
    when 'vehicle_delivery' then
      v_allowed_statuses:=array['DO Submitted'];
      v_allowed_fields:=array['vehicle_received','vehicle_received_date'];
      v_required_fields:=v_allowed_fields;
      v_stage:='Payment Stage';
      v_next:='Payment Stage';
    when 'payment_encashment' then
      v_allowed_statuses:=array['Payment Stage','Claim Completion In Progress','Settlement Under Process'];
      v_allowed_fields:=array['depreciation_slip_submitted','satisfaction_voucher_submitted','payment_received_date','payment_received_amount'];
      v_required_fields:=v_allowed_fields;
      v_stage:='Settlement Under Process';
      v_next:='Claim Complete';
    else
      raise exception 'Invalid claim milestone' using errcode='22023';
  end case;
  if not v_old=any(v_allowed_statuses) then
    raise exception 'This stage cannot be completed from the current claim status' using errcode='22023';
  end if;
  if exists(select 1 from jsonb_each(p_fields) f
            where f.key<>all(v_allowed_fields)
            or jsonb_typeof(f.value) not in ('string','number','boolean','null')) then
    raise exception 'Restricted claim stage field' using errcode='22023';
  end if;
  foreach v_field in array v_required_fields loop
    if coalesce(nullif(btrim(p_fields->>v_field),''),'')='' then
      raise exception 'Required claim field is missing: %',v_field using errcode='22023';
    end if;
  end loop;
  if p_milestone_key='vehicle_delivery' and lower(coalesce(p_fields->>'vehicle_received','')) not in ('true','yes') then
    raise exception 'Vehicle receipt must be confirmed before advancing' using errcode='22023';
  end if;
  if p_milestone_key in ('claim_intimation','billing','delivery_order','payment_encashment') then
    v_field:=case p_milestone_key
      when 'claim_intimation' then 'estimate_amount'
      when 'billing' then 'bill_amount'
      when 'delivery_order' then 'do_amount'
      else 'payment_received_amount' end;
    if (p_fields->>v_field)!~'^([0-9]+)(\.[0-9]{1,2})?$' or (p_fields->>v_field)::numeric<0 then
      raise exception 'Invalid financial amount' using errcode='22023';
    end if;
  end if;
  v_details:=p_fields||jsonb_build_object('milestone_key',p_milestone_key,'completed_at',now(),'updated_at',now());
  insert into public.claim_stage_details(claim_id,stage,details,created_by)
    values(p_claim_id,v_stage,v_details,auth.uid());
  -- Trigger must have actually persisted the Operations-equivalent transition.
  if (select current_status::text from public.claims where id=p_claim_id)<>v_next then
    raise exception 'Claim status did not advance as expected' using errcode='P0001';
  end if;
  if p_milestone_key='claim_intimation' then
    insert into public.claim_financials(claim_id,estimate_amount,updated_at)
      values(p_claim_id,(p_fields->>'estimate_amount')::numeric,now())
      on conflict(claim_id) do update set estimate_amount=excluded.estimate_amount,updated_at=now();
  elsif p_milestone_key='billing' then
    insert into public.claim_financials(claim_id,bill_amount,updated_at)
      values(p_claim_id,(p_fields->>'bill_amount')::numeric,now())
      on conflict(claim_id) do update set bill_amount=excluded.bill_amount,updated_at=now();
  elsif p_milestone_key='delivery_order' then
    insert into public.claim_financials(claim_id,do_amount,updated_at)
      values(p_claim_id,(p_fields->>'do_amount')::numeric,now())
      on conflict(claim_id) do update set do_amount=excluded.do_amount,updated_at=now();
  end if;
  insert into public.claim_status_history(claim_id,from_status,to_status,changed_by,notes)
    values(p_claim_id,v_claim.current_status,v_next::public.claim_status,auth.uid(),'Partner completed '||replace(p_milestone_key,'_',' '));
  return v_next;
end;$fn$;
revoke all on function public.partner_app_complete_claim_stage(uuid,text,jsonb) from public,anon;
grant execute on function public.partner_app_complete_claim_stage(uuid,text,jsonb) to authenticated;
commit;
