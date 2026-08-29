begin;

create or replace function public.partner_app_customer_in_scope(p_customer_id uuid)
returns boolean
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
  v_lead_source_intermediary_id uuid;
begin
  if p_customer_id is null then
    return false;
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    return false;
  end if;

  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');

  if v_scope_mode='none' then
    return false;
  end if;

  if v_actor_kind='employee' and v_scope_mode='organization' then
    return exists(select 1 from public.customers c where c.id=p_customer_id);
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;

  select c.lead_source_intermediary_id
  into v_lead_source_intermediary_id
  from public.customers c
  where c.id=p_customer_id;

  return v_lead_source_intermediary_id is not null
    and v_lead_source_intermediary_id=any(v_intermediary_ids);
end;
$$;

create or replace function public.partner_app_policy_in_scope(p_policy_id uuid)
returns boolean
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
  v_policy public.policies%rowtype;
  v_intermediary_id uuid;
begin
  if p_policy_id is null then
    return false;
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    return false;
  end if;

  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');

  if v_scope_mode='none' then
    return false;
  end if;

  select * into v_policy
  from public.policies
  where id=p_policy_id;

  if not found then
    return false;
  end if;

  if v_actor_kind='employee' and v_scope_mode='organization' then
    return true;
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  select i.id
  into v_intermediary_id
  from public.intermediaries i
  where i.intermediary_code=v_policy.intermediary_code
  limit 1;

  if v_actor_kind='intermediary' then
    return v_intermediary_id is not null
      and v_intermediary_id=any(v_intermediary_ids);
  end if;

  if v_actor_kind='employee' then
    return v_policy.rm_employee_id=any(v_employee_ids)
      or (v_intermediary_id is not null and v_intermediary_id=any(v_intermediary_ids))
      or (v_policy.intermediary_group_id is not null and v_policy.intermediary_group_id=any(v_group_ids));
  end if;

  return false;
end;
$$;

