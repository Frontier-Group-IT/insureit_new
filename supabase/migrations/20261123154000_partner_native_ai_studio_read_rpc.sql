-- Native Partner AI Studio: Vercel-independent, IT-only read surface.
-- Neither RPC mutates intakes nor permits the handset to call service-role
-- n8n, storage, booking, queue leasing, or policy registration.
create or replace function public.partner_app_ai_studio_list_v1(
  p_filter text default 'review',
  p_offset integer default 0,
  p_limit integer default 25
) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_access jsonb;
  v_role text;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  v_access := public.partner_app_effective_permissions();
  select role::text into v_role from public.profiles where id=v_uid;
  if v_access->>'actor_kind' is distinct from 'employee'
    or v_role not in ('it_super_user','super_admin')
    or v_access->'capabilities'->>'manage_system' is distinct from 'approve'
    or coalesce(v_access->'capabilities'->>'view_policy_intakes','none') not in ('view','edit','approve')
    or coalesce(v_access->'capabilities'->>'review_policy_intakes','none') not in ('edit','approve')
  then raise exception 'ai_studio_access_denied' using errcode='42501'; end if;
  if p_filter not in ('review','processing','done') or p_filter is null
    or p_offset not between 0 and 2000 or p_limit not between 1 and 40
  then raise exception 'invalid_studio_filter' using errcode='22023'; end if;

  with items as (
    select i.id, i.intake_number, i.lead_source_name, i.policy_type,
      i.status, i.updated_at, i.ocr_status, i.ocr_parser_id, i.final_policy_id,
      coalesce(q.state,'not_queued') as queue_state,
      coalesce(q.checks_passed,0) as checks_passed,
      coalesce(q.exception_codes,array[]::text[]) as exception_codes,
      q.last_error_code,
      case when i.final_policy_id is not null then 'done'
           when i.status in ('ready_for_review','in_review') then 'review'
           else 'processing' end as bucket
    from public.policy_intake_requests i
    left join public.policy_intake_ai_processing_queue q on q.intake_id=i.id
    where i.processing_lane='automation'
  ), selected as (
    select * from items where bucket=p_filter
    order by updated_at desc, id desc limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'counts',(select coalesce(jsonb_object_agg(bucket,n),'{}'::jsonb)
       from (select bucket,count(*) as n from items group by bucket) counts),
    'rows',(select coalesce(jsonb_agg(to_jsonb(s) order by s.updated_at desc,s.id desc),'[]'::jsonb)
       from selected s)
  ) into v_result;
  return coalesce(v_result,'{"counts":{},"rows":[]}'::jsonb);
end
$function$;

create or replace function public.partner_app_ai_studio_detail_v1(
  p_intake_id uuid
) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $function$
declare
  v_uid uuid := auth.uid();
  v_access jsonb;
  v_role text;
  v_result jsonb;
begin
  if v_uid is null then raise exception 'not_authenticated' using errcode='42501'; end if;
  v_access := public.partner_app_effective_permissions();
  select role::text into v_role from public.profiles where id=v_uid;
  if v_access->>'actor_kind' is distinct from 'employee'
    or v_role not in ('it_super_user','super_admin')
    or v_access->'capabilities'->>'manage_system' is distinct from 'approve'
    or coalesce(v_access->'capabilities'->>'view_policy_intakes','none') not in ('view','edit','approve')
    or coalesce(v_access->'capabilities'->>'review_policy_intakes','none') not in ('edit','approve')
  then raise exception 'ai_studio_access_denied' using errcode='42501'; end if;
  select jsonb_build_object(
    'id',i.id, 'intake_number',i.intake_number,
    'lead_source_name',i.lead_source_name,'policy_type',i.policy_type,
    'status',i.status,'ocr_status',i.ocr_status,
    'parser',i.ocr_parser_id,'parser_version',i.ocr_parser_version,
    'queue_state',coalesce(q.state,'not_queued'),
    'checks_passed',coalesce(q.checks_passed,0),
    'exception_codes',coalesce(to_jsonb(q.exception_codes),'[]'::jsonb),
    'last_error_code',q.last_error_code,
    'fields',coalesce((select jsonb_agg(jsonb_build_object(
      'key',f->>'key','value',f->>'value','evidence',f->>'evidence')
      order by f->>'key')
      from jsonb_array_elements(coalesce(i.ocr_fields,'[]'::jsonb)) as f
      where f->>'key' is not null and f->>'value' is not null),'[]'::jsonb),
    'final_policy_id',i.final_policy_id,
    'draft_revision',d.revision,
    'updated_at',i.updated_at
  ) into v_result
  from public.policy_intake_requests i
  left join public.policy_intake_ai_processing_queue q on q.intake_id=i.id
  left join public.policy_intake_onboarding_drafts d on d.intake_id=i.id
  where i.id=p_intake_id and i.processing_lane='automation';
  if v_result is null then raise exception 'intake_not_found' using errcode='22023'; end if;
  return v_result;
end
$function$;
revoke all on function public.partner_app_ai_studio_list_v1(text,integer,integer) from public,anon,authenticated;
revoke all on function public.partner_app_ai_studio_detail_v1(uuid) from public,anon,authenticated;
grant execute on function public.partner_app_ai_studio_list_v1(text,integer,integer) to authenticated,service_role;
grant execute on function public.partner_app_ai_studio_detail_v1(uuid) to authenticated,service_role;
