begin;

create or replace function public.ensure_legacy_partner_record(
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
  v_partner_row_id uuid := gen_random_uuid();
  v_partner_code text;
  v_requested_type text;
  v_partner_type text;
  v_display_name text;
  v_pan text;
  v_phone text;
  v_email text;
  v_cols text[] := array[]::text[];
  v_vals text[] := array[]::text[];
  v_sql text;
  v_col text;
begin
  select a.partner_record_id
    into v_existing_id
  from public.intermediary_onboarding_applications a
  where a.id = p_application_id;

  if v_existing_id is not null then
    return v_existing_id;
  end if;

  select
    upper(trim(coalesce(p.partner_id, p.raw_data->>'legacy_partner_code', a.draft_data->>'legacy_partner_code'))),
    case when coalesce(a.requested_type, p.partner_type) = 'misp' then 'misp' else 'posp' end,
    coalesce(
      nullif(trim(p.pos_name), ''),
      nullif(trim(p.misp_name), ''),
      nullif(trim(concat_ws(' ', p.pos_first_name, p.pos_middle_name, p.pos_last_name)), ''),
      nullif(trim(concat_ws(' ', p.dp_first_name, p.dp_middle_name, p.dp_last_name)), ''),
      upper(trim(coalesce(p.partner_id, p.raw_data->>'legacy_partner_code', a.draft_data->>'legacy_partner_code')))
    ),
    p.pan_number,
    coalesce(a.applicant_phone, p.applicant_phone, p.dp_phone),
    coalesce(a.applicant_email, p.applicant_email, p.dp_email)
  into v_partner_code, v_requested_type, v_display_name, v_pan, v_phone, v_email
  from public.intermediary_onboarding_applications a
  join public.posp_misp_onboarding_profiles p on p.application_id = a.id
  where a.id = p_application_id;

  if v_partner_code is null or v_partner_code = '' then
    raise exception 'Existing Partner ID is required before the linked account can be created';
  end if;

  select id into v_existing_id
  from public.partners
  where upper(partner_code) = v_partner_code
  limit 1;

  if v_existing_id is not null then
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
  end if;

  v_partner_type := case when v_requested_type = 'misp' then 'business' else 'individual' end;

  -- Build the insert from columns that actually exist in the live partners table.
  -- Omitted columns retain their canonical database defaults.
  for v_col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'partners'
      and c.column_name in (
        'id','application_id','partner_code','partner_type','requested_type',
        'display_name','partner_name','legal_name','name','pan_number',
        'mobile','phone','email','account_status','status','source',
        'created_by','updated_by','created_at','updated_at'
      )
    order by c.ordinal_position
  loop
    v_cols := array_append(v_cols, quote_ident(v_col));
    v_vals := array_append(v_vals,
      case v_col
        when 'id' then quote_literal(v_partner_row_id::text) || '::uuid'
        when 'application_id' then quote_literal(p_application_id::text) || '::uuid'
        when 'partner_code' then quote_literal(v_partner_code)
        when 'partner_type' then quote_literal(v_partner_type)
        when 'requested_type' then quote_literal(v_requested_type)
        when 'display_name' then quote_literal(v_display_name)
        when 'partner_name' then quote_literal(v_display_name)
        when 'legal_name' then quote_literal(v_display_name)
        when 'name' then quote_literal(v_display_name)
        when 'pan_number' then case when v_pan is null then 'null' else quote_literal(v_pan) end
        when 'mobile' then case when v_phone is null then 'null' else quote_literal(v_phone) end
        when 'phone' then case when v_phone is null then 'null' else quote_literal(v_phone) end
        when 'email' then case when v_email is null then 'null' else quote_literal(v_email) end
        when 'account_status' then quote_literal('active')
        when 'status' then quote_literal('active')
        when 'source' then quote_literal('legacy_manual')
        when 'created_by' then case when p_actor_id is null then 'null' else quote_literal(p_actor_id::text) || '::uuid' end
        when 'updated_by' then case when p_actor_id is null then 'null' else quote_literal(p_actor_id::text) || '::uuid' end
        when 'created_at' then 'now()'
        when 'updated_at' then 'now()'
        else 'null'
      end
    );
  end loop;

  if array_length(v_cols, 1) is null then
    raise exception 'The partners table is not available';
  end if;

  v_sql := format(
    'insert into public.partners (%s) values (%s) returning id',
    array_to_string(v_cols, ','),
    array_to_string(v_vals, ',')
  );
  execute v_sql into v_partner_row_id;

  update public.intermediary_onboarding_applications
     set partner_record_id = v_partner_row_id,
         updated_at = now()
   where id = p_application_id;

  update public.posp_misp_onboarding_profiles
     set partner_record_id = v_partner_row_id,
         updated_by = coalesce(p_actor_id, updated_by),
         updated_at = now()
   where application_id = p_application_id;

  return v_partner_row_id;
end;
$$;

create or replace function public.attach_legacy_partner_record_after_activation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.partner_status = 'active_partner'
     and new.partner_record_id is null
     and coalesce(new.source, '') = 'legacy_manual' then
    perform public.ensure_legacy_partner_record(new.id, new.initiated_by);
  end if;
  return new;
end;
$$;

drop trigger if exists attach_legacy_partner_record_after_activation on public.intermediary_onboarding_applications;
create trigger attach_legacy_partner_record_after_activation
after insert or update of partner_status on public.intermediary_onboarding_applications
for each row execute function public.attach_legacy_partner_record_after_activation();

-- Repair legacy applications that were activated before this migration existed.
do $$
declare
  v_row record;
begin
  for v_row in
    select id, initiated_by
    from public.intermediary_onboarding_applications
    where partner_status = 'active_partner'
      and partner_record_id is null
      and coalesce(source, '') = 'legacy_manual'
  loop
    perform public.ensure_legacy_partner_record(v_row.id, v_row.initiated_by);
  end loop;
end;
$$;

commit;