create or replace function public.partner_app_claim_in_scope(p_claim_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_customer_id uuid;
begin
  select c.customer_id
  into v_customer_id
  from public.claims c
  where c.id=p_claim_id;

  if not found then
    return false;
  end if;

  return public.partner_app_customer_in_scope(v_customer_id);
end;
$$;

create or replace function public.partner_app_policy_summary()
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

  with scoped_policies as (
    select
      p.*,
      coalesce(prem.gross_premium,p.premium_amount,0) as effective_premium
    from public.policies p
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    left join lateral (
      select ppd.gross_premium
      from public.policy_premium_details ppd
      where ppd.policy_id=p.id
      order by ppd.updated_at desc,ppd.created_at desc
      limit 1
    ) prem on true
    where case
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
    'total_policies',count(*),
    'in_force_policies',count(*) filter(
      where coalesce(start_date,current_date)<=current_date
        and (end_date is null or end_date>=current_date)
    ),
    'expiring_30_days',count(*) filter(where end_date between current_date and current_date+30),
    'expired_policies',count(*) filter(where end_date is not null and end_date<current_date),
    'upcoming_policies',count(*) filter(where start_date is not null and start_date>current_date),
    'total_premium',coalesce(sum(effective_premium),0),
    'motor_policies',count(*) filter(
      where lower(coalesce(policy_type,''))='motor'
        or lower(coalesce(business_line,''))='motor'
    )
  )
  into v_result
  from scoped_policies;

  return v_result;
end;
$$;

create or replace function public.partner_app_list_policies(
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null,
  p_lifecycle text default 'all'
)
returns table (
  policy_id uuid,
  policy_code text,
  policy_no text,
  policy_type text,
  policy_product text,
  business_line text,
  business_type text,
  start_date date,
  end_date date,
  issuance_date date,
  premium_amount numeric,
  policy_status text,
  lifecycle_status text,
  customer_id uuid,
  customer_name text,
  vehicle_id uuid,
  vehicle_no text,
  insurer_name text,
  intermediary_type text,
  intermediary_code text,
  rm_name text,
  intermediary_group_code text,
  intermediary_group_name text,
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
  v_lifecycle text := lower(coalesce(nullif(btrim(p_lifecycle),''),'all'));
begin
  if v_lifecycle not in ('all','in_force','expiring','expired','upcoming') then
    raise exception 'Invalid policy lifecycle filter';
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
      p.policy_type,
      p.policy_product,
      p.business_line,
      p.business_type,
      p.start_date,
      p.end_date,
      p.issuance_date,
      coalesce(prem.gross_premium,p.premium_amount,0) as premium_amount,
      p.status as policy_status,
      p.customer_id,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name,
      p.vehicle_id,
      v.vehicle_no,
      ic.name as insurer_name,
      p.intermediary_type,
      p.intermediary_code,
      p.rm_name,
      p.intermediary_group_code,
      p.intermediary_group_name,
      p.created_at,
      i.id as intermediary_id,
      case
        when p.end_date is not null and p.end_date<current_date then 'expired'
        when p.start_date is not null and p.start_date>current_date then 'upcoming'
        when p.end_date between current_date and current_date+30 then 'expiring'
        else 'in_force'
      end as lifecycle_status
    from public.policies p
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    left join public.customers c on c.id=p.customer_id
    left join public.vehicles v on v.id=p.vehicle_id
    left join public.insurance_companies ic on ic.id=p.insurance_company_id
    left join lateral (
      select ppd.gross_premium
      from public.policy_premium_details ppd
      where ppd.policy_id=p.id
      order by ppd.updated_at desc,ppd.created_at desc
      limit 1
    ) prem on true
    where case
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
      (v_lifecycle='all' or b.lifecycle_status=v_lifecycle)
      and (
        v_search is null
        or b.policy_no ilike '%'||v_search||'%'
        or b.policy_code ilike '%'||v_search||'%'
        or b.customer_name ilike '%'||v_search||'%'
        or b.vehicle_no ilike '%'||v_search||'%'
        or b.insurer_name ilike '%'||v_search||'%'
        or b.intermediary_code ilike '%'||v_search||'%'
      )
  )
  select
    f.policy_id,
    f.policy_code,
    f.policy_no,
    f.policy_type,
    f.policy_product,
    f.business_line,
    f.business_type,
    f.start_date,
    f.end_date,
    f.issuance_date,
    f.premium_amount,
    f.policy_status,
    f.lifecycle_status,
    f.customer_id,
    f.customer_name,
    f.vehicle_id,
    f.vehicle_no,
    f.insurer_name,
    f.intermediary_type,
    f.intermediary_code,
    f.rm_name,
    f.intermediary_group_code,
    f.intermediary_group_name,
    count(*) over() as total_count
  from filtered f
  order by coalesce(f.issuance_date,f.start_date,f.created_at::date) desc,f.created_at desc
  limit v_limit offset v_offset;
end;
$$;

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
      coalesce(prem.gross_premium,p.premium_amount,0) as effective_premium
    from public.policies p
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    left join lateral (
      select ppd.gross_premium
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

create or replace function public.partner_app_customer_detail(p_customer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_result jsonb;
begin
  if not public.partner_app_customer_in_scope(p_customer_id) then
    raise exception 'Customer is not available in this Partner scope' using errcode='42501';
  end if;

  with base as (
    select
      c.id,
      c.customer_code,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name,
      c.company_name,
      c.contact_name,
      c.phone,
      c.email,
      c.city,
      c.state,
      c.customer_type,
      c.fleet_size_band,
      c.status,
      c.created_at,
      i.intermediary_type,
      i.intermediary_code
    from public.customers c
    left join public.intermediaries i on i.id=c.lead_source_intermediary_id
    where c.id=p_customer_id
  ),
  policy_rows as (
    select
      p.id,
      p.policy_no,
      p.policy_code,
      p.policy_type,
      p.policy_product,
      p.end_date,
      coalesce(prem.gross_premium,p.premium_amount,0) as premium_amount,
      ic.name as insurer_name,
      v.vehicle_no
    from public.policies p
    left join public.insurance_companies ic on ic.id=p.insurance_company_id
    left join public.vehicles v on v.id=p.vehicle_id
    left join lateral (
      select ppd.gross_premium
      from public.policy_premium_details ppd
      where ppd.policy_id=p.id
      order by ppd.updated_at desc,ppd.created_at desc
      limit 1
    ) prem on true
    where p.customer_id=p_customer_id
      and public.partner_app_policy_in_scope(p.id)
    order by coalesce(p.end_date,current_date) desc
    limit 25
  ),
  vehicle_rows as (
    select
      v.id,
      v.vehicle_no,
      v.vehicle_type,
      v.make,
      v.model,
      v.year,
      v.fitness_expiry_date,
      v.puc_expiry_date,
      v.road_tax_expiry_date,
      v.national_permit_expiry_date,
      v.local_permit_expiry_date
    from public.vehicles v
    where v.customer_id=p_customer_id
    order by v.vehicle_no
    limit 25
  ),
  claim_rows as (
    select
      cl.id,
      cl.claim_no,
      cl.current_status::text as current_status,
      cl.created_at,
      v.vehicle_no,
      ic.name as insurer_name
    from public.claims cl
    left join public.vehicles v on v.id=cl.vehicle_id
    left join public.insurance_companies ic on ic.id=cl.insurance_company_id
    where cl.customer_id=p_customer_id
      and public.partner_app_claim_in_scope(cl.id)
    order by cl.created_at desc
    limit 25
  ),
  counts as (
    select
      (
        select count(*)::int
        from public.policies p
        where p.customer_id=p_customer_id
          and public.partner_app_policy_in_scope(p.id)
      ) as policies,
      (
        select count(*)::int
        from public.vehicles v
        where v.customer_id=p_customer_id
      ) as vehicles,
      (
        select count(*)::int
        from public.claims cl
        where cl.customer_id=p_customer_id
          and public.partner_app_claim_in_scope(cl.id)
      ) as claims,
      (
        select count(*)::int
        from public.policies p
        where p.customer_id=p_customer_id
          and p.end_date between current_date and current_date+30
          and public.partner_app_policy_in_scope(p.id)
      ) as renewals_30_days
  )
  select jsonb_build_object(
    'customer',jsonb_build_object(
      'id',b.id,
      'customer_code',b.customer_code,
      'customer_name',b.customer_name,
      'company_name',b.company_name,
      'contact_name',b.contact_name,
      'phone',b.phone,
      'email',b.email,
      'city',b.city,
      'state',b.state,
      'customer_type',b.customer_type,
      'fleet_size_band',b.fleet_size_band,
      'status',b.status,
      'created_at',b.created_at,
      'intermediary_type',b.intermediary_type,
      'intermediary_code',b.intermediary_code
    ),
    'summary',jsonb_build_object(
      'policies',cnt.policies,
      'vehicles',cnt.vehicles,
      'claims',cnt.claims,
      'renewals_30_days',cnt.renewals_30_days
    ),
    'policies',coalesce((
      select jsonb_agg(jsonb_build_object(
        'policy_id',id,
        'policy_no',policy_no,
        'policy_code',policy_code,
        'policy_type',policy_type,
        'policy_product',policy_product,
        'end_date',end_date,
        'premium_amount',premium_amount,
        'insurer_name',insurer_name,
        'vehicle_no',vehicle_no
      ) order by end_date desc nulls last)
      from policy_rows
    ),'[]'::jsonb),
    'vehicles',coalesce((
      select jsonb_agg(jsonb_build_object(
        'vehicle_id',id,
        'vehicle_no',vehicle_no,
        'vehicle_type',vehicle_type,
        'make',make,
        'model',model,
        'year',year,
        'fitness_expiry_date',fitness_expiry_date,
        'puc_expiry_date',puc_expiry_date,
        'road_tax_expiry_date',road_tax_expiry_date,
        'national_permit_expiry_date',national_permit_expiry_date,
        'local_permit_expiry_date',local_permit_expiry_date
      ) order by vehicle_no)
      from vehicle_rows
    ),'[]'::jsonb),
    'claims',coalesce((
      select jsonb_agg(jsonb_build_object(
        'claim_id',id,
        'claim_no',claim_no,
        'current_status',current_status,
        'created_at',created_at,
        'vehicle_no',vehicle_no,
        'insurer_name',insurer_name
      ) order by created_at desc)
      from claim_rows
    ),'[]'::jsonb)
  )
  into v_result
  from base b
  cross join counts cnt;

  return v_result;
end;
$$;

create or replace function public.partner_app_policy_detail(p_policy_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_result jsonb;
begin
  if not public.partner_app_policy_in_scope(p_policy_id) then
    raise exception 'Policy is not available in this Partner scope' using errcode='42501';
  end if;

  select jsonb_build_object(
    'policy',jsonb_build_object(
      'id',p.id,
      'policy_code',p.policy_code,
      'policy_no',p.policy_no,
      'policy_type',p.policy_type,
      'policy_product',p.policy_product,
      'business_line',p.business_line,
      'business_type',p.business_type,
      'start_date',p.start_date,
      'end_date',p.end_date,
      'issuance_date',p.issuance_date,
      'status',p.status,
      'insured_declared_value',p.insured_declared_value,
      'lifecycle_status',case
        when p.end_date is not null and p.end_date<current_date then 'expired'
        when p.start_date is not null and p.start_date>current_date then 'upcoming'
        when p.end_date between current_date and current_date+30 then 'expiring'
        else 'in_force'
      end
    ),
    'premium',jsonb_build_object(
      'gross_premium',coalesce(ppd.gross_premium,p.premium_amount,0),
      'net_premium',ppd.net_premium,
      'od_premium',ppd.od_premium,
      'tp_premium',ppd.tp_premium,
      'cpa_opted',ppd.cpa_opted,
      'cpa_amount',ppd.cpa_amount,
      'gst_amount',ppd.gst_amount
    ),
    'customer',jsonb_build_object(
      'id',c.id,
      'name',coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer'),
      'customer_code',c.customer_code
    ),
    'vehicle',case
      when v.id is null then null
      else jsonb_build_object(
        'id',v.id,
        'vehicle_no',v.vehicle_no,
        'vehicle_type',v.vehicle_type,
        'make',v.make,
        'model',v.model,
        'year',v.year,
        'vehicle_category',v.vehicle_category,
        'is_commercial',v.is_commercial
      )
    end,
    'insurer',jsonb_build_object(
      'id',ic.id,
      'name',ic.name
    ),
    'commercial',jsonb_build_object(
      'intermediary_type',p.intermediary_type,
      'intermediary_code',p.intermediary_code,
      'rm_name',p.rm_name,
      'group_code',p.intermediary_group_code,
      'group_name',p.intermediary_group_name
    )
  )
  into v_result
  from public.policies p
  left join public.customers c on c.id=p.customer_id
  left join public.vehicles v on v.id=p.vehicle_id
  left join public.insurance_companies ic on ic.id=p.insurance_company_id
  left join lateral (
    select x.*
    from public.policy_premium_details x
    where x.policy_id=p.id
    order by x.updated_at desc,x.created_at desc
    limit 1
  ) ppd on true
  where p.id=p_policy_id;

  return v_result;
end;
$$;

create or replace function public.partner_app_claim_detail(p_claim_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_result jsonb;
begin
  if not public.partner_app_claim_in_scope(p_claim_id) then
    raise exception 'Claim is not available in this Partner scope' using errcode='42501';
  end if;

  with base as (
    select
      cl.*,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as customer_name,
      c.customer_code,
      v.vehicle_no,
      ep.policy_no,
      ic.name as insurer_name
    from public.claims cl
    join public.customers c on c.id=cl.customer_id
    left join public.vehicles v on v.id=cl.vehicle_id
    left join public.external_policies ep on ep.id=cl.external_policy_id
    left join public.insurance_companies ic on ic.id=cl.insurance_company_id
    where cl.id=p_claim_id
  ),
  history as (
    select
      h.id,
      h.from_status::text as from_status,
      h.to_status::text as to_status,
      h.created_at
    from public.claim_status_history h
    where h.claim_id=p_claim_id
    order by h.created_at
  ),
  stages as (
    select
      s.id,
      s.stage::text as stage,
      s.created_at
    from public.claim_stage_details s
    where s.claim_id=p_claim_id
    order by s.created_at
  )
  select jsonb_build_object(
    'claim',jsonb_build_object(
      'id',b.id,
      'claim_no',b.claim_no,
      'insurer_claim_no',b.insurer_claim_no,
      'current_status',b.current_status::text,
      'claim_service_mode',b.claim_service_mode::text,
      'assistance_status',b.assistance_status::text,
      'accident_at',b.accident_at,
      'accident_location',b.accident_location,
      'estimated_loss',b.estimated_loss,
      'approved_amount',b.approved_amount,
      'settlement_amount',b.settlement_amount,
      'created_at',b.created_at,
      'updated_at',b.updated_at
    ),
    'customer',jsonb_build_object(
      'id',b.customer_id,
      'name',b.customer_name,
      'customer_code',b.customer_code
    ),
    'vehicle',jsonb_build_object(
      'id',b.vehicle_id,
      'vehicle_no',b.vehicle_no
    ),
    'policy',jsonb_build_object(
      'policy_no',b.policy_no
    ),
    'insurer',jsonb_build_object(
      'name',b.insurer_name
    ),
    'status_history',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',id,
        'from_status',from_status,
        'to_status',to_status,
        'created_at',created_at
      ) order by created_at)
      from history
    ),'[]'::jsonb),
    'stages',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',id,
        'stage',stage,
        'created_at',created_at
      ) order by created_at)
      from stages
    ),'[]'::jsonb)
  )
  into v_result
  from base b;

  return v_result;
