begin;

create or replace function public.partner_app_impact()
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
  v_next_month date := (date_trunc('month',current_date)+interval '1 month')::date;
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
      and (v_joined_at is null or coalesce(p.issuance_date,p.created_at::date)>=v_joined_at::date)
  ),
  scoped_customers as (
    select c.*
    from public.customers c
    where case
      when v_scope_mode='none' then false
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      else c.lead_source_intermediary_id=any(v_intermediary_ids)
    end
      and (v_joined_at is null or c.created_at::date>=v_joined_at::date)
  ),
  scoped_claims as (
    select cl.*
    from public.claims cl
    join public.customers c on c.id=cl.customer_id
    where case
      when v_scope_mode='none' then false
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      else c.lead_source_intermediary_id=any(v_intermediary_ids)
    end
  ),
  policy_stats as (
    select
      count(*)::int as lifetime_policies,
      count(*) filter(
        where coalesce(issuance_date,created_at::date)>=v_month_start
          and coalesce(issuance_date,created_at::date)<v_next_month
      )::int as policies_this_month,
      coalesce(sum(effective_premium),0) as lifetime_gross_premium,
      coalesce(sum(effective_premium) filter(
        where coalesce(issuance_date,created_at::date)>=v_month_start
          and coalesce(issuance_date,created_at::date)<v_next_month
      ),0) as gross_premium_this_month,
      count(distinct vehicle_id) filter(
        where vehicle_id is not null
          and coalesce(start_date,current_date)<=current_date
          and (end_date is null or end_date>=current_date)
      )::int as active_vehicles,
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
      count(*)::int as customers_served,
      count(*) filter(where created_at::date>=v_month_start and created_at::date<v_next_month)::int as customers_this_month
    from scoped_customers
  ),
  claim_stats as (
    select
      count(*)::int as claims_assisted,
      count(*) filter(where lower(coalesce(current_status::text,''))='claim complete')::int as claims_completed,
      coalesce(sum(settlement_amount) filter(where settlement_amount is not null),0) as settlement_value
    from scoped_claims
  )
  select jsonb_build_object(
    'generated_at',now(),
    'month',to_char(current_date,'YYYY-MM'),
    'lifetime_policies',ps.lifetime_policies,
    'policies_this_month',ps.policies_this_month,
    'lifetime_gross_premium',ps.lifetime_gross_premium,
    'gross_premium_this_month',ps.gross_premium_this_month,
    'active_vehicles',ps.active_vehicles,
    'active_motor_idv',ps.active_motor_idv,
    'customers_served',cs.customers_served,
    'customers_this_month',cs.customers_this_month,
    'claims_assisted',cls.claims_assisted,
    'claims_completed',cls.claims_completed,
    'claim_settlement_value',cls.settlement_value
  )
  into v_result
  from policy_stats ps
  cross join customer_stats cs
  cross join claim_stats cls;

  return v_result;
end;
$$;

create or replace function public.partner_app_journey()
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
  v_joined_at timestamptz;
  v_result jsonb;
