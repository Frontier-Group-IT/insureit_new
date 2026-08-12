-- Fix the Policy Onboarding RPC validation for registration-pending vehicles.
-- The first unregistered-vehicle migration added the mode variables, but the
-- live function retained the CRLF-formatted old validation block.

do $$
declare
  v_def text;
  v_old text := E'if v_name = '''' or length(v_phone) <> 10 or v_registration = '''' then\r\n    raise exception ''Insured name, valid 10 digit phone and registration number are required.'';\r\n  end if;';
  v_new text := E'if v_name = '''' or length(v_phone) <> 10 then\r\n    raise exception ''Insured name and valid 10 digit phone are required.'';\r\n  end if;\r\n\r\n  if not v_unregistered and v_registration = '''' then\r\n    raise exception ''Registration number is required for registered vehicles.'';\r\n  end if;\r\n\r\n  if v_unregistered and (v_chassis = '''' or v_engine = '''') then\r\n    raise exception ''Chassis number and engine number are required for unregistered vehicles.'';\r\n  end if;';
begin
  select pg_get_functiondef('public.onboard_motor_policy(jsonb)'::regprocedure) into v_def;

  if position('v_unregistered boolean;' in v_def) = 0 then
    raise exception 'onboard_motor_policy is missing unregistered vehicle mode variables';
  end if;

  if position('Insured name, valid 10 digit phone and registration number are required.' in v_def) > 0 then
    if position(v_old in v_def) = 0 then
      raise exception 'old registration-required validation block not found';
    end if;
    v_def := replace(v_def, v_old, v_new);
    execute v_def;
  end if;

  revoke all on function public.onboard_motor_policy(jsonb) from public;
  grant execute on function public.onboard_motor_policy(jsonb) to service_role;
end $$;
