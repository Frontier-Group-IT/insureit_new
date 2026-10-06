begin;

create or replace function public.partner_app_renewal_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_result jsonb;
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  with scoped as (
    select
      p.end_date,
      coalesce(prem.net_premium,0::numeric) as effective_premium
    from public.policies p
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    left join lateral (
      select ppd.net_premium
      from public.policy_premium_details ppd
      where ppd.policy_id=p.id
      order by ppd.updated_at desc,ppd.created_at desc
      limit 1
    ) prem on true
    where p.end_date is not null
      and case
        when v_scope_mode='none' then false
        when v_actor_kind='intermediary' then i.id=any(v_intermediary_ids)
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        when v_actor_kind='employee' then
          p.rm_employee_id=any(v_employee_ids)
          or i.id=any(v_intermediary_ids)
          or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids))
        else false
      end
  )
  select jsonb_build_object(
    'overdue_count',count(*) filter(where end_date<current_date),
    'overdue_premium',coalesce(sum(effective_premium) filter(where end_date<current_date),0),
    'due_0_7_count',count(*) filter(where end_date between current_date and current_date+7),
    'due_0_7_premium',coalesce(sum(effective_premium) filter(where end_date between current_date and current_date+7),0),
    'due_8_15_count',count(*) filter(where end_date between current_date+8 and current_date+15),
    'due_8_15_premium',coalesce(sum(effective_premium) filter(where end_date between current_date+8 and current_date+15),0),
    'due_16_30_count',count(*) filter(where end_date between current_date+16 and current_date+30),
    'due_16_30_premium',coalesce(sum(effective_premium) filter(where end_date between current_date+16 and current_date+30),0),
    'due_30_count',count(*) filter(where end_date between current_date and current_date+30),
    'due_30_premium',coalesce(sum(effective_premium) filter(where end_date between current_date and current_date+30),0)
  )
  into v_result
  from scoped;

  return v_result;
end;
$$;

drop function if exists public.partner_app_list_renewals(integer, integer, text, text, text);

create or replace function public.partner_app_list_renewals(
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null,
  p_mode text default 'expiring',
  p_bucket text default 'all'
)
returns table (
  policy_id uuid,
  policy_code text,
  policy_no text,
  end_date date,
  net_premium numeric,
  customer_name text,
  insurer_name text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_limit integer := greatest(1,least(coalesce(p_limit,25),100));
  v_offset integer := greatest(0,least(coalesce(p_offset,0),100000));
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
  v_mode text := lower(coalesce(nullif(btrim(p_mode),''),'expiring'));
  v_bucket text := lower(coalesce(nullif(btrim(p_bucket),''),'all'));
begin
  if v_mode not in ('expiring','expired') then
    raise exception 'Invalid renewal mode';
  end if;
  if v_bucket not in ('all','0_7','8_15','16_30','overdue') then
    raise exception 'Invalid renewal bucket';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  return query
  with base as (
    select
      p.id as policy_id,
      p.policy_code,
      p.policy_no,
      p.end_date,
      coalesce(prem.net_premium,0::numeric) as net_premium,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name,
      ic.name as insurer_name,
      i.id as intermediary_id
    from public.policies p
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    left join public.customers c on c.id=p.customer_id
    left join public.insurance_companies ic on ic.id=p.insurance_company_id
    left join lateral (
      select ppd.net_premium
      from public.policy_premium_details ppd
      where ppd.policy_id=p.id
      order by ppd.updated_at desc,ppd.created_at desc
      limit 1
    ) prem on true
    where p.end_date is not null
      and case
        when v_scope_mode='none' then false
        when v_actor_kind='intermediary' then i.id=any(v_intermediary_ids)
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        when v_actor_kind='employee' then
          p.rm_employee_id=any(v_employee_ids)
          or i.id=any(v_intermediary_ids)
          or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids))
        else false
      end
  ),
  filtered as (
    select b.*
    from base b
    where
      ((v_mode='expired' and b.end_date<current_date)
        or (v_mode='expiring' and b.end_date between current_date and current_date+30))
      and case
        when v_bucket='all' then true
        when v_bucket='overdue' then b.end_date<current_date
        when v_bucket='0_7' then b.end_date between current_date and current_date+7
        when v_bucket='8_15' then b.end_date between current_date+8 and current_date+15
        when v_bucket='16_30' then b.end_date between current_date+16 and current_date+30
        else false
      end
      and (
        v_search is null
        or b.policy_no ilike '%'||v_search||'%'
        or b.policy_code ilike '%'||v_search||'%'
        or b.customer_name ilike '%'||v_search||'%'
        or b.insurer_name ilike '%'||v_search||'%'
      )
  )
  select
    f.policy_id,
    f.policy_code,
    f.policy_no,
    f.end_date,
    f.net_premium,
    f.customer_name,
    f.insurer_name,
    count(*) over() as total_count
  from filtered f
  order by f.end_date asc,f.policy_id asc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.partner_app_renewal_summary() from public;
revoke all on function public.partner_app_renewal_summary() from anon;
grant execute on function public.partner_app_renewal_summary() to authenticated;
grant execute on function public.partner_app_renewal_summary() to service_role;

revoke all on function public.partner_app_list_renewals(integer,integer,text,text,text) from public;
revoke all on function public.partner_app_list_renewals(integer,integer,text,text,text) from anon;
grant execute on function public.partner_app_list_renewals(integer,integer,text,text,text) to authenticated;
grant execute on function public.partner_app_list_renewals(integer,integer,text,text,text) to service_role;

comment on function public.partner_app_renewal_summary()
is 'Returns renewal counts and net-premium totals for the authenticated Partner commercial scope.';

comment on function public.partner_app_list_renewals(integer,integer,text,text,text)
is 'Returns scoped Partner renewal rows with net premium and optional renewal-window bucket filtering.';

commit;
