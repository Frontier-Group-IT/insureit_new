begin;

create or replace function public.partner_app_weekly_story()
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
  v_week_start date := date_trunc('week', current_date)::date;
  v_next_week_start date := (date_trunc('week', current_date) + interval '7 days')::date;
  v_prev_week_start date := (date_trunc('week', current_date) - interval '7 days')::date;
  v_following_week_start date := (date_trunc('week', current_date) + interval '14 days')::date;
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
      coalesce(prem.gross_premium,p.premium_amount,0) as effective_premium,
      coalesce(p.issuance_date,p.created_at::date) as event_date
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
  ),
  policy_stats as (
    select
      count(*) filter(where event_date>=v_week_start and event_date<v_next_week_start)::int as policies_this_week,
      coalesce(sum(effective_premium) filter(where event_date>=v_week_start and event_date<v_next_week_start),0) as premium_this_week,
      count(*) filter(where event_date>=v_prev_week_start and event_date<v_week_start)::int as policies_last_week,
      coalesce(sum(effective_premium) filter(where event_date>=v_prev_week_start and event_date<v_week_start),0) as premium_last_week,
      count(*) filter(where end_date>=v_next_week_start and end_date<v_following_week_start)::int as renewals_next_week,
      coalesce(sum(effective_premium) filter(where end_date>=v_next_week_start and end_date<v_following_week_start),0) as renewal_premium_next_week
    from scoped_policies
  ),
  customer_stats as (
    select
      count(*) filter(where created_at::date>=v_week_start and created_at::date<v_next_week_start)::int as customers_this_week
    from scoped_customers
  ),
  claim_stats as (
    select
      count(*) filter(where updated_at::date>=v_week_start and updated_at::date<v_next_week_start)::int as claims_touched_this_week,
      count(*) filter(
        where lower(coalesce(current_status::text,''))='claim complete'
          and updated_at::date>=v_week_start
          and updated_at::date<v_next_week_start
      )::int as claims_completed_this_week
    from scoped_claims
  )
  select jsonb_build_object(
    'generated_at',now(),
    'week_start',v_week_start,
    'week_end',v_next_week_start-1,
    'policies_this_week',ps.policies_this_week,
    'premium_this_week',ps.premium_this_week,
    'policies_last_week',ps.policies_last_week,
    'premium_last_week',ps.premium_last_week,
    'premium_change_percent',
      case
        when ps.premium_last_week>0 then round(((ps.premium_this_week-ps.premium_last_week)/ps.premium_last_week*100)::numeric,1)
        when ps.premium_this_week>0 then 100::numeric
        else 0::numeric
      end,
    'customers_this_week',cs.customers_this_week,
    'claims_touched_this_week',cls.claims_touched_this_week,
    'claims_completed_this_week',cls.claims_completed_this_week,
    'renewals_next_week',ps.renewals_next_week,
    'renewal_premium_next_week',ps.renewal_premium_next_week
  )
  into v_result
  from policy_stats ps
  cross join customer_stats cs
  cross join claim_stats cls;

  return v_result;
end;
$$;

create or replace function public.partner_app_recognition()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_impact jsonb;
  v_journey jsonb;
  v_learning jsonb;
  v_renewals jsonb;
  v_items jsonb := '[]'::jsonb;
  v_policy_count integer;
  v_customer_count integer;
  v_claim_count integer;
  v_streak integer;
  v_overdue integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  if public.partner_app_current_identity() is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_impact := public.partner_app_impact();
  v_journey := public.partner_app_journey();
  v_learning := public.partner_app_learning_today();
  v_renewals := public.partner_app_renewal_summary();

  v_policy_count := coalesce((v_impact->>'lifetime_policies')::int,0);
  v_customer_count := coalesce((v_impact->>'customers_served')::int,0);
  v_claim_count := coalesce((v_impact->>'claims_assisted')::int,0);
  v_streak := coalesce((v_learning->'stats'->>'current_streak')::int,0);
  v_overdue := coalesce((v_renewals->>'overdue_count')::int,0);

  if v_policy_count >= 100 then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code','POLICY_100',
      'title','100+ Policy Book',
      'body',v_policy_count || ' policies are recorded in your authorized business book.',
      'icon','document',
      'tone','business',
      'value',v_policy_count
    ));
  elsif v_policy_count >= 25 then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code','POLICY_25',
      'title','Growing Policy Book',
      'body',v_policy_count || ' policies are recorded in your authorized business book.',
      'icon','document',
      'tone','business',
      'value',v_policy_count
    ));
  end if;

  if v_customer_count >= 100 then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code','CUSTOMER_100',
      'title','100+ Customer Relationships',
      'body',v_customer_count || ' customers are represented in your authorized business book.',
      'icon','people',
      'tone','impact',
      'value',v_customer_count
    ));
  elsif v_customer_count >= 25 then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code','CUSTOMER_25',
      'title','Customer Network Growing',
      'body',v_customer_count || ' customers are represented in your authorized business book.',
      'icon','people',
      'tone','impact',
      'value',v_customer_count
    ));
  end if;

  if v_claim_count >= 10 then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code','CLAIM_10',
      'title','Claim Service Experience',
      'body',v_claim_count || ' attributable claims have been recorded across your authorized customers.',
      'icon','shield',
      'tone','service',
      'value',v_claim_count
    ));
  end if;

  if v_streak >= 3 then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code','LEARN_STREAK',
      'title','Learning Rhythm',
      'body',v_streak || ' consecutive learning days recorded.',
      'icon','learn',
      'tone','learn',
      'value',v_streak
    ));
  end if;

  if v_overdue = 0 then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code','NO_OVERDUE',
      'title','No Overdue Policies',
      'body','No expired policy is currently present in your authorized renewal book.',
      'icon','renewal',
      'tone','clear',
      'value',0
    ));
  end if;

  return jsonb_build_object(
    'generated_at',now(),
    'items',v_items,
    'next_milestone',v_journey->'next_milestone'
  );
