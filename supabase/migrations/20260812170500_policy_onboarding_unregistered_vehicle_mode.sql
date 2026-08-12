-- Allow Policy Onboarding to book new vehicles whose permanent registration
-- number has not yet been issued. The existing vehicles.vehicle_no column is
-- still NOT NULL/unique, so registration-pending vehicles get an internal
-- PENDING-* vehicle reference while vehicle_no_normalized remains null.

do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'onboard_motor_policy'
    and pg_get_function_arguments(p.oid) = 'p_payload jsonb';

  if v_def is null then
    raise exception 'onboard_motor_policy(jsonb) not found';
  end if;

  if position('v_unregistered boolean;' in v_def) = 0 then
    v_def := replace(
      v_def,
      'v_capacity numeric;',
      'v_capacity numeric;' || E'\n  v_unregistered boolean;\n  v_chassis text;\n  v_engine text;\n  v_vehicle_reference text;\n  v_registration_snapshot text;'
    );
  end if;

  v_def := replace(
    v_def,
    'v_registration := upper(regexp_replace(coalesce(p_payload #>> ''{vehicle,registrationNumber}'', ''''), ''[^A-Za-z0-9]'', '''', ''g''));',
    'v_registration := upper(regexp_replace(coalesce(p_payload #>> ''{vehicle,registrationNumber}'', ''''), ''[^A-Za-z0-9]'', '''', ''g''));' || E'\n  v_unregistered := coalesce(p_payload #>> ''{vehicle,registrationMode}'', ''registered'') = ''unregistered'';\n  v_chassis := upper(regexp_replace(coalesce(p_payload #>> ''{vehicle,chassisNumber}'', ''''), ''[^A-Za-z0-9]'', '''', ''g''));\n  v_engine := upper(regexp_replace(coalesce(p_payload #>> ''{vehicle,engineNumber}'', ''''), ''[^A-Za-z0-9]'', '''', ''g''));\n  v_vehicle_reference := case when v_unregistered then ''PENDING-'' || left(v_chassis, 20) else v_registration end;\n  v_registration_snapshot := case when v_unregistered then ''REGISTRATION PENDING'' else v_registration end;'
  );

  v_def := replace(
    v_def,
    'if v_name = '''' or length(v_phone) <> 10 or v_registration = '''' then
    raise exception ''Insured name, valid 10 digit phone and registration number are required.'';
  end if;',
    'if v_name = '''' or length(v_phone) <> 10 then
    raise exception ''Insured name and valid 10 digit phone are required.'';
  end if;

  if not v_unregistered and v_registration = '''' then
    raise exception ''Registration number is required for registered vehicles.'';
  end if;

  if v_unregistered and (v_chassis = '''' or v_engine = '''') then
    raise exception ''Chassis number and engine number are required for unregistered vehicles.'';
  end if;'
  );

  v_def := replace(
    v_def,
    'select * into v_existing_vehicle
  from public.vehicles
  where vehicle_no_normalized = v_registration
  for update;',
    'if v_unregistered then
    select * into v_existing_vehicle
    from public.vehicles
    where upper(chassis_no) = v_chassis
    for update;
  else
    select * into v_existing_vehicle
    from public.vehicles
    where vehicle_no_normalized = v_registration
    for update;
  end if;'
  );

  v_def := replace(
    v_def,
    'v_customer_id, v_registration, v_registration, p_payload #>> ''{vehicle,classCode}'',',
    'v_customer_id, v_vehicle_reference, case when v_unregistered then null else v_registration end, p_payload #>> ''{vehicle,classCode}'','
  );

  v_def := replace(
    v_def,
    'nullif(p_payload #>> ''{vehicle,registrationDate}'', '''')::date, nullif(p_payload #>> ''{vehicle,registrationStatus}'', ''''), nullif(p_payload #>> ''{vehicle,statusAsOn}'', '''')::date,',
    'nullif(p_payload #>> ''{vehicle,registrationDate}'', '''')::date, coalesce(nullif(p_payload #>> ''{vehicle,registrationStatus}'', ''''), case when v_unregistered then ''registration_pending'' end), nullif(p_payload #>> ''{vehicle,statusAsOn}'', '''')::date,'
  );

  v_def := replace(
    v_def,
    'v_registration, nullif(p_payload #>> ''{vehicle,classDescription}'', ''''), nullif(p_payload #>> ''{vehicle,category}'', ''''),',
    'v_registration_snapshot, nullif(p_payload #>> ''{vehicle,classDescription}'', ''''), nullif(p_payload #>> ''{vehicle,category}'', ''''),'
  );

  execute v_def;

  revoke all on function public.onboard_motor_policy(jsonb) from public;
  grant execute on function public.onboard_motor_policy(jsonb) to service_role;
end $$;
