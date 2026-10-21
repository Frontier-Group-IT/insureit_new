begin;
-- Partner app claim creation is scoped server-side; no caller-supplied authorization flags.
create or replace function public.partner_app_create_claim(p_customer_id uuid,p_vehicle_id uuid,p_policy_id uuid default null)
returns uuid language plpgsql security definer set search_path=public,auth as $fn$
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
$fn$;
revoke all on function public.partner_app_create_claim(uuid,uuid,uuid) from public,anon;
grant execute on function public.partner_app_create_claim(uuid,uuid,uuid) to authenticated,service_role;
commit;
