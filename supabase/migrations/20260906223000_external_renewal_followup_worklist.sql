begin;

create or replace function public.partner_app_external_renewal_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_partner_ids uuid[] := array[]::uuid[];
  v_result jsonb;
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none') = 'none' then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  select jsonb_build_object(
    'due_0_7_count', count(*) filter (
      where o.policy_end_date between current_date and current_date + 7
        and o.opportunity_status not in ('won','lost','invalid_contact','do_not_contact','renewed_elsewhere','duplicate')
    ),
    'due_8_15_count', count(*) filter (
      where o.policy_end_date between current_date + 8 and current_date + 15
        and o.opportunity_status not in ('won','lost','invalid_contact','do_not_contact','renewed_elsewhere','duplicate')
    ),
    'due_16_30_count', count(*) filter (
      where o.policy_end_date between current_date + 16 and current_date + 30
        and o.opportunity_status not in ('won','lost','invalid_contact','do_not_contact','renewed_elsewhere','duplicate')
    ),
    'due_30_count', count(*) filter (
      where o.policy_end_date between current_date and current_date + 30
        and o.opportunity_status not in ('won','lost','invalid_contact','do_not_contact','renewed_elsewhere','duplicate')
    ),
    'expired_30_count', count(*) filter (
      where o.policy_end_date between current_date - 30 and current_date - 1
        and o.opportunity_status not in ('won','lost','invalid_contact','do_not_contact','renewed_elsewhere','duplicate')
    ),
    'uncontacted_count', count(*) filter (where o.opportunity_status='new'),
    'follow_up_due_count', count(*) filter (
      where o.next_follow_up_at is not null
        and o.next_follow_up_at <= now()
        and o.opportunity_status not in ('won','lost','invalid_contact','do_not_contact','renewed_elsewhere','duplicate')
    ),
    'follow_up_scheduled_count', count(*) filter (
      where o.next_follow_up_at is not null
        and o.next_follow_up_at > now()
        and o.opportunity_status not in ('won','lost','invalid_contact','do_not_contact','renewed_elsewhere','duplicate')
    ),
    'total_active_count', count(*) filter (
      where o.opportunity_status not in ('won','lost','invalid_contact','do_not_contact','renewed_elsewhere','duplicate')
    )
  )
  into v_result
  from public.external_renewal_opportunities o
  join public.external_renewal_import_batches b on b.id=o.batch_id
  where o.partner_id=any(v_partner_ids)
    and b.status='published'
    and o.is_active;

  return coalesce(v_result, jsonb_build_object(
    'due_0_7_count',0,
    'due_8_15_count',0,
    'due_16_30_count',0,
    'due_30_count',0,
    'expired_30_count',0,
    'uncontacted_count',0,
    'follow_up_due_count',0,
    'follow_up_scheduled_count',0,
    'total_active_count',0
  ));
end;
$$;

revoke all on function public.partner_app_external_renewal_summary() from public, anon;
grant execute on function public.partner_app_external_renewal_summary() to authenticated, service_role;

drop function if exists public.partner_app_list_external_renewals(integer,integer,text,text,text);
drop function if exists public.partner_app_list_external_renewals(integer,integer,text,text,text,text,text);

