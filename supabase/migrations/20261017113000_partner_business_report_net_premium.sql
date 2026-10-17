begin;
-- Keep current scoping, dates, counts and RPC signature unchanged.
-- All report rollups (MTD, trend and product mix) now sum effective NET premium.
CREATE OR REPLACE FUNCTION public.partner_app_business_performance()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
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
      coalesce(ppd.net_premium,p.premium_amount,0) as effective_premium,
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
$function$
;
commit;
