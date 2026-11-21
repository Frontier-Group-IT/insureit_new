-- Date-filtered, paginated Partner Activity. Preserves the existing scope predicates.
-- Existing partner_app_activity and Home notification RPC remain unchanged.
create or replace function public.partner_app_activity_filtered(p_period text default 'today', p_limit integer default 100, p_offset integer default 0)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'auth'
as $function$
declare
  v_scope jsonb; v_identity jsonb; v_actor_kind text; v_scope_mode text;
  v_employee_ids uuid[]:=array[]::uuid[]; v_intermediary_ids uuid[]:=array[]::uuid[]; v_group_ids uuid[]:=array[]::uuid[];
  v_profile_id uuid; v_portal_account_id uuid; v_limit integer:=greatest(1,least(coalesce(p_limit,100),100)); v_offset integer:=greatest(0,least(coalesce(p_offset,0),10000)); v_fetch integer; v_start timestamptz; v_home jsonb; v_result jsonb;
begin
  if p_period not in ('today','last_week','last_month','all') or p_period is null then
    raise exception 'Invalid activity period' using errcode='22023';
  end if;
  v_fetch:=v_offset+v_limit+1;
  v_start:=case p_period
    when 'today' then (date_trunc('day',now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata')
    when 'last_week' then now()-interval '7 days'
    when 'last_month' then now()-interval '30 days'
    else null end;
  v_identity:=public.partner_app_current_identity(); v_scope:=public.partner_app_commercial_scope();
  if v_identity is null or v_scope is null then raise exception 'INSUREIT Partner access is unavailable' using errcode='28000'; end if;
  v_actor_kind:=v_scope->>'actor_kind'; v_scope_mode:=coalesce(v_scope->>'scope_mode','none');
  v_profile_id:=nullif(v_identity->>'profile_id','')::uuid; v_portal_account_id:=nullif(v_identity->>'portal_account_id','')::uuid;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_employee_ids from jsonb_array_elements_text(coalesce(v_scope->'employee_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_intermediary_ids from jsonb_array_elements_text(coalesce(v_scope->'intermediary_ids','[]'::jsonb)) value;
  select coalesce(array_agg(value::uuid),array[]::uuid[]) into v_group_ids from jsonb_array_elements_text(coalesce(v_scope->'group_ids','[]'::jsonb)) value;
  v_home:=public.partner_app_home();
  with policy_events as (
    select 'policy'::text kind,p.id entity_id,coalesce(p.created_at,p.issuance_date::timestamptz) event_at,
      coalesce(p.policy_no,p.policy_code,'Policy') title,coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') subtitle,
      concat_ws(' · ',ic.name,v.vehicle_no) meta,'/policy/'||p.id::text route,'business'::text tone, null::text manufacturer
    from public.policies p left join public.intermediaries i on i.intermediary_code=p.intermediary_code
    left join public.customers c on c.id=p.customer_id left join public.vehicles v on v.id=p.vehicle_id left join public.insurance_companies ic on ic.id=p.insurance_company_id
    where (v_start is null or coalesce(p.created_at,p.issuance_date::timestamptz)>=v_start) and case when v_scope_mode='none' then false when v_actor_kind='intermediary' then i.id=any(v_intermediary_ids)
      when v_actor_kind='employee' and v_scope_mode='organization' then true
      when v_actor_kind='employee' then p.rm_employee_id=any(v_employee_ids) or i.id=any(v_intermediary_ids) or (p.intermediary_group_id is not null and p.intermediary_group_id=any(v_group_ids)) else false end
    order by event_at desc limit v_fetch
  ), claim_events as (
    select 'claim'::text kind,cl.id entity_id,coalesce(h.created_at,cl.updated_at,cl.created_at) event_at,coalesce(cl.claim_no,'Claim') title,
      coalesce(nullif(c.company_name,''),nullif(c.contact_name,''),c.customer_code,'Customer') subtitle,
      coalesce(h.to_status::text,cl.current_status::text,'Claim updated') meta,'/claim/'||cl.id::text route,'service'::text tone, nullif(trim(v.make),'') manufacturer
    from public.claims cl join public.customers c on c.id=cl.customer_id
    left join public.vehicles v on v.id=cl.vehicle_id
    left join lateral (select x.to_status,x.created_at from public.claim_status_history x where x.claim_id=cl.id order by x.created_at desc limit 1) h on true
    where (v_start is null or coalesce(h.created_at,cl.updated_at,cl.created_at)>=v_start) and case when v_scope_mode='none' then false when v_actor_kind='employee' and v_scope_mode='organization' then true else c.lead_source_intermediary_id=any(v_intermediary_ids) end
    order by event_at desc limit v_fetch
  ), intake_events as (
    select 'intake'::text kind,pir.id entity_id,pir.updated_at event_at,pir.intake_number title,coalesce(nullif(pir.lead_source_name,''),'Policy Intake') subtitle,
      case when pir.status='needs_attention' then 'Needs your attention' when pir.final_policy_id is not null then 'Policy created' when pir.status='in_review' then 'Operations review' when pir.status='ready_for_review' then 'Ready for review' else initcap(replace(pir.status,'_',' ')) end meta,
      '/policy-intakes/'||pir.id::text route,case when pir.status='needs_attention' then 'attention' else 'operations' end tone, null::text manufacturer
    from public.policy_intake_requests pir where (v_start is null or pir.updated_at>=v_start) and case when v_actor_kind='intermediary' then pir.submitted_by_portal_account_id=v_portal_account_id when v_actor_kind='employee' then pir.submitted_by_profile_id=v_profile_id else false end
    order by pir.updated_at desc limit 40
  ), learning_events as (
    select 'learn'::text kind,a.card_id entity_id,a.created_at event_at,c.category title,'60-Second Learn' subtitle,
      case when a.is_correct then 'Answered correctly' else 'Learning card completed' end meta,'/learn' route,'learn' tone, null::text manufacturer
    from public.partner_learning_attempts a join public.partner_learning_cards c on c.id=a.card_id where a.auth_user_id=auth.uid() and (v_start is null or a.created_at>=v_start) order by a.created_at desc limit 20
  ), all_events as (select * from policy_events union all select * from claim_events union all select * from intake_events union all select * from learning_events),
  ranked as (select * from all_events order by event_at desc, kind, entity_id limit v_limit+1 offset v_offset),
  page as (select * from ranked order by event_at desc, kind, entity_id limit v_limit)
  select jsonb_build_object('generated_at',now(),'has_more',(select count(*)>v_limit from ranked),'attention',coalesce(v_home->'today','[]'::jsonb),'items',coalesce(jsonb_agg(jsonb_build_object(
    'kind',kind,'entity_id',entity_id,'event_at',event_at,'title',title,'subtitle',subtitle,'meta',meta,'route',route,'tone',tone,'manufacturer',manufacturer) order by event_at desc),'[]'::jsonb))
  into v_result from page;
  return v_result;
end;
$function$;

revoke all on function public.partner_app_activity_filtered(text,integer,integer) from public, anon;
grant execute on function public.partner_app_activity_filtered(text,integer,integer) to authenticated;
