-- Ensure registration-pending Policy Onboarding uses chassis number for the
-- vehicle ownership lookup. The previous migration added the mode variables,
-- but the existing function definition retained CRLF line endings around this
-- block, so the first lookup replacement did not match on the live database.

do $$
declare
  v_def text;
  v_old text := E'select * into v_existing_vehicle\r\n  from public.vehicles\r\n  where vehicle_no_normalized = v_registration\r\n  for update;';
  v_new text := E'if v_unregistered then\r\n    select * into v_existing_vehicle\r\n    from public.vehicles\r\n    where upper(chassis_no) = v_chassis\r\n    for update;\r\n  else\r\n    select * into v_existing_vehicle\r\n    from public.vehicles\r\n    where vehicle_no_normalized = v_registration\r\n    for update;\r\n  end if;';
begin
  select pg_get_functiondef('public.onboard_motor_policy(jsonb)'::regprocedure) into v_def;

  if position('v_unregistered boolean;' in v_def) = 0 then
    raise exception 'onboard_motor_policy is missing unregistered vehicle mode variables';
  end if;

  if position('upper(chassis_no) = v_chassis' in v_def) = 0 then
    if position(v_old in v_def) = 0 then
      raise exception 'registered vehicle lookup block not found';
    end if;
    v_def := replace(v_def, v_old, v_new);
    execute v_def;
  end if;

  revoke all on function public.onboard_motor_policy(jsonb) from public;
  grant execute on function public.onboard_motor_policy(jsonb) to service_role;
end $$;
