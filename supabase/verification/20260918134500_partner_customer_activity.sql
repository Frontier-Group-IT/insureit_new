do $$
declare
  v_definition text;
begin
  select pg_get_functiondef(p.oid)
  into v_definition
  from pg_proc p
  join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='partner_app_customer_activity'
    and pg_get_function_identity_arguments(p.oid)='p_customer_id uuid, p_limit integer'
  limit 1;

  if v_definition is null then
    raise exception 'partner_app_customer_activity(uuid, integer) is missing';
  end if;

  if position('partner_app_customer_in_scope' in v_definition)=0 then
    raise exception 'partner_app_customer_activity() is not bound to Partner customer scope';
  end if;

  if position('partner_app_policy_in_scope' in v_definition)=0 then
    raise exception 'partner_app_customer_activity() does not scope policy events';
  end if;

  if position('partner_app_claim_in_scope' in v_definition)=0 then
    raise exception 'partner_app_customer_activity() does not scope claim events';
  end if;

  if not has_function_privilege('authenticated', 'public.partner_app_customer_activity(uuid, integer)', 'EXECUTE') then
    raise exception 'authenticated cannot execute partner_app_customer_activity(uuid, integer)';
  end if;

  if has_function_privilege('anon', 'public.partner_app_customer_activity(uuid, integer)', 'EXECUTE') then
    raise exception 'anon must not execute partner_app_customer_activity(uuid, integer)';
  end if;
end;
$$;
