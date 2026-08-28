begin;

create or replace function public.partner_app_claim_summary()
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
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_result jsonb;
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope ->> 'actor_kind';
  v_scope_mode := coalesce(v_scope ->> 'scope_mode', 'none');

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'intermediary_ids', '[]'::jsonb)) value;

  with scoped_claims as (
    select cl.*
    from public.claims cl
    join public.customers c on c.id = cl.customer_id
    where
      case
        when v_scope_mode = 'none' then false
        when v_actor_kind = 'employee' and v_scope_mode = 'organization' then true
        else c.lead_source_intermediary_id = any(v_intermediary_ids)
      end
  )
  select jsonb_build_object(
    'total_claims', count(*),
    'active_claims', count(*) filter (
      where lower(coalesce(current_status::text, '')) <> 'claim complete'
    ),
    'completed_claims', count(*) filter (
      where lower(coalesce(current_status::text, '')) = 'claim complete'
    ),
    'assistance_requested', count(*) filter (
      where assistance_status is not null
        and lower(assistance_status::text) not in ('none','not_requested','resolved','closed')
    )
  )
  into v_result
  from scoped_claims;

  return v_result;
end;
$$;

create or replace function public.partner_app_list_claims(
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null,
  p_state text default 'all'
)
returns table (
  claim_id uuid,
  claim_no text,
  insurer_claim_no text,
  current_status text,
  claim_state text,
  claim_service_mode text,
  assistance_status text,
  customer_id uuid,
  customer_name text,
  vehicle_id uuid,
  vehicle_no text,
  policy_no text,
  insurer_name text,
  accident_at timestamptz,
  estimated_loss numeric,
  approved_amount numeric,
  settlement_amount numeric,
  created_at timestamptz,
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
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_limit integer := greatest(1, least(coalesce(p_limit,25),100));
  v_offset integer := greatest(0, least(coalesce(p_offset,0),100000));
  v_search text := nullif(btrim(coalesce(p_search,'')), '');
  v_state text := lower(coalesce(nullif(btrim(p_state),''),'all'));
begin
  if v_state not in ('all','active','completed') then
    raise exception 'Invalid claim state filter';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope ->> 'actor_kind';
  v_scope_mode := coalesce(v_scope ->> 'scope_mode', 'none');

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'intermediary_ids', '[]'::jsonb)) value;

  return query
  with base as (
    select
      cl.id as claim_id,
      cl.claim_no,
      cl.insurer_claim_no,
      cl.current_status::text as current_status,
      case when lower(coalesce(cl.current_status::text,''))='claim complete' then 'completed' else 'active' end as claim_state,
      cl.claim_service_mode::text as claim_service_mode,
      cl.assistance_status::text as assistance_status,
      cl.customer_id,
      coalesce(nullif(c.company_name,''), nullif(c.contact_name,''), c.customer_code, 'Customer') as customer_name,
      cl.vehicle_id,
      v.vehicle_no,
      ep.policy_no,
      ic.name as insurer_name,
      cl.accident_at,
      cl.estimated_loss,
      cl.approved_amount,
      cl.settlement_amount,
      cl.created_at,
      c.lead_source_intermediary_id
    from public.claims cl
    join public.customers c on c.id=cl.customer_id
    left join public.vehicles v on v.id=cl.vehicle_id
    left join public.external_policies ep on ep.id=cl.external_policy_id
    left join public.insurance_companies ic on ic.id=cl.insurance_company_id
    where
      case
        when v_scope_mode='none' then false
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        else c.lead_source_intermediary_id=any(v_intermediary_ids)
      end
  ),
  filtered as (
    select b.*
    from base b
    where
      (v_state='all' or b.claim_state=v_state)
      and (
        v_search is null
        or b.claim_no ilike '%'||v_search||'%'
        or b.insurer_claim_no ilike '%'||v_search||'%'
        or b.customer_name ilike '%'||v_search||'%'
        or b.vehicle_no ilike '%'||v_search||'%'
        or b.policy_no ilike '%'||v_search||'%'
        or b.insurer_name ilike '%'||v_search||'%'
      )
  )
  select
    f.claim_id,
    f.claim_no,
    f.insurer_claim_no,
    f.current_status,
    f.claim_state,
    f.claim_service_mode,
    f.assistance_status,
    f.customer_id,
    f.customer_name,
    f.vehicle_id,
    f.vehicle_no,
    f.policy_no,
    f.insurer_name,
    f.accident_at,
    f.estimated_loss,
    f.approved_amount,
    f.settlement_amount,
    f.created_at,
    count(*) over() as total_count
  from filtered f
  order by coalesce(f.accident_at,f.created_at) desc, f.created_at desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.partner_app_claim_summary() from public, anon;
revoke all on function public.partner_app_list_claims(integer,integer,text,text) from public, anon;

grant execute on function public.partner_app_claim_summary() to authenticated, service_role;
grant execute on function public.partner_app_list_claims(integer,integer,text,text) to authenticated, service_role;

commit;
