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
  if v_scope is null then raise exception 'INSUREIT Partner access is unavailable' using errcode='28000'; end if;

  v_actor_kind := v_scope->>'actor_kind';
  v_scope_mode := coalesce(v_scope->>'scope_mode','none');

  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_employee_ids
  from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_intermediary_ids
  from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_group_ids
  from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;

  with scoped_policies as (
    select p.*, coalesce(ppd.gross_premium,p.premium_amount,0) as effective_premium,
           coalesce(p.issuance_date,p.created_at::date) as event_date
    from public.policies p
    left join public.policy_premium_details ppd on ppd.policy_id=p.id
    left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    where case
      when v_scope_mode='none' then false
      when v_actor_kind='intermediary' then i.id=any(v_intermediary_ids)
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      when v_actor_kind='employee' then p.rm_employee_id=any(v_employee_ids) or i.id=any(v_intermediary_ids)
        or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids))
      else false end
  ),
  scoped_customers as (
    select c.* from public.customers c
    where case when v_scope_mode='none' then false
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      else c.lead_source_intermediary_id=any(v_intermediary_ids) end
  ),
  scoped_claim_ids as (
    select cl.id from public.claims cl join public.customers c on c.id=cl.customer_id
    where case when v_scope_mode='none' then false
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      else c.lead_source_intermediary_id=any(v_intermediary_ids) end
  ),
  ps as (
    select
      count(*) filter(where event_date>=v_week_start and event_date<v_next_week_start)::int policies_this_week,
      coalesce(sum(effective_premium) filter(where event_date>=v_week_start and event_date<v_next_week_start),0) premium_this_week,
      count(*) filter(where event_date>=v_prev_week_start and event_date<v_week_start)::int policies_last_week,
      coalesce(sum(effective_premium) filter(where event_date>=v_prev_week_start and event_date<v_week_start),0) premium_last_week,
      count(*) filter(where end_date>=v_next_week_start and end_date<v_following_week_start)::int renewals_next_week,
      coalesce(sum(effective_premium) filter(where end_date>=v_next_week_start and end_date<v_following_week_start),0) renewal_premium_next_week
    from scoped_policies
  ),
  cs as (
    select count(*) filter(where created_at::date>=v_week_start and created_at::date<v_next_week_start)::int customers_this_week
    from scoped_customers
  ),
  hs as (
    select count(distinct h.claim_id)::int claims_progressed_this_week
    from public.claim_status_history h
    where h.claim_id in (select id from scoped_claim_ids)
      and h.created_at::date>=v_week_start and h.created_at::date<v_next_week_start
  )
  select jsonb_build_object(
    'generated_at',now(),'week_start',v_week_start,'week_end',v_next_week_start-1,
    'policies_this_week',ps.policies_this_week,'premium_this_week',ps.premium_this_week,
    'policies_last_week',ps.policies_last_week,'premium_last_week',ps.premium_last_week,
    'premium_change_percent',case when ps.premium_last_week>0 then round(((ps.premium_this_week-ps.premium_last_week)/ps.premium_last_week*100)::numeric,1)
      when ps.premium_this_week>0 then 100::numeric else 0::numeric end,
    'customers_this_week',cs.customers_this_week,'claims_progressed_this_week',hs.claims_progressed_this_week,
    'renewals_next_week',ps.renewals_next_week,'renewal_premium_next_week',ps.renewal_premium_next_week
  ) into v_result from ps cross join cs cross join hs;
  return v_result;
end;
$$;

create or replace function public.partner_app_recognition()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare
  v_journey jsonb; v_learning jsonb; v_renewals jsonb; v_items jsonb := '[]'::jsonb; v_latest jsonb;
