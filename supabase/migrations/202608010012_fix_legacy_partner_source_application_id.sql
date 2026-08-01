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
  v_partner_kind text;
  v_display_name text;
  v_pan text;
  v_phone text;
  v_email text;
  v_cols text[] := array[]::text[];
  v_vals text[] := array[]::text[];
  v_sql text;
  v_col text;
  v_unhandled_required text;
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

  v_partner_kind := case when v_requested_type = 'misp' then 'business' else 'individual' end;

  -- Fail with one explicit message if the live schema introduces another
  -- required column that this migration does not know how to populate.
  select string_agg(c.column_name, ', ' order by c.ordinal_position)
    into v_unhandled_required
  from information_schema.columns c
  where c.table_schema = 'public'
    and c.table_name = 'partners'
    and c.is_nullable = 'NO'
    and c.column_default is null
    and coalesce(c.is_identity, 'NO') = 'NO'
    and c.column_name not in (
      'id','source_application_id','application_id','partner_code','partner_kind',
      'partner_type','requested_type','display_name','partner_name','legal_name','name',
      'pan_number','mobile','phone','email','account_status','status','source',
      'created_by','updated_by','created_at','updated_at'
    );

  if v_unhandled_required is not null then
    raise exception 'Unsupported required partners columns: %', v_unhandled_required;
  end if;

  for v_col in
    select c.column_name
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'partners'
      and c.column_name in (
        'id','source_application_id','application_id','partner_code','partner_kind',
        'partner_type','requested_type','display_name','partner_name','legal_name','name',
        'pan_number','mobile','phone','email','account_status','status','source',
        'created_by','updated_by','created_at','updated_at'
      )
    order by c.ordinal_position
  loop
    v_cols := array_append(v_cols, quote_ident(v_col));
    v_vals := array_append(v_vals,
      case v_col
        when 'id' then quote_literal(v_partner_row_id::text) || '::uuid'
        when 'source_application_id' then quote_literal(p_application_id::text) || '::uuid'
        when 'application_id' then quote_literal(p_application_id::text) || '::uuid'
        when 'partner_code' then quote_literal(v_partner_code)
        when 'partner_kind' then quote_literal(v_partner_kind)
        when 'partner_type' then quote_literal(v_partner_kind)
        when 'requested_type' then quote_literal(v_requested_type)
        when 'display_name' then quote_literal(v_display_name)
        when 'partner_name' then quote_literal(v_display_name)
        when 'legal_name' then quote_literal(v_display_name)
        when 'name' then quote_literal(v_display_name)
        when 'pan_number' then case when v_pan is null then 'null' else quote_literal(v_pan) end
        when 'mobile' then case when v_phone is null then 'null' else quote_literal(v_phone) end
        when 'phone' then case when v_phone is null then 'null' else quote_literal(v_phone) end
        when 'email' then case when v_email is null then 'null' else quote_literal(v_email) end
        when 'account_status' then quote_literal('active_partner')
        when 'status' then quote_literal('active_partner')
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

-- Retry all active legacy Partner applications that are still missing their
-- canonical partners row after earlier migrations failed.
do $$
declare
  v_row record;
begin
  for v_row in
    select a.id, a.initiated_by
    from public.intermediary_onboarding_applications a
    join public.posp_misp_onboarding_profiles p on p.application_id = a.id
    where a.partner_status = 'active_partner'
      and a.partner_record_id is null
      and (
        coalesce(a.source, '') = 'legacy_manual'
        or coalesce(a.draft_data->>'onboarding_mode', '') = 'legacy_existing_partner'
        or nullif(a.draft_data->>'legacy_partner_code', '') is not null
        or coalesce(p.record_source, '') = 'legacy_manual'
        or nullif(p.raw_data->>'legacy_partner_code', '') is not null
        or nullif(p.existing_registration_code, '') is not null
      )
  loop
    perform public.ensure_legacy_partner_record(v_row.id, v_row.initiated_by);
  end loop;
end;
$$;

commit;
