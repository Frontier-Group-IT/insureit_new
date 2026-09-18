do $$
declare
  v_overview_definition text;
begin
  select pg_get_functiondef(p.oid)
  into v_overview_definition
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname = 'partner_app_registration_overview'
  limit 1;

  if v_overview_definition is null then
    raise exception 'partner_app_registration_overview() is missing';
  end if;

  if position('''documents''' in v_overview_definition) = 0 then
    raise exception 'partner_app_registration_overview() does not return documents';
  end if;

  if position('''activated_at''' in v_overview_definition) = 0 then
    raise exception 'partner_app_registration_overview() does not return activated_at';
  end if;

  if not exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'partner_app_can_read_registration_document_object'
  ) then
    raise exception 'partner_app_can_read_registration_document_object() is missing';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and policyname = 'Partner portal users can read own intermediary onboarding files'
      and cmd = 'SELECT'
  ) then
    raise exception 'Partner registration storage SELECT policy is missing';
  end if;
end;
$$;
