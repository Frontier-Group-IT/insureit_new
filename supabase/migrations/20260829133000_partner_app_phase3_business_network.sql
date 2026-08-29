begin;

create or replace function public.partner_app_business_performance()
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
  v_month_start date := date_trunc('month',current_date)::date;
  v_prev_month_start date := (date_trunc('month',current_date)-interval '1 month')::date;
  v_next_month_start date := (date_trunc('month',current_date)+interval '1 month')::date;
  v_trend_start date := (date_trunc('month',current_date)-interval '5 months')::date;
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
      coalesce(ppd.gross_premium,p.premium_amount,0) as effective_premium,
      coalesce(p.issuance_date,p.created_at::date) as event_date,
      i.id as scoped_intermediary_id
    from public.policies p
    left join public.policy_premium_details ppd on ppd.policy_id=p.id
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
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
  scoped_customers as (
    select c.*
    from public.customers c
    where case
      when v_scope_mode='none' then false
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      else c.lead_source_intermediary_id=any(v_intermediary_ids)
    end
  ),
  totals as (
    select
      count(*)::int as total_policies,
      coalesce(sum(effective_premium),0) as lifetime_gross_premium,
      count(*) filter(where event_date>=v_month_start and event_date<v_next_month_start)::int as policies_this_month,
      coalesce(sum(effective_premium) filter(where event_date>=v_month_start and event_date<v_next_month_start),0) as premium_this_month,
      count(*) filter(where event_date>=v_prev_month_start and event_date<v_month_start)::int as policies_last_month,
      coalesce(sum(effective_premium) filter(where event_date>=v_prev_month_start and event_date<v_month_start),0) as premium_last_month
    from scoped_policies
  ),
  customer_totals as (
    select count(*)::int as total_customers from scoped_customers
  ),
  trend_months as (
    select generate_series(v_trend_start::timestamp,v_month_start::timestamp,interval '1 month')::date as month_start
  ),
  trend as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'month',to_char(tm.month_start,'YYYY-MM'),
        'premium',coalesce(x.premium,0),
        'policies',coalesce(x.policies,0)
      )
      order by tm.month_start
    ),'[]'::jsonb) as items
    from trend_months tm
    left join (
      select date_trunc('month',event_date)::date as month_start,
             sum(effective_premium) as premium,
             count(*)::int as policies
      from scoped_policies
      where event_date>=v_trend_start
      group by 1
    ) x on x.month_start=tm.month_start
  ),
  mix_rows as (
    select
      coalesce(nullif(btrim(policy_type),''),nullif(btrim(business_line),''),'Other') as label,
      count(*)::int as policies,
      coalesce(sum(effective_premium),0) as premium
    from scoped_policies
    where event_date>=v_month_start and event_date<v_next_month_start
    group by 1
  ),
  mix as (
    select coalesce(jsonb_agg(
      jsonb_build_object('label',label,'policies',policies,'premium',premium)
      order by premium desc,label
    ),'[]'::jsonb) as items
    from mix_rows
  )
  select jsonb_build_object(
    'generated_at',now(),
    'scope_mode',v_scope_mode,
    'current_month',to_char(v_month_start,'YYYY-MM'),
    'premium_this_month',t.premium_this_month,
    'premium_last_month',t.premium_last_month,
    'policies_this_month',t.policies_this_month,
    'policies_last_month',t.policies_last_month,
    'total_policies',t.total_policies,
    'total_customers',ct.total_customers,
    'lifetime_gross_premium',t.lifetime_gross_premium,
    'premium_change_percent',
      case
        when t.premium_last_month>0 then round(((t.premium_this_month-t.premium_last_month)/t.premium_last_month*100)::numeric,1)
        when t.premium_this_month>0 then 100::numeric
        else 0::numeric
      end,
    'trend',(select items from trend),
    'business_mix',(select items from mix)
  )
  into v_result
  from totals t
  cross join customer_totals ct;

  return v_result;
end;
$$;

create or replace function public.partner_app_network()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_scope_mode text;
  v_partner_ids uuid[] := array[]::uuid[];
  v_month_start date := date_trunc('month',current_date)::date;
  v_next_month_start date := (date_trunc('month',current_date)+interval '1 month')::date;
  v_result jsonb;