end;
$$;

create or replace function public.partner_app_activity(p_limit integer default 40)
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
  v_limit integer := greatest(1,least(coalesce(p_limit,40),100));
  v_home jsonb;
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

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  v_home := public.partner_app_home();

  with policy_events as (
    select
      'policy'::text as kind,
      p.id as entity_id,
      coalesce(p.issuance_date::timestamptz,p.created_at) as event_at,
      coalesce(p.policy_no,p.policy_code,'Policy') as title,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as subtitle,
      concat_ws(' · ',ic.name,v.vehicle_no) as meta,
      '/policy/'||p.id::text as route,
      'business'::text as tone
    from public.policies p
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    left join public.customers c on c.id=p.customer_id
    left join public.vehicles v on v.id=p.vehicle_id
    left join public.insurance_companies ic on ic.id=p.insurance_company_id
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
    order by coalesce(p.issuance_date::timestamptz,p.created_at) desc
    limit 40
  ),
  claim_events as (
    select
      'claim'::text as kind,
      cl.id as entity_id,
      coalesce(h.created_at,cl.updated_at,cl.created_at) as event_at,
      coalesce(cl.claim_no,'Claim') as title,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') as subtitle,
      coalesce(h.to_status::text,cl.current_status::text,'Claim updated') as meta,
      '/claim/'||cl.id::text as route,
      'service'::text as tone
    from public.claims cl
    join public.customers c on c.id=cl.customer_id
    left join lateral (
      select x.to_status,x.created_at
      from public.claim_status_history x
      where x.claim_id=cl.id
      order by x.created_at desc
      limit 1
    ) h on true
    where case
      when v_scope_mode='none' then false
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      else c.lead_source_intermediary_id=any(v_intermediary_ids)
    end
    order by coalesce(h.created_at,cl.updated_at,cl.created_at) desc
    limit 40
  ),
  intake_events as (
    select
      'intake'::text as kind,
      pir.id as entity_id,
      pir.updated_at as event_at,
      pir.intake_number as title,
      coalesce(nullif(pir.lead_source_name,''),'Policy Intake') as subtitle,
      case
        when pir.status='needs_attention' then 'Needs your attention'
        when pir.status='completed' then 'Policy created'
        when pir.status='in_review' then 'Operations review'
        when pir.status='ready_for_review' then 'Ready for review'
        else initcap(replace(pir.status,'_',' '))
      end as meta,
      '/policy-intakes/'||pir.id::text as route,
      case when pir.status='needs_attention' then 'attention' else 'operations' end as tone
    from public.policy_intake_requests pir
    where case
      when v_actor_kind='intermediary' then pir.submitted_by_portal_account_id=v_portal_account_id
      when v_actor_kind='employee' then pir.submitted_by_profile_id=v_profile_id
      else false
    end
    order by pir.updated_at desc
    limit 40
  ),
  learning_events as (
    select
      'learn'::text as kind,
      a.card_id as entity_id,
      a.created_at as event_at,
      c.category as title,
      '60-Second Learn'::text as subtitle,
      case when a.is_correct then 'Answered correctly' else 'Learning card completed' end as meta,
      '/learn'::text as route,
      'learn'::text as tone
    from public.partner_learning_attempts a
    join public.partner_learning_cards c on c.id=a.card_id
    where a.auth_user_id=auth.uid()
    order by a.created_at desc
    limit 20
  ),
  all_events as (
    select * from policy_events
    union all select * from claim_events
    union all select * from intake_events
    union all select * from learning_events
  ),
  ranked as (
    select *
    from all_events
    order by event_at desc
    limit v_limit
  )
  select jsonb_build_object(
    'generated_at',now(),
    'attention',coalesce(v_home->'today','[]'::jsonb),
    'items',coalesce(jsonb_agg(jsonb_build_object(
      'kind',kind,
      'entity_id',entity_id,
      'event_at',event_at,
      'title',title,
      'subtitle',subtitle,
      'meta',meta,
      'route',route,
      'tone',tone
    ) order by event_at desc),'[]'::jsonb)
  )
  into v_result
  from ranked;

  return v_result;