begin
  v_identity := public.partner_app_current_identity();
  v_scope := public.partner_app_commercial_scope();
  if v_identity is null or v_scope is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');
  v_profile_id := nullif(v_identity->>'profile_id','')::uuid;
  v_portal_account_id := nullif(v_identity->>'portal_account_id','')::uuid;

  if v_actor_kind='employee' then
    select e.created_at
    into v_joined_at
    from public.profiles p
    join public.employees e on e.id=p.employee_id
    where p.id=v_profile_id;
  elsif v_actor_kind='intermediary' then
    select coalesce(i.activated_at,i.created_at)
    into v_joined_at
    from public.intermediary_portal_accounts pa
    join public.intermediaries i on i.id=pa.intermediary_id
    where pa.id=v_portal_account_id;
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

  with scoped_policies as (
    select
      p.*,
      coalesce(ppd.gross_premium,p.premium_amount,0) as effective_premium,
      i.id as scoped_intermediary_id,
      coalesce(p.issuance_date,p.created_at::date) as event_date
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
  scoped_claims as (
    select cl.*
    from public.claims cl
    join public.customers c on c.id=cl.customer_id
    where case
      when v_scope_mode='none' then false
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      else c.lead_source_intermediary_id=any(v_intermediary_ids)
    end
      and (v_joined_at is null or cl.created_at::date>=v_joined_at::date)
  ),
  policy_ranked as (
    select event_date,row_number() over(order by event_date,id) as rn
    from scoped_policies
  ),
  customer_ranked as (
    select created_at::date as event_date,row_number() over(order by created_at,id) as rn
    from scoped_customers
  ),
  monthly_premium as (
    select date_trunc('month',event_date)::date as month_start,sum(effective_premium) as premium
    from scoped_policies
    group by 1
  ),
  stats as (
    select
      (select count(*)::int from scoped_policies) as policy_count,
      (select count(*)::int from scoped_customers) as customer_count,
      (select count(*)::int from scoped_claims) as claim_count,
      (select min(event_date) from scoped_policies) as first_policy_date,
      (select min(created_at::date) from scoped_customers) as first_customer_date,
      (select min(created_at::date) from scoped_claims) as first_claim_date,
      (select event_date from policy_ranked where rn=25) as policy_25_date,
      (select event_date from policy_ranked where rn=50) as policy_50_date,
      (select event_date from policy_ranked where rn=100) as policy_100_date,
      (select event_date from customer_ranked where rn=25) as customer_25_date,
      (select event_date from customer_ranked where rn=50) as customer_50_date,
      (select event_date from customer_ranked where rn=100) as customer_100_date,
      (select min(month_start) from monthly_premium where premium>=500000) as premium_5l_month,
      (select min(month_start) from monthly_premium where premium>=1000000) as premium_10l_month
  ),
  milestone_rows as (
    select v_joined_at::date as event_date,'tracking_started'::text as kind,'Journey tracking started'::text as title,'Your INSUREIT digital journey is recorded from this date.'::text as subtitle,10 as sort_rank
    where v_joined_at is not null
    union all
    select first_customer_date,'first_customer','First customer in your journey','The first customer recorded after journey tracking began.',20 from stats where first_customer_date is not null
    union all
    select first_policy_date,'first_policy','First policy in your journey','The first attributable policy recorded after journey tracking began.',30 from stats where first_policy_date is not null
    union all
    select policy_25_date,'policies_25','25 policies','25 attributable policies completed.',40 from stats where policy_25_date is not null
    union all
    select customer_25_date,'customers_25','25 customers','25 customers reached in your authorized book.',45 from stats where customer_25_date is not null
    union all
    select premium_5l_month,'premium_5l','₹5L month','First month crossing ₹5L gross premium.',50 from stats where premium_5l_month is not null
    union all
    select policy_50_date,'policies_50','50 policies','50 attributable policies completed.',60 from stats where policy_50_date is not null
    union all
    select customer_50_date,'customers_50','50 customers','50 customers reached in your authorized book.',65 from stats where customer_50_date is not null
    union all
    select first_claim_date,'first_claim','First claim assisted','The first attributable claim recorded after journey tracking began.',70 from stats where first_claim_date is not null
    union all
    select premium_10l_month,'premium_10l','₹10L month','First month crossing ₹10L gross premium.',80 from stats where premium_10l_month is not null
    union all
    select policy_100_date,'policies_100','100 policies','100 attributable policies completed.',90 from stats where policy_100_date is not null
    union all
    select customer_100_date,'customers_100','100 customers','100 customers reached in your authorized book.',95 from stats where customer_100_date is not null
  ),
  milestones as (
    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'date',event_date,
          'kind',kind,
          'title',title,
          'subtitle',subtitle
        )
        order by event_date,sort_rank
      ),
      '[]'::jsonb
    ) as items
    from milestone_rows
  ),
  next_customer as (
    select
      customer_count,
      case
        when customer_count<10 then 10
        when customer_count<25 then 25
        when customer_count<50 then 50
        when customer_count<100 then 100
        when customer_count<250 then 250
        when customer_count<500 then 500
        else ((customer_count/500)+1)*500
      end as target
    from stats
  )
  select jsonb_build_object(
    'generated_at',now(),
    'policy_count',s.policy_count,
    'customer_count',s.customer_count,
    'claim_count',s.claim_count,
    'milestones',m.items,
    'next_milestone',jsonb_build_object(
      'kind','customers',
      'current',nc.customer_count,
      'target',nc.target,
      'remaining',greatest(nc.target-nc.customer_count,0),
      'title',nc.target || ' customers'
    )
  )
  into v_result
  from stats s
  cross join milestones m
  cross join next_customer nc;

  return v_result;
end;
$$;

revoke all on function public.partner_app_impact() from public, anon;
revoke all on function public.partner_app_journey() from public, anon;
grant execute on function public.partner_app_impact() to authenticated, service_role;
grant execute on function public.partner_app_journey() to authenticated, service_role;

commit;