begin
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_scope_mode := coalesce(v_scope->>'scope_mode','none');

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  with partner_base as (
    select
      p.id as partner_id,
      p.partner_code,
      p.display_name as partner_name,
      p.partner_kind,
      public.intermediary_group_partner_owner_employee(p.id) as owner_employee_id
    from public.partners p
    where p.id=any(v_partner_ids)
      and p.partner_status='active_partner'
  ),
  current_membership as (
    select
      m.partner_id,
      g.id as group_id,
      g.group_code,
      g.group_name
    from public.intermediary_group_memberships m
    join public.intermediary_groups g on g.id=m.group_id and g.status='active'
    where m.effective_to is null
      and m.partner_id=any(v_partner_ids)
  ),
  child_rows as (
    select
      op.partner_record_id as partner_id,
      i.id as intermediary_id,
      i.intermediary_type,
      i.intermediary_code,
      i.display_name
    from public.posp_misp_onboarding_profiles op
    join public.intermediaries i
      on i.onboarding_profile_id=op.id
     and i.intermediary_type in ('posp','misp')
    where op.partner_record_id=any(v_partner_ids)
      and i.account_status='active'
  ),
  child_json as (
    select
      partner_id,
      count(*)::int as child_count,
      count(*) filter(where intermediary_type='posp')::int as posp_count,
      count(*) filter(where intermediary_type='misp')::int as misp_count,
      jsonb_agg(
        jsonb_build_object(
          'intermediary_id',intermediary_id,
          'type',intermediary_type,
          'code',intermediary_code,
          'name',display_name
        )
        order by intermediary_type,display_name
      ) as children
    from child_rows
    group by partner_id
  ),
  policy_family as (
    select
      public.partner_app_resolve_partner_family(i.id) as partner_id,
      p.id as policy_id,
      coalesce(ppd.gross_premium,p.premium_amount,0) as effective_premium,
      coalesce(p.issuance_date,p.created_at::date) as event_date,
      p.end_date
    from public.policies p
    join public.intermediaries i on i.intermediary_code=p.intermediary_code
    left join public.policy_premium_details ppd on ppd.policy_id=p.id
    where public.partner_app_resolve_partner_family(i.id)=any(v_partner_ids)
  ),
  policy_metrics as (
    select
      partner_id,
      count(*)::int as total_policies,
      count(*) filter(where event_date>=v_month_start and event_date<v_next_month_start)::int as policies_this_month,
      coalesce(sum(effective_premium) filter(where event_date>=v_month_start and event_date<v_next_month_start),0) as premium_this_month,
      count(*) filter(where end_date between current_date and current_date+30)::int as renewals_30_days
    from policy_family
    group by partner_id
  ),
  customer_family as (
    select
      public.partner_app_resolve_partner_family(c.lead_source_intermediary_id) as partner_id,
      count(*)::int as total_customers
    from public.customers c
    where c.lead_source_intermediary_id is not null
      and public.partner_app_resolve_partner_family(c.lead_source_intermediary_id)=any(v_partner_ids)
    group by 1
  ),
  claim_family as (
    select
      public.partner_app_resolve_partner_family(c.lead_source_intermediary_id) as partner_id,
      count(*) filter(where lower(coalesce(cl.current_status::text,''))<>'claim complete')::int as active_claims
    from public.claims cl
    join public.customers c on c.id=cl.customer_id
    where c.lead_source_intermediary_id is not null
      and public.partner_app_resolve_partner_family(c.lead_source_intermediary_id)=any(v_partner_ids)
    group by 1
  ),
  partner_rows as (
    select
      pb.partner_id,
      pb.partner_code,
      pb.partner_name,
      pb.partner_kind,
      e.id as owner_employee_id,
      e.employee_code as owner_employee_code,
      e.full_name as owner_employee_name,
      e.designation as owner_designation,
      cm.group_id,
      cm.group_code,
      cm.group_name,
      coalesce(cj.child_count,0) as child_count,
      coalesce(cj.posp_count,0) as posp_count,
      coalesce(cj.misp_count,0) as misp_count,
      coalesce(cj.children,'[]'::jsonb) as children,
      coalesce(pm.total_policies,0) as total_policies,
      coalesce(pm.policies_this_month,0) as policies_this_month,
      coalesce(pm.premium_this_month,0) as premium_this_month,
      coalesce(pm.renewals_30_days,0) as renewals_30_days,
      coalesce(cf.total_customers,0) as total_customers,
      coalesce(clf.active_claims,0) as active_claims
    from partner_base pb
    left join public.employees e on e.id=pb.owner_employee_id
    left join current_membership cm on cm.partner_id=pb.partner_id
    left join child_json cj on cj.partner_id=pb.partner_id
    left join policy_metrics pm on pm.partner_id=pb.partner_id
    left join customer_family cf on cf.partner_id=pb.partner_id
    left join claim_family clf on clf.partner_id=pb.partner_id
  ),
  group_count as (
    select count(distinct group_id)::int as total_groups
    from partner_rows
    where group_id is not null
  ),
  rows_json as (
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'partner_id',partner_id,
        'partner_code',partner_code,
        'partner_name',partner_name,
        'partner_kind',partner_kind,
        'owner',jsonb_build_object(
          'employee_id',owner_employee_id,
          'employee_code',owner_employee_code,
          'name',owner_employee_name,
          'designation',owner_designation
        ),
        'group',
          case when group_id is null then null else jsonb_build_object(
            'group_id',group_id,
            'group_code',group_code,
            'group_name',group_name
          ) end,
        'children',children,
        'child_count',child_count,
        'posp_count',posp_count,
        'misp_count',misp_count,
        'metrics',jsonb_build_object(
          'premium_this_month',premium_this_month,
          'policies_this_month',policies_this_month,
          'total_policies',total_policies,
          'total_customers',total_customers,
          'renewals_30_days',renewals_30_days,
          'active_claims',active_claims
        )
      )
      order by owner_employee_name nulls last,group_name nulls last,partner_name
    ),'[]'::jsonb) as items
    from partner_rows
  )
  select jsonb_build_object(
    'generated_at',now(),
    'scope_mode',v_scope_mode,
    'total_partners',(select count(*) from partner_rows),
    'total_groups',(select total_groups from group_count),
    'partners',(select items from rows_json)
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.partner_app_business_performance() from public, anon;
revoke all on function public.partner_app_network() from public, anon;
grant execute on function public.partner_app_business_performance() to authenticated, service_role;
grant execute on function public.partner_app_network() to authenticated, service_role;

commit;