end;
$$;

create or replace function public.partner_app_stories()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_home jsonb;
  v_impact jsonb;
  v_journey jsonb;
  v_business jsonb;
  v_learning jsonb;
  v_weekly jsonb;
  v_items jsonb := '[]'::jsonb;
  v_priority jsonb;
  v_next jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  if public.partner_app_current_identity() is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  v_home := public.partner_app_home();
  v_impact := public.partner_app_impact();
  v_journey := public.partner_app_journey();
  v_business := public.partner_app_business_performance();
  v_learning := public.partner_app_learning_today();
  v_weekly := public.partner_app_weekly_story();

  v_priority := coalesce(v_home->'today'->0,null);
  v_next := v_journey->'next_milestone';

  if v_priority is not null then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'kind','today','eyebrow','TODAY','title',v_priority->>'title',
      'body',v_priority->>'subtitle','route',v_priority->>'route','tone','attention'
    ));
  else
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'kind','today','eyebrow','TODAY','title','You are clear for now',
      'body','No urgent renewal, claim or Policy Intake action is waiting.',
      'route','/pulse','tone','calm'
    ));
  end if;

  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'kind','weekly',
    'eyebrow','YOUR WEEK',
    'title',(v_weekly->>'policies_this_week') || ' policies this week',
    'body','Gross premium ' || trim(to_char((v_weekly->>'premium_this_week')::numeric,'FM₹999999999990D00')) ||
      ' · ' || (v_weekly->>'customers_this_week') || ' customers added',
    'metric',v_weekly->'premium_this_week',
    'metric_label','gross premium',
    'route','/weekly-story',
    'tone','business'
  ));

  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'kind','impact','eyebrow','YOUR IMPACT',
    'title',(v_impact->>'active_vehicles') || ' vehicles currently covered',
    'body',(v_impact->>'customers_served') || ' customers served · ' || (v_impact->>'claims_assisted') || ' claims assisted',
    'metric',v_impact->'active_motor_idv','metric_label','active Motor IDV',
    'route','/impact','tone','impact'
  ));

  if v_next is not null then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'kind','journey','eyebrow','MY JOURNEY',
      'title',(v_next->>'remaining') || ' customers to ' || (v_next->>'title'),
      'body','Your next milestone is based on real recorded customer progress.',
      'progress_current',v_next->'current','progress_target',v_next->'target',
      'route','/journey','tone','journey'
    ));
  end if;

  v_items := v_items || jsonb_build_array(jsonb_build_object(
    'kind','business','eyebrow','THIS MONTH',
    'title',(v_business->>'policies_this_month') || ' policies recorded',
    'body','Gross premium ' || trim(to_char((v_business->>'premium_this_month')::numeric,'FM₹999999999990D00')),
    'metric',v_business->'premium_this_month','metric_label','gross premium',
    'route','/(tabs)/business','tone','business'
  ));

  if coalesce((v_learning->>'available')::boolean,false) then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'kind','learn','eyebrow','60 SEC LEARN',
      'title',v_learning->'card'->>'category',
      'body',v_learning->'card'->>'prompt',
      'route','/learn','tone','learn',
      'answered_today',v_learning->'answered_today'
    ));
  end if;

  return jsonb_build_object('generated_at',now(),'items',v_items);
end;
$$;

revoke all on function public.partner_app_weekly_story() from public, anon;
revoke all on function public.partner_app_recognition() from public, anon;
revoke all on function public.partner_app_activity(integer) from public, anon;
revoke all on function public.partner_app_stories() from public, anon;

grant execute on function public.partner_app_weekly_story() to authenticated, service_role;
grant execute on function public.partner_app_recognition() to authenticated, service_role;
grant execute on function public.partner_app_activity(integer) to authenticated, service_role;
grant execute on function public.partner_app_stories() to authenticated, service_role;

commit;