end;
$$;

revoke all on function public.partner_app_customer_in_scope(uuid) from public, anon, authenticated;
revoke all on function public.partner_app_policy_in_scope(uuid) from public, anon, authenticated;
revoke all on function public.partner_app_claim_in_scope(uuid) from public, anon, authenticated;

revoke all on function public.partner_app_policy_summary() from public, anon;
revoke all on function public.partner_app_list_policies(integer,integer,text,text) from public, anon;
revoke all on function public.partner_app_renewal_summary() from public, anon;
revoke all on function public.partner_app_customer_detail(uuid) from public, anon;
revoke all on function public.partner_app_policy_detail(uuid) from public, anon;
revoke all on function public.partner_app_claim_detail(uuid) from public, anon;

grant execute on function public.partner_app_policy_summary() to authenticated, service_role;
grant execute on function public.partner_app_list_policies(integer,integer,text,text) to authenticated, service_role;
grant execute on function public.partner_app_renewal_summary() to authenticated, service_role;
grant execute on function public.partner_app_customer_detail(uuid) to authenticated, service_role;
grant execute on function public.partner_app_policy_detail(uuid) to authenticated, service_role;
grant execute on function public.partner_app_claim_detail(uuid) to authenticated, service_role;

grant execute on function public.partner_app_customer_in_scope(uuid) to service_role;
grant execute on function public.partner_app_policy_in_scope(uuid) to service_role;
grant execute on function public.partner_app_claim_in_scope(uuid) to service_role;

commit;
