begin;

revoke all on function public.transfer_vehicle_customer_v1(uuid,uuid,date,text,uuid) from public, anon, authenticated, service_role;
drop function if exists public.transfer_vehicle_customer_v1(uuid,uuid,date,text,uuid);

commit;
