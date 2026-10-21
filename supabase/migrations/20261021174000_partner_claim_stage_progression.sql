begin;
-- Uses the existing Operations claim_stage_details transition trigger.
-- Never permits arbitrary fields, future-stage skipping, or payment completion.
create or replace function public.partner_app_complete_claim_stage(p_claim_id uuid,p_stage_key text,p_details jsonb)
returns text language plpgsql security definer set search_path=public,auth as $fn$
declare
 v_claim public.claims%rowtype; v_stage public.claim_status; v_next text;
 v_allowed text[]; v_required text[]; v_key text; v_value text;
begin
 if auth.uid() is null or not public.partner_app_claim_in_scope(p_claim_id) then
   raise exception 'Claim not authorized' using errcode='42501';
 end if;
 select * into v_claim from public.claims where id=p_claim_id for update;
 if not found or v_claim.claim_service_mode::text <> 'broker_managed' then
   raise exception 'Only managed claims can be progressed' using errcode='22023';
 end if;
 if p_details is null or jsonb_typeof(p_details)<>'object' or pg_column_size(p_details)>16384 then
   raise exception 'Invalid claim stage details' using errcode='22023';
 end if;
 case p_stage_key
 when 'spot_status' then
   v_allowed:=array['spot_survey_done_date','surveyor_name','surveyor_email','surveyor_phone'];
   v_required:=array['spot_survey_done_date'];
   if v_claim.policy_service_source::text is distinct from 'external' then v_required:=v_required||array['surveyor_name','surveyor_email','surveyor_phone']; end if;
   v_stage:='Surveyor Appointed';v_next:='Final Documents Awaited';
   if v_claim.current_status::text not in ('Initial Documents Submitted','Initial Documents Verification Pending','Documents Submitted','Initial Documents Verified','Claim Intimated','Surveyor Appointed') then raise exception 'Claim not ready for Spot Status' using errcode='22023';end if;
 when 'claim_intimation' then
   v_allowed:=array['claim_intimation_date','dealership_name','dealership_location','gate_in_date','estimate_amount'];
   v_required:=v_allowed;
   v_stage:='Survey Status';v_next:='Survey Done';
   if v_claim.current_status::text not in ('Vehicle Inspected','Spot Survey Completed','Final Documents Awaited','Final Documents Verification Pending','Final Documents Submitted','Final Documents Verified','Claim Intimation','Final Surveyor Details','Survey Status') then raise exception 'Claim not ready for Claim Intimation' using errcode='22023';end if;
 when 'work_approval' then
   v_allowed:=array['approval_received_date','cashless','approval_remarks'];
   v_required:=array['approval_received_date','cashless'];
   v_stage:='Work Approval Status';v_next:='Work Approval Received';
   if v_claim.current_status::text not in ('Survey Done','Estimate Submitted','Approval Pending','Work Approval Status') then raise exception 'Claim not ready for Work Approval' using errcode='22023';end if;
 when 'repair_ri' then
   v_allowed:=array['repair_complete_date','ri_requested_date','ri_done_date'];
   v_required:=array['repair_complete_date','ri_done_date'];
   v_stage:='RA Intimation';v_next:='RA Intimation Done';
   if v_claim.current_status::text not in ('Work Approval Received','Under Repair','Repair Started','Repair Done','Repair Completed','RA Intimation') then raise exception 'Claim not ready for Repair and RI' using errcode='22023';end if;
 when 'billing' then
   v_allowed:=array['bill_date','bill_amount','bill_number'];
   v_required:=array['bill_date','bill_amount'];
   v_stage:='Final Bill Submitted';v_next:='Final Bill Submitted';
   if v_claim.current_status::text <> 'RA Intimation Done' then raise exception 'Claim not ready for Billing' using errcode='22023';end if;
 when 'delivery_order' then
   v_allowed:=array['assessment_received','do_date','do_amount'];
   v_required:=v_allowed;
   v_stage:='DO Status';v_next:='DO Submitted';
   if v_claim.current_status::text not in ('Final Bill Submitted','DO Status') then raise exception 'Claim not ready for Delivery Order' using errcode='22023';end if;
 when 'vehicle_delivery' then
   v_allowed:=array['vehicle_received','vehicle_received_date','receiver_name'];
   v_required:=array['vehicle_received'];
   v_stage:='Payment Stage';v_next:='Payment Stage';
   if v_claim.current_status::text <> 'DO Submitted' then raise exception 'Claim not ready for Vehicle Delivery' using errcode='22023';end if;
 else
   raise exception 'This stage requires Operations approval or is invalid' using errcode='42501';
 end case;
 for v_key,v_value in select key,value from jsonb_each_text(p_details)
 loop
   if not(v_key=any(v_allowed)) or length(v_value)>500 then raise exception 'Unsupported stage field' using errcode='22023';end if;
 end loop;
 foreach v_key in array v_required loop
   if length(btrim(coalesce(p_details->>v_key,'')))=0 then raise exception 'Complete required field: %',v_key using errcode='22023';end if;
 end loop;
 if p_stage_key='vehicle_delivery' and lower(p_details->>'vehicle_received') not in ('yes','true') then
   raise exception 'Confirm vehicle receipt before progressing' using errcode='22023';
 end if;
 if p_stage_key='vehicle_delivery' and length(btrim(coalesce(p_details->>'vehicle_received_date','')))=0 then
   raise exception 'Vehicle receipt date is required' using errcode='22023';
 end if;
 -- Existing managed-claim trigger enforces the final state transition atomically.
 insert into public.claim_stage_details(claim_id,stage,details,created_by)
 values(p_claim_id,v_stage,p_details||jsonb_build_object('milestone_key',p_stage_key,'completed_at',now()),auth.uid());
 if not exists(select 1 from public.claims where id=p_claim_id and current_status::text=v_next) then
   raise exception 'Stage progression failed; no changes were committed' using errcode='P0001';
 end if;
 insert into public.claim_status_history(claim_id,from_status,to_status,notes,changed_by)
 values(p_claim_id,v_claim.current_status,v_next::public.claim_status,'Partner completed '||replace(p_stage_key,'_',' '),auth.uid());
 return v_next;
end;
$fn$;
revoke all on function public.partner_app_complete_claim_stage(uuid,text,jsonb) from public,anon;
grant execute on function public.partner_app_complete_claim_stage(uuid,text,jsonb) to authenticated,service_role;
commit;