-- AI Studio displays the same open membership as the Operations Policy Intake
-- All Open tab: canonical status mapping and registered/earlier-intake duplicate
-- classification across both processing lanes. No booking writes.
create or replace function public.partner_app_ai_studio_list_v1(
  p_filter text default 'open',
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
  if p_filter not in ('open','action','in_review','processing','review','done') or p_filter is null
    or p_offset not between 0 and 2000 or p_limit not between 1 and 40
  then raise exception 'invalid_studio_filter' using errcode='22023'; end if;

  with history as (
    select h.id, h.created_at,
      regexp_replace(upper(trim(coalesce((
        select f->>'value'
        from jsonb_array_elements(coalesce(h.ocr_fields,'[]'::jsonb)) f
        where f->>'key'='policy_number' limit 1
      ),''))), '[^A-Z0-9]','','g') as policy_no
    from public.policy_intake_requests h
    -- Same chronological first-intake candidate window as the website detector.
    order by h.created_at asc,h.id asc
    limit 5000
  ), first_intake as (
    select distinct on (policy_no) policy_no,id
    from history where policy_no<>''
    order by policy_no,created_at asc,id asc
  ), candidates as (
    select i.id,i.intake_number,i.lead_source_name,i.policy_type,
      i.status,i.created_at,i.updated_at,i.ocr_status,i.ocr_parser_id,
      i.final_policy_id,i.processing_lane,
      coalesce(q.state,'not_queued') as queue_state,
      coalesce(q.checks_passed,0) as checks_passed,
      coalesce(q.exception_codes,array[]::text[]) as exception_codes,
      q.last_error_code,
      regexp_replace(upper(trim(coalesce((
        select f->>'value' from jsonb_array_elements(coalesce(i.ocr_fields,'[]'::jsonb)) f
        where f->>'key'='policy_number' limit 1
      ),''))), '[^A-Z0-9]','','g') as policy_no
    from public.policy_intake_requests i
    left join public.policy_intake_ai_processing_queue q on q.intake_id=i.id
    where i.status in ('processing','ready_for_review','in_review','needs_attention')
  ), classified as (
    select c.*,
      case
        when c.policy_no<>'' and (
          exists(select 1 from public.policies p where p.policy_no_normalized=c.policy_no)
          or exists(select 1 from first_intake f where f.policy_no=c.policy_no and f.id<>c.id)
        ) then 'duplicate'
        when c.status in ('ready_for_review','needs_attention')
          or (c.status='processing' and c.ocr_status='failed') then 'action'
        when c.status='in_review' then 'in_review'
        else 'processing'
      end as bucket
    from candidates c
  ), open_items as (
    select * from classified where bucket in ('action','in_review','processing')
  ), selected as (
    select * from open_items
    where p_filter in ('open','review') or bucket=p_filter
    order by created_at desc,id desc limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'counts',jsonb_build_object(
      'open',(select count(*) from open_items),
      -- Compatibility during mobile OTA rollout: older apps use review/done.
      'review',(select count(*) from open_items),
      'done',0,
      'action',(select count(*) from open_items where bucket='action'),
      'in_review',(select count(*) from open_items where bucket='in_review'),
      'processing',(select count(*) from open_items where bucket='processing')
    ),
    'rows',(select coalesce(jsonb_agg(to_jsonb(s) - 'policy_no' order by s.created_at desc,s.id desc),'[]'::jsonb)
       from selected s)
  ) into v_result;
  return coalesce(v_result,'{"counts":{"open":0,"action":0,"in_review":0,"processing":0},"rows":[]}'::jsonb);
end
$function$;

-- IT employees can inspect the open intake returned by the queue, regardless
-- of lane. The private action route separately enforces the automation lane.
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
    'status',i.status,'ocr_status',i.ocr_status,'processing_lane',i.processing_lane,
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
  where i.id=p_intake_id
    and i.status in ('processing','ready_for_review','in_review','needs_attention');
  if v_result is null then raise exception 'intake_not_found' using errcode='22023'; end if;
  return v_result;
end
$function$;
revoke all on function public.partner_app_ai_studio_list_v1(text,integer,integer) from public,anon,authenticated;
revoke all on function public.partner_app_ai_studio_detail_v1(uuid) from public,anon,authenticated;
grant execute on function public.partner_app_ai_studio_list_v1(text,integer,integer) to authenticated,service_role;
grant execute on function public.partner_app_ai_studio_detail_v1(uuid) to authenticated,service_role;
