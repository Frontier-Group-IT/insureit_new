-- Partner claim creation: authenticated, scoped, concurrency-safe draft preparation.
-- Deploy this additive migration before publishing the associated Partner OTA.
begin;
create or replace function public.partner_app_prepare_claim(
 p_customer_id uuid,
 p_vehicle_id uuid,
 p_policy_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $body$
declare
 v_policy_insurer uuid;
 v_existing public.claims%rowtype;
 v_new_id uuid;
 v_claim_no text;
begin
 if auth.uid() is null then
   raise exception 'Authentication required' using errcode = '28000';
 end if;
 if p_customer_id is null or p_vehicle_id is null then
   raise exception 'Select a customer and vehicle' using errcode = '22023';
 end if;
 if not public.partner_app_customer_in_scope(p_customer_id) then
   raise exception 'Customer outside Partner scope' using errcode = '42501';
 end if;
 if not exists (
   select 1 from public.vehicles v
   where v.id=p_vehicle_id and v.customer_id=p_customer_id
 ) then
   raise exception 'Vehicle is not linked to selected customer' using errcode = '42501';
 end if;
 if p_policy_id is not null then
   select p.insurance_company_id into v_policy_insurer
   from public.policies p
   where p.id=p_policy_id and p.customer_id=p_customer_id
     and p.vehicle_id=p_vehicle_id
     and public.partner_app_policy_in_scope(p.id);
   if not found then
     raise exception 'Selected policy is not accessible for this vehicle' using errcode = '42501';
   end if;
 end if;
 -- Serialize draft creation for the same vehicle, including concurrent taps.
 perform pg_advisory_xact_lock(hashtextextended(p_vehicle_id::text, 0));
 select c.* into v_existing from public.claims c
 where c.customer_id=p_customer_id and c.vehicle_id=p_vehicle_id
   and c.policy_id is not distinct from p_policy_id
   and c.external_policy_id is null
   and c.current_status::text not in ('Settled','Closed','Claim Complete','Rejected')
 order by c.created_at desc limit 1;
 if found then
   return jsonb_build_object('claim_id',v_existing.id,'claim_no',v_existing.claim_no,'reused',true);
 end if;
 v_new_id := gen_random_uuid();
 v_claim_no := 'CLM-' || to_char(clock_timestamp(), 'YYYYMMDD') || '-' || upper(substr(replace(v_new_id::text,'-',''),1,12));
 insert into public.claims(id, claim_no, customer_id, vehicle_id, policy_id, insurance_company_id, current_status, created_by)
 values(v_new_id,v_claim_no,p_customer_id,p_vehicle_id,p_policy_id,v_policy_insurer,'Draft',auth.uid());
 return jsonb_build_object('claim_id',v_new_id,'claim_no',v_claim_no,'reused',false);
end;
$body$;
revoke all on function public.partner_app_prepare_claim(uuid,uuid,uuid) from public, anon;
grant execute on function public.partner_app_prepare_claim(uuid,uuid,uuid) to authenticated;
commit;
