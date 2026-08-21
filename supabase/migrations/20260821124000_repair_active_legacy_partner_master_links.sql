create or replace function public.repair_legacy_partner_record_link(
  p_application_id uuid,
  p_actor_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing_id uuid;
  v_context text;
  v_record_source text;
  v_partner_code text;
  v_display_name text;
  v_pan text;
  v_pan_match_count integer;
begin
  select
    coalesce(a.partner_record_id, p.partner_record_id),
    coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner'),
    p.record_source,
    upper(btrim(coalesce(p.partner_id, p.raw_data ->> 'legacy_partner_code', a.draft_data ->> 'legacy_partner_code'))),
    coalesce(
      nullif(btrim(p.pos_name), ''),
      nullif(btrim(p.misp_name), ''),
      nullif(btrim(concat_ws(' ', p.pos_first_name, p.pos_middle_name, p.pos_last_name)), ''),
      nullif(btrim(concat_ws(' ', p.dp_first_name, p.dp_middle_name, p.dp_last_name)), ''),
      upper(btrim(coalesce(p.partner_id, p.raw_data ->> 'legacy_partner_code', a.draft_data ->> 'legacy_partner_code')))
    ),
    nullif(upper(btrim(p.pan_number)), '')
  into v_existing_id, v_context, v_record_source, v_partner_code, v_display_name, v_pan
  from public.intermediary_onboarding_applications a
  join public.posp_misp_onboarding_profiles p on p.application_id = a.id
  where a.id = p_application_id;

  if not found then
    raise exception 'Legacy intermediary application not found';
  end if;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  if v_context <> 'partner'
     or v_record_source not in ('legacy_manual', 'legacy_manual_pending_activation') then
    return null;
  end if;

  select id into v_existing_id
  from public.partners
  where source_application_id = p_application_id
     or (v_partner_code is not null and upper(partner_code) = v_partner_code)
  order by case when source_application_id = p_application_id then 0 else 1 end
  limit 1;

  if v_existing_id is null and v_pan is not null and v_display_name is not null then
    select count(*), min(id::text)::uuid
      into v_pan_match_count, v_existing_id
    from public.partners
    where upper(pan_number) = v_pan
      and lower(btrim(display_name)) = lower(btrim(v_display_name));

    if v_pan_match_count <> 1 then
      v_existing_id := null;
    end if;
  end if;

  if v_existing_id is null then
    v_existing_id := public.ensure_legacy_partner_record(p_application_id, p_actor_id);
    return v_existing_id;
  end if;

  update public.intermediary_onboarding_applications
  set partner_record_id = v_existing_id,
      updated_at = now()
  where id = p_application_id;

  update public.posp_misp_onboarding_profiles
  set partner_record_id = v_existing_id,
      updated_by = coalesce(p_actor_id, updated_by),
      updated_at = now()
  where application_id = p_application_id;

  return v_existing_id;
end;
$$;

create or replace function public.ensure_partner_master_after_active_intermediary()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.intermediary_type = 'partner'
     and new.account_status = 'active'
     and new.application_id is not null then
    perform public.repair_legacy_partner_record_link(
      new.application_id,
      coalesce(new.updated_by, new.created_by)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists ensure_partner_master_after_active_intermediary_trigger on public.intermediaries;
create trigger ensure_partner_master_after_active_intermediary_trigger
after insert or update of account_status, intermediary_type, application_id
on public.intermediaries
for each row
execute function public.ensure_partner_master_after_active_intermediary();

do $$
declare
  v_application_id uuid;
begin
  for v_application_id in
    select i.application_id
    from public.intermediaries i
    join public.intermediary_onboarding_applications a on a.id = i.application_id
    join public.posp_misp_onboarding_profiles p on p.application_id = a.id
    where i.intermediary_type = 'partner'
      and i.account_status = 'active'
      and coalesce(nullif(a.draft_data ->> 'account_context', ''), 'partner') = 'partner'
      and coalesce(a.partner_record_id, p.partner_record_id) is null
      and p.record_source in ('legacy_manual', 'legacy_manual_pending_activation')
  loop
    perform public.repair_legacy_partner_record_link(v_application_id, null);
  end loop;
end;
$$;
