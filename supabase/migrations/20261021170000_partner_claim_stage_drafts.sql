begin;
-- Restrict Partner edits to active stage notes; advancing claim statuses remains subject
-- to the Operations workflow's separate authorization and required-field gates.
create or replace function public.partner_app_save_claim_stage_draft(p_claim_id uuid,p_milestone_key text,p_fields jsonb)
returns uuid language plpgsql security definer set search_path=public,auth as $fn$
declare v_status text; v_stage public.claim_status; v_id uuid; v_active int; v_target int; v_allowed text[];
begin
 if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
   raise exception 'Claim not available in Partner scope' using errcode='42501';
 end if;
 select current_status::text into v_status from public.claims where id=p_claim_id for update;
 if not found or v_status in ('Claim Complete','Settled','Closed','Rejected') then
   raise exception 'This claim is not editable' using errcode='22023';
 end if;
 v_allowed:=array['spot_status','claim_intimation','work_approval','repair_ri','billing','delivery_order','vehicle_delivery','payment_encashment'];
 v_target:=array_position(v_allowed,p_milestone_key);
 if v_target is null or p_fields is null or jsonb_typeof(p_fields)<>'object' or pg_column_size(p_fields)>12000 then
   raise exception 'Invalid claim stage details' using errcode='22023';
 end if;
 if (select count(*) from jsonb_object_keys(p_fields))>30 or exists(
   select 1 from jsonb_each(p_fields) v where v.key !~ '^[a-z][a-z0-9_]{0,63}$' or jsonb_typeof(v.value) not in ('string','number','boolean','null')
 ) then raise exception 'Invalid stage field types' using errcode='22023'; end if;
 -- Stage details do not change claim status. Partner may record details for stages
 -- already reached, never future milestones.
 v_active:=case
   when v_status ~* 'payment|settlement|encashment' then 8
   when v_status ~* 'vehicle deliver|DO Submitted' then 7
   when v_status ~* 'delivery order|DO Status|Final Bill Submitted' then 6
   when v_status ~* 'billing|invoice|RA Intimation Done' then 5
   when v_status ~* 'repair|Under Repair|Work Approval Received' then 4
   when v_status ~* 'approval|Estimate Submitted|Survey Done' then 3
   when v_status ~* 'claim intimation|Final Document|Vehicle Inspected|Spot Survey Completed' then 2
   else 1 end;
 if v_target>v_active then raise exception 'Complete earlier claim stages first' using errcode='22023'; end if;
 v_stage:=case p_milestone_key
 when 'spot_status' then 'Surveyor Appointed'::public.claim_status
 when 'claim_intimation' then 'Survey Status'::public.claim_status
 when 'work_approval' then 'Work Approval Status'::public.claim_status
 when 'repair_ri' then 'RA Intimation'::public.claim_status
 when 'billing' then 'Final Bill Submitted'::public.claim_status
 when 'delivery_order' then 'DO Status'::public.claim_status
 when 'vehicle_delivery' then 'Payment Stage'::public.claim_status
 else 'Settlement Under Process'::public.claim_status end;
 insert into public.claim_stage_details(claim_id,stage,details,created_by)
 values(p_claim_id,v_stage,jsonb_build_object('milestone_key',p_milestone_key,'partner_draft',true,'updated_at',now())||p_fields,auth.uid())
 returning id into v_id;
 return v_id;
end;$fn$;
revoke all on function public.partner_app_save_claim_stage_draft(uuid,text,jsonb) from public,anon;
grant execute on function public.partner_app_save_claim_stage_draft(uuid,text,jsonb) to authenticated;
commit;