begin
  if auth.uid() is null or public.partner_app_current_identity() is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;
  v_journey:=public.partner_app_journey();
  v_learning:=public.partner_app_learning_today();
  v_renewals:=public.partner_app_renewal_summary();
  if jsonb_array_length(coalesce(v_journey->'milestones','[]'::jsonb))>0 then
    v_latest := (v_journey->'milestones')->(jsonb_array_length(v_journey->'milestones')-1);
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code','LATEST_MILESTONE','title',v_latest->>'title','body',v_latest->>'subtitle','tone','journey','icon','trail','date',v_latest->>'date'));
  end if;
  if coalesce((v_learning->'stats'->>'current_streak')::int,0)>=3 then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code','LEARNING_RHYTHM','title','Learning rhythm','body',(v_learning->'stats'->>'current_streak')||' consecutive learning days recorded.','tone','learn','icon','learn'));
  end if;
  if coalesce((v_renewals->>'overdue_count')::int,0)=0 then
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'code','RENEWAL_CLEAR','title','Renewal book clear','body','No overdue policy is currently present in your authorized renewal book.','tone','clear','icon','renewal'));
  end if;
  return jsonb_build_object('generated_at',now(),'items',v_items,'next_milestone',v_journey->'next_milestone');
end;
$$;

create or replace function public.partner_app_support()
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare
  v_scope jsonb; v_identity jsonb; v_actor_kind text; v_owner_id uuid; v_contact jsonb; v_home jsonb;
begin
  v_identity:=public.partner_app_current_identity(); v_scope:=public.partner_app_commercial_scope();
  if v_identity is null or v_scope is null then raise exception 'INSUREIT Partner access is unavailable' using errcode='28000'; end if;
  v_actor_kind:=v_identity->>'actor_kind';
  if v_actor_kind='intermediary' then
    select nullif(value,'')::uuid into v_owner_id from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value limit 1;
    if v_owner_id is not null then
      select jsonb_build_object('employee_id',e.id,'name',e.full_name,'employee_code',e.employee_code,'designation',e.designation,'phone',e.phone,'email',e.email)
      into v_contact from public.employees e where e.id=v_owner_id and e.employment_status='active';
    end if;
  end if;
  v_home:=public.partner_app_home();
  return jsonb_build_object('generated_at',now(),'relationship_contact',v_contact,
    'operations',jsonb_build_object('intakes_in_progress',coalesce((v_home->'service'->>'intakes_in_progress')::int,0),'intakes_need_attention',coalesce((v_home->'service'->>'intakes_need_attention')::int,0),'active_claims',coalesce((v_home->'service'->>'active_claims')::int,0)));
end;
$$;

create or replace function public.partner_app_activity(p_limit integer default 40)
returns jsonb language plpgsql stable security definer set search_path=public,auth as $$
declare
  v_scope jsonb; v_identity jsonb; v_actor_kind text; v_scope_mode text;
  v_employee_ids uuid[]:=array[]::uuid[]; v_intermediary_ids uuid[]:=array[]::uuid[]; v_group_ids uuid[]:=array[]::uuid[];
  v_profile_id uuid; v_portal_account_id uuid; v_limit integer:=greatest(1,least(coalesce(p_limit,40),100)); v_home jsonb; v_result jsonb;