create function public.partner_app_list_external_renewals(
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null,
  p_mode text default 'due',
  p_window text default 'all',
  p_status text default 'all',
  p_follow_up text default 'all'
)
returns table (
  opportunity_id uuid,
  batch_id uuid,
  source_name text,
  account_name text,
  customer_name text,
  contact_name text,
  mobile text,
  chassis_no text,
  registration_no text,
  vehicle_make text,
  vehicle_model text,
  vehicle_lob text,
  invoice_date date,
  policy_start_date date,
  policy_end_date date,
  current_insurer text,
  current_policy_no text,
  opportunity_status text,
  last_interaction_at timestamptz,
  next_follow_up_at timestamptz,
  days_to_expiry integer,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_partner_ids uuid[] := array[]::uuid[];
  v_limit integer := greatest(1,least(coalesce(p_limit,25),100));
  v_offset integer := greatest(0,least(coalesce(p_offset,0),100000));
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
  v_mode text := lower(coalesce(nullif(btrim(p_mode),''),'due'));
  v_window text := lower(coalesce(nullif(btrim(p_window),''),'all'));
  v_status text := lower(coalesce(nullif(btrim(p_status),''),'all'));
  v_follow_up text := lower(coalesce(nullif(btrim(p_follow_up),''),'all'));
begin
  if v_mode not in ('due','expired','future','follow_up') then
    raise exception 'Invalid external renewal mode';
  end if;

  if v_window not in ('all','0_7','8_15','16_30') then
    raise exception 'Invalid external renewal window';
  end if;

  if v_status not in ('all','new','contacted','interested','quote','follow_up','closed') then
    raise exception 'Invalid external renewal status filter';
  end if;

  if v_follow_up not in ('all','due','scheduled') then
    raise exception 'Invalid external renewal follow-up filter';
  end if;

  if v_mode <> 'due' then
    v_window := 'all';
  end if;

  if v_mode <> 'follow_up' then
    v_follow_up := 'all';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none') = 'none' then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  return query
  with filtered as (
    select
      o.id as opportunity_id,
      o.batch_id,
      b.source_name,
      o.account_name,
      o.customer_name,
      o.contact_name,
      o.mobile,
      o.chassis_no,
      o.registration_no,
      o.vehicle_make,
      o.vehicle_model,
      o.vehicle_lob,
      o.invoice_date,
      o.policy_start_date,
      o.policy_end_date,
      o.current_insurer,
      o.current_policy_no,
      o.opportunity_status,
      o.last_interaction_at,
      o.next_follow_up_at,
      (o.policy_end_date-current_date)::integer as days_to_expiry,
      o.created_at
    from public.external_renewal_opportunities o
    join public.external_renewal_import_batches b on b.id=o.batch_id
    where o.partner_id=any(v_partner_ids)
      and b.status='published'
      and o.is_active
      and o.opportunity_status <> 'duplicate'
      and (
        (v_status='all' and o.opportunity_status not in ('won','lost','invalid_contact','do_not_contact','renewed_elsewhere'))
        or (v_status='new' and o.opportunity_status='new')
        or (v_status='contacted' and o.opportunity_status in ('contact_attempted','connected'))
        or (v_status='interested' and o.opportunity_status='interested')
        or (v_status='quote' and o.opportunity_status in ('quote_requested','quote_shared'))
        or (v_status='follow_up' and o.opportunity_status='follow_up')
        or (v_status='closed' and o.opportunity_status in ('won','lost','invalid_contact','do_not_contact','renewed_elsewhere'))
      )
      and (
        (v_mode='due' and o.policy_end_date between current_date and current_date+30 and (
          v_window='all'
          or (v_window='0_7' and o.policy_end_date between current_date and current_date+7)
          or (v_window='8_15' and o.policy_end_date between current_date+8 and current_date+15)
          or (v_window='16_30' and o.policy_end_date between current_date+16 and current_date+30)
        ))
        or (v_mode='expired' and o.policy_end_date between current_date-30 and current_date-1)
        or (v_mode='future' and o.policy_end_date>current_date+30)
        or (v_mode='follow_up' and o.next_follow_up_at is not null and (
          v_follow_up='all'
          or (v_follow_up='due' and o.next_follow_up_at<=now())
          or (v_follow_up='scheduled' and o.next_follow_up_at>now())
        ))
      )
      and (
        v_search is null
        or o.account_name ilike '%'||v_search||'%'
        or o.customer_name ilike '%'||v_search||'%'
        or o.contact_name ilike '%'||v_search||'%'
        or o.mobile ilike '%'||v_search||'%'
        or o.chassis_no ilike '%'||v_search||'%'
        or o.registration_no ilike '%'||v_search||'%'
        or o.vehicle_model ilike '%'||v_search||'%'
        or o.current_insurer ilike '%'||v_search||'%'
        or o.current_policy_no ilike '%'||v_search||'%'
      )
  )
  select
    f.opportunity_id,
    f.batch_id,
    f.source_name,
    f.account_name,
    f.customer_name,
    f.contact_name,
    f.mobile,
    f.chassis_no,
    f.registration_no,
    f.vehicle_make,
    f.vehicle_model,
    f.vehicle_lob,
    f.invoice_date,
    f.policy_start_date,
    f.policy_end_date,
    f.current_insurer,
    f.current_policy_no,
    f.opportunity_status,
    f.last_interaction_at,
    f.next_follow_up_at,
    f.days_to_expiry,
    count(*) over() as total_count
  from filtered f
  order by
    case when v_mode='follow_up' then f.next_follow_up_at end asc nulls last,
    case when v_mode='expired' then f.policy_end_date end desc,
    case when v_mode in ('due','future') then f.policy_end_date end asc,
    f.created_at desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.partner_app_list_external_renewals(integer,integer,text,text,text,text,text) from public, anon;
grant execute on function public.partner_app_list_external_renewals(integer,integer,text,text,text,text,text) to authenticated, service_role;

commit;
