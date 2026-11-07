-- Revert Partner App claim-write permission guards to exact pre-change production definitions.
CREATE OR REPLACE FUNCTION public.partner_app_attach_claim_document(p_claim_id uuid, p_document_type text, p_file_name text, p_storage_path text, p_mime_type text DEFAULT NULL::text, p_file_size bigint DEFAULT NULL::bigint, p_milestone_key text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_customer_id uuid;
  v_id uuid;
begin
  if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim not available in your Partner scope' using errcode='42501';
  end if;

  select customer_id into v_customer_id from public.claims where id=p_claim_id;
  if not found then raise exception 'Claim not found' using errcode='22023'; end if;

  if nullif(btrim(coalesce(p_document_type,'')),'') is null
     or nullif(btrim(coalesce(p_file_name,'')),'') is null
     or p_storage_path is null
     or split_part(p_storage_path,'/',1) <> v_customer_id::text
     or split_part(p_storage_path,'/',2) <> p_claim_id::text then
    raise exception 'Invalid claim document metadata' using errcode='22023';
  end if;

  insert into public.claim_documents(
    claim_id,customer_id,document_type,file_name,storage_bucket,storage_path,mime_type,file_size,
    verification_status,uploaded_by,milestone_key,verification_required
  )
  values(
    p_claim_id,v_customer_id,left(btrim(p_document_type),160),left(btrim(p_file_name),255),
    'claim-documents',p_storage_path,nullif(btrim(coalesce(p_mime_type,'')),''),
    p_file_size,'pending',auth.uid(),
    case when nullif(btrim(coalesce(p_milestone_key,'')),'') is null then null else p_milestone_key::public.claim_milestone_key end,
    true
  )
  returning id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.partner_app_create_claim(p_customer_id uuid, p_vehicle_id uuid, p_policy_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_claim_id uuid; v_insurer uuid; v_existing uuid; v_claim_no text;
begin
 if auth.uid() is null or not public.partner_app_customer_in_scope(p_customer_id) then
   raise exception 'Partner customer access denied' using errcode='42501';
 end if;
 if not exists(select 1 from public.vehicles where id=p_vehicle_id and customer_id=p_customer_id) then
   raise exception 'Vehicle is not linked to the selected customer' using errcode='42501';
 end if;
 if p_policy_id is not null then
   select insurance_company_id into v_insurer from public.policies
   where id=p_policy_id and customer_id=p_customer_id and vehicle_id=p_vehicle_id;
   if not found or not public.partner_app_policy_in_scope(p_policy_id) then
     raise exception 'Policy is not authorized for this customer and vehicle' using errcode='42501';
   end if;
 end if;
 perform pg_advisory_xact_lock(hashtextextended('partner-claim:'||p_customer_id::text||':'||p_vehicle_id::text||':'||coalesce(p_policy_id::text,'none'),0));
 select id into v_existing from public.claims
 where customer_id=p_customer_id and vehicle_id=p_vehicle_id
   and (case when p_policy_id is null then policy_id is null and external_policy_id is null else policy_id=p_policy_id end)
   and coalesce(current_status::text,'') not in ('Settled','Closed','Claim Complete','Rejected')
 order by created_at desc limit 1;
 if v_existing is not null then return v_existing; end if;
 v_claim_no:='CLM-'||to_char(clock_timestamp(),'YYYYMMDDHH24MISSMS')||'-'||floor(random()*10000)::int::text;
 insert into public.claims(claim_no,customer_id,vehicle_id,policy_id,insurance_company_id,current_status,created_by)
 values(v_claim_no,p_customer_id,p_vehicle_id,p_policy_id,v_insurer,'Draft',auth.uid())
 returning id into v_claim_id;
 return v_claim_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.partner_app_insert_claim_stage_detail(p_claim_id uuid, p_stage claim_status, p_details jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_actor uuid := auth.uid();
  v_id uuid;
begin
  if v_actor is null then
    raise exception 'Authentication is required.' using errcode='28000';
  end if;

  if not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim is not available in this Partner scope' using errcode='42501';
  end if;

  insert into public.claim_stage_details(claim_id, stage, details, created_by)
  values (p_claim_id, p_stage, coalesce(p_details, '{}'::jsonb), v_actor)
  returning id into v_id;

  return v_id;
end;
$function$;

CREATE OR REPLACE FUNCTION public.partner_app_remove_claim_document(p_claim_id uuid, p_document_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_storage_path text;
begin
  if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim not available in your Partner scope' using errcode = '42501';
  end if;

  delete from public.claim_documents d
  where d.id = p_document_id
    and d.claim_id = p_claim_id
    and d.uploaded_by = auth.uid()
    and d.verification_status = 'pending'
    and d.storage_bucket = 'claim-documents'
  returning d.storage_path into v_storage_path;

  if v_storage_path is null then
    raise exception 'Document cannot be deleted or is not available in your account' using errcode = '42501';
  end if;

  return v_storage_path;
end;
$function$;

CREATE OR REPLACE FUNCTION public.partner_app_save_claim_spot(p_claim_id uuid, p_accident_at timestamp with time zone, p_spot_intimation_at timestamp with time zone, p_location text, p_driver_name text, p_driver_phone text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare v_customer_id uuid; v_status text;
begin
 select customer_id,current_status::text into v_customer_id,v_status from public.claims where id=p_claim_id;
 if not found or auth.uid() is null or not public.partner_app_customer_in_scope(v_customer_id) then
   raise exception 'Claim not available in your Partner scope' using errcode='42501';
 end if;
 if v_status not in ('Draft','Initial Documents Pending') then
   raise exception 'Claim cannot be edited at this stage' using errcode='22023';
 end if;
 if p_accident_at is null or p_spot_intimation_at is null or p_accident_at>p_spot_intimation_at
   or p_spot_intimation_at>now() or length(btrim(coalesce(p_location,'')))=0
   or length(btrim(coalesce(p_driver_name,'')))=0 or length(btrim(coalesce(p_driver_phone,'')))=0 then
   raise exception 'Complete valid incident, spot, driver and location details' using errcode='22023';
 end if;
 update public.claims set accident_at=p_accident_at,spot_intimation_at=p_spot_intimation_at,
   accident_location=left(btrim(p_location),500),
   accident_description=left('Driver: '||btrim(p_driver_name)||E'\nDriver phone: '||btrim(p_driver_phone),2000),
   current_status='Initial Documents Pending'
 where id=p_claim_id;
 return true;
end;
$function$;

CREATE OR REPLACE FUNCTION public.partner_app_save_claim_stage(p_claim_id uuid, p_milestone_key text, p_details jsonb, p_advance boolean DEFAULT true)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_status public.claim_status;
  v_detail_stage public.claim_status;
  v_payload jsonb := coalesce(p_details,'{}'::jsonb);
  v_required text[];
  v_key text := lower(btrim(coalesce(p_milestone_key,'')));
begin
  if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim not available in your Partner scope' using errcode='42501';
  end if;

  select current_status into v_status
  from public.claims
  where id=p_claim_id and claim_service_mode='broker_managed';
  if not found then raise exception 'Managed claim not found' using errcode='22023'; end if;

  if v_key not in ('spot_status','claim_intimation','work_approval','repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment') then
    raise exception 'Unsupported Partner claim stage' using errcode='22023';
  end if;

  v_required := case v_key
    when 'spot_status' then array['spot_survey_done_date']
    when 'claim_intimation' then array['claim_intimation_date','dealership_name','dealership_location','gate_in_date','estimate_amount']
    when 'work_approval' then array['approval_received_date','cashless']
    when 'repair_ri' then array['repair_complete_date','ri_done_date']
    when 'billing' then array['bill_date','bill_amount']
    when 'delivery_order' then array['assessment_received','do_date','do_amount']
    when 'vehicle_delivery' then array['vehicle_received']
    when 'payment_encashment' then array['depreciation_slip_submitted','satisfaction_voucher_submitted','payment_received_date','payment_received_amount']
    else array[]::text[]
  end;

  if exists (
    select 1 from unnest(v_required) k
    where nullif(btrim(coalesce(v_payload->>k,'')),'') is null
  ) then
    raise exception 'Complete all mandatory stage fields before saving details.' using errcode='22023';
  end if;

  if v_key='vehicle_delivery'
     and lower(coalesce(v_payload->>'vehicle_received','')) in ('true','yes','1','received')
     and nullif(btrim(coalesce(v_payload->>'vehicle_received_date','')),'') is null then
    raise exception 'Vehicle Received Date is mandatory when the vehicle is received.' using errcode='22023';
  end if;

  v_detail_stage := case v_key
    when 'spot_status' then 'Surveyor Appointed'
    when 'claim_intimation' then 'Survey Status'
    when 'work_approval' then 'Work Approval Status'
    when 'repair_ri' then 'RA Intimation'
    when 'billing' then 'Final Bill Submitted'
    when 'delivery_order' then 'DO Status'
    when 'vehicle_delivery' then 'Payment Stage'
    when 'payment_encashment' then 'Settlement Under Process'
  end::public.claim_status;

  v_payload := jsonb_set(v_payload,'{milestone_key}',to_jsonb(v_key),true);
  if p_advance then
    v_payload := jsonb_set(v_payload,'{completed_at}',to_jsonb(now()),true);
  end if;

  perform public.partner_app_insert_claim_stage_detail(p_claim_id,v_detail_stage,v_payload);

  select current_status into v_status from public.claims where id=p_claim_id;
  return jsonb_build_object('ok',true,'current_status',v_status::text);
end;
$function$;

CREATE OR REPLACE FUNCTION public.partner_app_save_insurer_claim_number(p_claim_id uuid, p_insurer_claim_no text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
declare
  v_number text := btrim(coalesce(p_insurer_claim_no, ''));
  v_status text;
  v_allowed boolean;
begin
  if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim not available in your Partner scope' using errcode='42501';
  end if;
  if length(v_number) < 1 or length(v_number) > 80 or v_number ~ '[[:cntrl:]]' then
    raise exception 'Enter a valid claim number (up to 80 characters)' using errcode='22023';
  end if;

  select c.current_status::text into v_status
  from public.claims c where c.id = p_claim_id for update;
  if not found then raise exception 'Claim not found' using errcode='22023'; end if;

  -- New workflows: milestone completion is persisted in claim_stage_details.
  select exists (
    select 1 from public.claim_stage_details s
    where s.claim_id = p_claim_id
      and s.details ->> 'milestone_key' in
        ('claim_intimation','work_approval','repair_ri','billing',
         'delivery_order','vehicle_delivery','payment_encashment')
      and s.details ? 'completed_at'
  ) into v_allowed;

  -- Legacy claims: permit only statuses strictly later than Claim Intimation.
  if not v_allowed then
    v_allowed := lower(coalesce(v_status,'')) ~
      '(work approval|repair|ri stage|billing|invoice|delivery order|vehicle deliver|payment|settled|closed|claim complete)';
  end if;
  if not v_allowed then
    raise exception 'Complete Claim Intimation before adding a claim number' using errcode='22023';
  end if;

  update public.claims set insurer_claim_no = v_number where id = p_claim_id;
  return jsonb_build_object('ok', true, 'insurer_claim_no', v_number);
end;
$function$;

DROP FUNCTION IF EXISTS public.partner_app_employee_can_write_web_capability(text);