begin
  v_identity:=public.partner_app_current_identity(); v_scope:=public.partner_app_commercial_scope();
  if v_identity is null or v_scope is null then raise exception 'INSUREIT Partner access is unavailable' using errcode='28000'; end if;
  v_actor_kind:=v_scope->>'actor_kind'; v_scope_mode:=coalesce(v_scope->>'scope_mode','none');
  v_profile_id:=nullif(v_identity->>'profile_id','')::uuid; v_portal_account_id:=nullif(v_identity->>'portal_account_id','')::uuid;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_employee_ids from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_intermediary_ids from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_group_ids from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;
  v_home:=public.partner_app_home();
  with policy_events as (
    select 'policy'::text kind,p.id entity_id,coalesce(p.issuance_date::timestamptz,p.created_at) event_at,
      coalesce(p.policy_no,p.policy_code,'Policy') title,coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') subtitle,
      concat_ws(' · ',ic.name,v.vehicle_no) meta,'/policy/'||p.id::text route,'business'::text tone
    from public.policies p left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    left join public.customers c on c.id=p.customer_id left join public.vehicles v on v.id=p.vehicle_id left join public.insurance_companies ic on ic.id=p.insurance_company_id
    where case when v_scope_mode='none' then false when v_actor_kind='intermediary' then i.id=any(v_intermediary_ids)
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      when v_actor_kind='employee' then p.rm_employee_id=any(v_employee_ids) or i.id=any(v_intermediary_ids) or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids)) else false end
    order by event_at desc limit 40
  ), claim_events as (
    select 'claim'::text kind,cl.id entity_id,coalesce(h.created_at,cl.updated_at,cl.created_at) event_at,coalesce(cl.claim_no,'Claim') title,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') subtitle,
      coalesce(h.to_status::text,cl.current_status::text,'Claim updated') meta,'/claim/'||cl.id::text route,'service'::text tone
    from public.claims cl join public.customers c on c.id=cl.customer_id
    left join lateral (select x.to_status,x.created_at from public.claim_status_history x where x.claim_id=cl.id order by x.created_at desc limit 1) h on true
    where case when v_scope_mode='none' then false when v_actor_kind='employee' and v_scope_mode='organization' then true else c.lead_source_intermediary_id=any(v_intermediary_ids) end
    order by event_at desc limit 40
  ), intake_events as (
    select 'intake'::text kind,pir.id entity_id,pir.updated_at event_at,pir.intake_number title,coalesce(nullif(pir.lead_source_name,''),'Policy Intake') subtitle,
      case when pir.status='needs_attention' then 'Needs your attention' when pir.final_policy_id is not null then 'Policy created' when pir.status='in_review' then 'Operations review' when pir.status='ready_for_review' then 'Ready for review' else initcap(replace(pir.status,'_',' ')) end meta,
      '/policy-intakes/'||pir.id::text route,case when pir.status='needs_attention' then 'attention' else 'operations' end tone
    from public.policy_intake_requests pir where case when v_actor_kind='intermediary' then pir.submitted_by_portal_account_id=v_portal_account_id when v_actor_kind='employee' then pir.submitted_by_profile_id=v_profile_id else false end
    order by pir.updated_at desc limit 40
  ), learning_events as (
    select 'learn'::text kind,a.card_id entity_id,a.created_at event_at,c.category title,'60-Second Learn' subtitle,
      case when a.is_correct then 'Answered correctly' else 'Learning card completed' end meta,'/learn' route,'learn' tone
    from public.partner_learning_attempts a join public.partner_learning_cards c on c.id=a.card_id where a.auth_user_id=auth.uid() order by a.created_at desc limit 20
  ), all_events as (select * from policy_events union all select * from claim_events union all select * from intake_events union all select * from learning_events),
  ranked as (select * from all_events order by event_at desc limit v_limit)
  select jsonb_build_object('generated_at',now(),'attention',coalesce(v_home->'today','[]'::jsonb),'items',coalesce(jsonb_agg(jsonb_build_object(
    'kind',kind,'entity_id',entity_id,'event_at',event_at,'title',title,'subtitle',subtitle,'meta',meta,'route',route,'tone',tone) order by event_at desc),'[]'::jsonb))
  into v_result from ranked;
  return v_result;
end;
$$;

revoke all on function public.partner_app_weekly_story() from public,anon;
revoke all on function public.partner_app_recognition() from public,anon;
revoke all on function public.partner_app_support() from public,anon;
revoke all on function public.partner_app_activity(integer) from public,anon;
grant execute on function public.partner_app_weekly_story() to authenticated,service_role;
grant execute on function public.partner_app_recognition() to authenticated,service_role;
grant execute on function public.partner_app_support() to authenticated,service_role;
grant execute on function public.partner_app_activity(integer) to authenticated,service_role;

commit;
