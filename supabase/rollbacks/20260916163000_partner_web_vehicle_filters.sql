begin;

drop function if exists public.partner_app_vehicle_filter_counts(text,text);
drop function if exists public.partner_app_list_vehicles_filtered(integer,integer,text,text,text);

commit;
