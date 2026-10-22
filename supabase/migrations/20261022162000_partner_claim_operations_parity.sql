begin;

create or replace function public.partner_app_save_claim_stage(
  p_claim_id uuid,
  p_milestone_key text,
  p_details jsonb,
  p_advance boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path=public,auth
as $fn$
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
$fn$;

revoke all on function public.partner_app_save_claim_stage(uuid,text,jsonb,boolean) from public,anon;
grant execute on function public.partner_app_save_claim_stage(uuid,text,jsonb,boolean) to authenticated,service_role;

create or replace function public.partner_app_attach_claim_document(
  p_claim_id uuid,
  p_document_type text,
  p_file_name text,
  p_storage_path text,
  p_mime_type text default null,
  p_file_size bigint default null,
  p_milestone_key text default null
)
returns uuid
language plpgsql
security definer
set search_path=public,auth
as $fn$
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
$fn$;

revoke all on function public.partner_app_attach_claim_document(uuid,text,text,text,text,bigint,text) from public,anon;
grant execute on function public.partner_app_attach_claim_document(uuid,text,text,text,text,bigint,text) to authenticated,service_role;

drop policy if exists "partner claim document scoped insert" on storage.objects;
create policy "partner claim document scoped insert"
on storage.objects for insert
to authenticated
with check (
  bucket_id='claim-documents'
  and split_part(name,'/',1) ~* '^[0-9a-f-]{36}$'
  and split_part(name,'/',2) ~* '^[0-9a-f-]{36}$'
  and exists (
    select 1 from public.claims c
    where c.customer_id=split_part(storage.objects.name,'/',1)::uuid
      and c.id=split_part(storage.objects.name,'/',2)::uuid
      and public.partner_app_claim_in_scope(c.id)
  )
);

commit;
