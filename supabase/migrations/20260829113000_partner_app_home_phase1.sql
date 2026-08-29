begin;

create or replace function public.partner_app_home()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_identity jsonb;
  v_actor_kind text;
  v_scope_mode text;
  v_employee_ids uuid[] := array[]::uuid[];
  v_intermediary_ids uuid[] := array[]::uuid[];
  v_group_ids uuid[] := array[]::uuid[];
  v_profile_id uuid;
  v_portal_account_id uuid;
  v_month_start date := date_trunc('month', current_date)::date;
  v_prev_month_start date := (date_trunc('month', current_date) - interval '1 month')::date;
  v_next_month_start date := (date_trunc('month', current_date) + interval '1 month')::date;
  v_result jsonb;
begin
  v_identity := public.partner_app_current_identity();
  v_scope := public.partner_app_commercial_scope();

  if v_identity is null or v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope ->> 'actor_kind';
  v_scope_mode := coalesce(v_scope ->> 'scope_mode','none');
  v_profile_id := nullif(v_identity ->> 'profile_id','')::uuid;
  v_portal_account_id := nullif(v_identity ->> 'portal_account_id','')::uuid;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'employee_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'intermediary_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid), array[]::uuid[])
  into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope -> 'group_ids','[]'::jsonb)) value;

  with scoped_policies as (
    select p.*, coalesce(ppd.gross_premium,p.premium_amount,0) as effective_premium, i.id as scoped_intermediary_id
    from public.policies p
    left join public.policy_premium_details ppd on ppd.policy_id=p.id
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    where
      case
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
    where
      case
        when v_scope_mode='none' then false
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        else c.lead_source_intermediary_id=any(v_intermediary_ids)
      end
  ),
  scoped_claims as (
    select cl.*
    from public.claims cl
    join public.customers c on c.id=cl.customer_id
    where
      case
        when v_scope_mode='none' then false
        when v_actor_kind='employee' and v_scope_mode='organization' then true
        else c.lead_source_intermediary_id=any(v_intermediary_ids)
      end
  ),
  scoped_intakes as (
    select pir.*
    from public.policy_intake_requests pir
    where
      case
        when v_actor_kind='intermediary' then pir.submitted_by_portal_account_id=v_portal_account_id
        when v_actor_kind='employee' then pir.submitted_by_profile_id=v_profile_id
        else false
      end
  ),
  policy_stats as (
    select
      count(*) filter(where coalesce(start_date,current_date)<=current_date and (end_date is null or end_date>=current_date))::int as active_policies,
      count(*) filter(where coalesce(issuance_date,created_at::date)>=v_month_start and coalesce(issuance_date,created_at::date)<v_next_month_start)::int as policies_this_month,
      coalesce(sum(effective_premium) filter(where coalesce(issuance_date,created_at::date)>=v_month_start and coalesce(issuance_date,created_at::date)<v_next_month_start),0) as premium_this_month,
      coalesce(sum(effective_premium) filter(where coalesce(issuance_date,created_at::date)>=v_prev_month_start and coalesce(issuance_date,created_at::date)<v_month_start),0) as premium_last_month,
      count(*) filter(where end_date between current_date and current_date+7)::int as renewals_7_days,
      count(*) filter(where end_date between current_date and current_date+30)::int as renewals_30_days,
      count(*) filter(where end_date<current_date)::int as overdue_policies,
      coalesce(sum(effective_premium) filter(where end_date between current_date and current_date+7),0) as renewal_premium_7_days,
      coalesce(sum(effective_premium) filter(where end_date between current_date and current_date+30),0) as renewal_premium_30_days,
      count(distinct vehicle_id) filter(where vehicle_id is not null and coalesce(start_date,current_date)<=current_date and (end_date is null or end_date>=current_date))::int as active_vehicles,
      count(distinct customer_id) filter(where customer_id is not null)::int as policy_customers,
      coalesce(sum(insured_declared_value) filter(
        where insured_declared_value is not null
          and coalesce(start_date,current_date)<=current_date
          and (end_date is null or end_date>=current_date)
          and (lower(coalesce(policy_type,''))='motor' or lower(coalesce(business_line,''))='motor')
      ),0) as active_motor_idv
    from scoped_policies
  ),
  customer_stats as (
    select
      count(*)::int as total_customers,
      count(*) filter(where created_at::date>=v_month_start and created_at::date<v_next_month_start)::int as customers_this_month
    from scoped_customers
  ),
  claim_stats as (
    select
      count(*)::int as total_claims,
      count(*) filter(where lower(coalesce(current_status::text,''))<>'claim complete')::int as active_claims,
      count(*) filter(
        where assistance_status is not null
          and lower(assistance_status::text) not in ('none','not_requested','resolved','closed')
      )::int as claims_need_attention,
      count(*) filter(where updated_at::date=current_date)::int as claims_updated_today,
      coalesce(sum(settlement_amount) filter(where settlement_amount is not null),0) as claim_settlement_value
    from scoped_claims
  ),
  intake_stats as (
    select
      count(*)::int as total_intakes,
      count(*) filter(where status='needs_attention')::int as intakes_need_attention,
      count(*) filter(where status in ('processing','ready_for_review','in_review'))::int as intakes_in_progress
    from scoped_intakes
  ),
  combined as (
    select
      ps.*,
      cs.total_customers,
      cs.customers_this_month,
      cls.total_claims,
      cls.active_claims,
      cls.claims_need_attention,
      cls.claims_updated_today,
      cls.claim_settlement_value,
      ins.total_intakes,
      ins.intakes_need_attention,
      ins.intakes_in_progress,
      case
        when ps.premium_last_month > 0 then round(((ps.premium_this_month-ps.premium_last_month)/ps.premium_last_month*100)::numeric,1)
        when ps.premium_this_month > 0 then 100::numeric
        else 0::numeric
      end as premium_change_percent
    from policy_stats ps
    cross join customer_stats cs
    cross join claim_stats cls
    cross join intake_stats ins
  ),
  today_items as (
    select coalesce(jsonb_agg(item order by priority, sort_key), '[]'::jsonb) as items
    from (
      select
        1 as priority,
        1 as sort_key,
        jsonb_build_object(
          'kind','intake_attention',
          'title', intakes_need_attention || case when intakes_need_attention=1 then ' Policy Intake needs your response' else ' Policy Intakes need your response' end,
          'subtitle','Operations is waiting for a replacement or clarification.',
          'count',intakes_need_attention,
          'route','/policy-intakes'
        ) as item
      from combined where intakes_need_attention>0
      union all
      select
        2,1,
        jsonb_build_object(
          'kind','renewal',
          'title', renewals_7_days || case when renewals_7_days=1 then ' renewal is due in 7 days' else ' renewals are due in 7 days' end,
          'subtitle','₹' || trim(to_char(renewal_premium_7_days,'FM999999999990')) || ' premium is approaching renewal.',
          'count',renewals_7_days,
          'route','/renewals'
        )
      from combined where renewals_7_days>0
      union all
      select
        3,1,
        jsonb_build_object(
          'kind','claim',
          'title', active_claims || case when active_claims=1 then ' active claim' else ' active claims' end,
          'subtitle',case when claims_updated_today>0 then claims_updated_today || ' changed today.' else 'Keep an eye on service progress.' end,
          'count',active_claims,
          'route','/(tabs)/claims'
        )
      from combined where active_claims>0
      union all
      select
        4,1,
        jsonb_build_object(
          'kind','renewal',
          'title', renewals_30_days || case when renewals_30_days=1 then ' renewal is due this month' else ' renewals are due in 30 days' end,
          'subtitle','₹' || trim(to_char(renewal_premium_30_days,'FM999999999990')) || ' premium is in the renewal window.',
          'count',renewals_30_days,
          'route','/renewals'
        )
      from combined where renewals_7_days=0 and renewals_30_days>0
    ) ranked
    limit 3
  )
  select jsonb_build_object(
    'generated_at', now(),
    'business', jsonb_build_object(
      'premium_this_month', premium_this_month,
      'premium_last_month', premium_last_month,
      'premium_change_percent', premium_change_percent,
      'policies_this_month', policies_this_month,
      'active_policies', active_policies,
      'total_customers', total_customers,
      'customers_this_month', customers_this_month,
      'renewals_7_days', renewals_7_days,
      'renewals_30_days', renewals_30_days,
      'overdue_policies', overdue_policies,
      'renewal_premium_7_days', renewal_premium_7_days,
      'renewal_premium_30_days', renewal_premium_30_days
    ),
    'service', jsonb_build_object(
      'active_claims', active_claims,
      'claims_need_attention', claims_need_attention,
      'claims_updated_today', claims_updated_today,
      'intakes_need_attention', intakes_need_attention,
      'intakes_in_progress', intakes_in_progress
    ),
    'impact', jsonb_build_object(
      'active_vehicles', active_vehicles,
      'customers_served', greatest(total_customers,policy_customers),
      'claims_assisted', total_claims,
      'claim_settlement_value', claim_settlement_value,
      'active_motor_idv', active_motor_idv
    ),
    'pulse', jsonb_build_object(
      'business_momentum',
        case when premium_change_percent>5 then 'rising'
             when premium_change_percent<-5 then 'slower'
             else 'steady' end,
      'renewal_readiness',
        case when renewals_7_days=0 then 'clear' else 'attention' end,
      'service_status',
        case when claims_need_attention>0 then 'attention' else 'steady' end,
      'action_status',
        case when intakes_need_attention>0 then 'attention' else 'clear' end
    ),
    'today', (select items from today_items)
  )
  into v_result
  from combined;

  return v_result;
end;
$$;

revoke all on function public.partner_app_home() from public, anon;
grant execute on function public.partner_app_home() to authenticated, service_role;

commit;
