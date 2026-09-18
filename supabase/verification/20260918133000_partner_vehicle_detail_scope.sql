do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
  into v_definition
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='partner_app_vehicle_detail'
    and pg_get_function_identity_arguments(p.oid)='p_vehicle_id uuid'
  limit 1;

  if v_definition is null then
    raise exception 'partner_app_vehicle_detail(uuid) is missing';
  end if;

  if position('partner_app_commercial_scope' in v_definition)=0 then
    raise exception 'partner_app_vehicle_detail(uuid) is not bound to Partner commercial scope';
  end if;

  if not has_function_privilege('authenticated', 'public.partner_app_vehicle_detail(uuid)', 'EXECUTE') then
    raise exception 'authenticated cannot execute partner_app_vehicle_detail(uuid)';
  end if;

  if has_function_privilege('anon', 'public.partner_app_vehicle_detail(uuid)', 'EXECUTE') then
    raise exception 'anon must not execute partner_app_vehicle_detail(uuid)';
  end if;
end;
$$;
