-- Customer claim details: expose only approved Operations stage fields to
-- the owning customer, without copying operational metadata, changing workflow
-- states, or granting direct access to claim_stage_details.
create or replace function public.customer_claim_operations_stage_details(p_claim_id uuid)
returns jsonb
language plpgsql
stable security definer
set search_path = ''
as $function$
declare
  stage_row record;
  field_row record;
  stage_key text;
  field_key text;
  allowed text[];
  result jsonb := '{}'::jsonb;
begin
  if auth.uid() is null or not public.can_access_claim(auth.uid(), p_claim_id) then
    raise exception 'Claim access denied' using errcode = '42501';
  end if;

  for stage_row in
    select d.details
    from public.claim_stage_details d
    where d.claim_id = p_claim_id
      and (
        d.details->>'milestone_key' in (
          'spot_intimation','spot_status','claim_intimation','work_approval',
          'repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment'
        )
        or d.details->>'verification_type' = 'final_documents_dealership_details'
      )
    order by d.created_at asc, d.id asc
  loop
    stage_key := case when stage_row.details->>'verification_type' = 'final_documents_dealership_details'
      then 'claim_intimation' else stage_row.details->>'milestone_key' end;
    allowed := case stage_key
      when 'spot_intimation' then array['incident_at','accident_at','spot_intimation_at','driver_name','driver_phone','location','accident_location','accident_description']
      when 'spot_status' then array['spot_survey_done_date','surveyor_name','surveyor_email','surveyor_phone']
      when 'claim_intimation' then array['claim_intimation_date','dealership_name','dealership_location','gate_in_date','estimate_amount','insurer_claim_no','contact_person_name','contact_number']
      when 'work_approval' then array['approval_received_date','cashless','surveyor_name','surveyor_phone','surveyor_email']
      when 'repair_ri' then array['repair_complete_date','ri_requested_date','ri_done_date']
      when 'billing' then array['bill_date','bill_amount']
      when 'delivery_order' then array['assessment_received','do_date','do_amount']
      when 'vehicle_delivery' then array['vehicle_received','vehicle_received_date']
      when 'payment_encashment' then array['depreciation_submitted','satisfaction_submitted','documents_submit_date','payment_received_date','payment_received_amount']
      else array[]::text[] end;

    for field_row in select key, value from pg_catalog.jsonb_each(stage_row.details)
    loop
      field_key := case
        when stage_key = 'claim_intimation' and field_row.key = 'dealership_address' then 'dealership_location'
        when stage_key = 'payment_encashment' and field_row.key = 'depreciation_slip_submitted' then 'depreciation_submitted'
        when stage_key = 'payment_encashment' and field_row.key = 'satisfaction_voucher_submitted' then 'satisfaction_submitted'
        else field_row.key end;
      if field_key = any(allowed)
        and field_row.value <> 'null'::jsonb
        and field_row.value <> '""'::jsonb
        and pg_catalog.jsonb_typeof(field_row.value) in ('string','number','boolean')
      then
        result := pg_catalog.jsonb_set(result, array[stage_key], coalesce(result->stage_key,'{}'::jsonb) || pg_catalog.jsonb_build_object(field_key,field_row.value), true);
      end if;
    end loop;
  end loop;

  return result;
end;
$function$;

revoke all on function public.customer_claim_operations_stage_details(uuid) from public, anon;
grant execute on function public.customer_claim_operations_stage_details(uuid) to authenticated;
comment on function public.customer_claim_operations_stage_details(uuid) is
  'Customer-scoped read-only snapshot of allowlisted Operations claim-stage values; no workflow mutations or raw claim_stage_details access.';
