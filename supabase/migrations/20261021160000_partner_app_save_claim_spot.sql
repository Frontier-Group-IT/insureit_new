begin;
create or replace function public.partner_app_save_claim_spot(p_claim_id uuid,p_accident_at timestamptz,p_spot_intimation_at timestamptz,p_location text,p_driver_name text,p_driver_phone text)
returns boolean language plpgsql security definer set search_path=public,auth as $fn$
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
$fn$;
revoke all on function public.partner_app_save_claim_spot(uuid,timestamptz,timestamptz,text,text,text) from public,anon;
grant execute on function public.partner_app_save_claim_spot(uuid,timestamptz,timestamptz,text,text,text) to authenticated,service_role;
commit;
