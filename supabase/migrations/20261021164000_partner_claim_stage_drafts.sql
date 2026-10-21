begin;
create or replace function public.partner_app_save_claim_stage_draft(p_claim_id uuid,p_stage_key text,p_details jsonb)
returns uuid language plpgsql security definer set search_path=public,auth as $fn$
declare v_status text; v_stage public.claim_status; v_id uuid;
begin
 if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
   raise exception 'Claim is not available in your Partner scope' using errcode='42501';
 end if;
 select current_status::text into v_status from public.claims where id=p_claim_id for update;
 if v_status in ('Settled','Closed','Rejected','Claim Complete') then
   raise exception 'Completed claims cannot be changed' using errcode='22023';
 end if;
 if p_stage_key not in ('spot_status','claim_intimation','work_approval','repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment') then
   raise exception 'Invalid claim stage' using errcode='22023';
 end if;
 if p_details is null or jsonb_typeof(p_details)<>'object' or pg_column_size(p_details)>16384 then
   raise exception 'Invalid stage details' using errcode='22023';
 end if;
 -- Draft data only. The Operations status transition and verification remain authoritative.
 v_stage := case p_stage_key
   when 'spot_status' then 'Surveyor Appointed'::public.claim_status
   when 'claim_intimation' then 'Survey Status'::public.claim_status
   when 'work_approval' then 'Work Approval Status'::public.claim_status
   when 'repair_ri' then 'RA Intimation'::public.claim_status
   when 'billing' then 'Final Bill Submitted'::public.claim_status
   when 'delivery_order' then 'DO Status'::public.claim_status
   when 'vehicle_delivery' then 'Payment Stage'::public.claim_status
   else 'Settlement Under Process'::public.claim_status end;
 insert into public.claim_stage_details (claim_id,stage,details,created_by)
 values(p_claim_id,v_stage,p_details||jsonb_build_object('milestone_key',p_stage_key,'partner_draft',true),auth.uid())
 returning id into v_id;
 return v_id;
end;
$fn$;
revoke all on function public.partner_app_save_claim_stage_draft(uuid,text,jsonb) from public,anon;
grant execute on function public.partner_app_save_claim_stage_draft(uuid,text,jsonb) to authenticated,service_role;
commit;