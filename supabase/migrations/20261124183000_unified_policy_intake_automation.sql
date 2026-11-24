-- All Policy Intakes use a unified AI queue. Keep the old column solely
-- as a compatibility field until older Partner App clients retire it.
-- Apply after deploying the unified upload / AI workbench code, never before.
-- Completed/rejected records retain all business data and status.
begin;

update public.policy_intake_requests
set processing_lane='automation'
where processing_lane is distinct from 'automation';

alter table public.policy_intake_requests
  alter column processing_lane set default 'automation';

alter table public.policy_intake_requests
  drop constraint if exists policy_intake_processing_lane_allowed;

alter table public.policy_intake_requests
  add constraint policy_intake_processing_lane_allowed
  check (processing_lane = 'automation');

-- Existing queue exceptions, fingerprints, booking holds and registered policies
-- are NOT reset. Revalidate an intake explicitly to retry failed extraction.
create or replace function public.claim_policy_intake_ai_queue_v3(
  p_max integer default 6,
  p_parser_revision text default 'bridge-v1',
  p_preferred_intake_id uuid default null
) returns table (intake_id uuid, document_id uuid, lease_id uuid)
language plpgsql set search_path to 'public','pg_catalog'
as $function$
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_max < 1 or p_max > 8
     or length(p_parser_revision) < 1 or length(p_parser_revision) > 80 then
    raise exception 'invalid_queue_claim_parameters';
  end if;
  insert into public.policy_intake_ai_processing_queue as q
    (intake_id,document_id,parser_revision,state,retry_after)
  select i.id,d.id,p_parser_revision,'pending',now()
    from public.policy_intake_requests i
    join public.policy_intake_documents d on d.intake_id=i.id
      and d.is_current=true
      and d.storage_bucket=i.storage_bucket and d.storage_path=i.storage_path
    where i.final_policy_id is null
      and i.status in ('processing','ready_for_review','in_review','needs_attention')
      and (i.policy_type is null or i.policy_type in ('motor','non_motor','life','health'))
      and (p_preferred_intake_id is null or i.id=p_preferred_intake_id)
  on conflict on constraint policy_intake_ai_processing_queue_pkey do update
    set document_id=excluded.document_id,
        parser_revision=excluded.parser_revision,
        state='pending',exception_codes='{}'::text[],field_keys='{}'::text[],
        parser_id=null,checks_passed=0,extraction_fingerprint=null,
        lease_id=null,leased_until=null,attempts=0,retry_after=now(),
        last_error_code=null,processed_at=null,updated_at=now()
    where q.document_id is distinct from excluded.document_id
       or (q.parser_revision is distinct from excluded.parser_revision
           and q.state <> 'duplicate');
  return query
    with selected as (
      select q.intake_id
      from public.policy_intake_ai_processing_queue q
      join public.policy_intake_requests i on i.id=q.intake_id
      where i.final_policy_id is null
        and i.status in ('processing','ready_for_review','in_review','needs_attention')
        and (p_preferred_intake_id is null or q.intake_id=p_preferred_intake_id)
        and (
          (q.state in ('pending','failed') and q.retry_after<=now() and q.attempts<5)
          or (q.state='processing' and q.leased_until<now() and q.attempts<5)
        )
      order by case when i.policy_type='motor' and i.file_name ilike '3005%' then 0 else 1 end,
               q.retry_after asc,q.created_at asc
      limit p_max for update of q skip locked
    ), claimed as (
      update public.policy_intake_ai_processing_queue q
      set state='processing',lease_id=gen_random_uuid(),
          leased_until=now()+interval '4 minutes',
          attempts=q.attempts+1,updated_at=now()
      from selected s
      where q.intake_id=s.intake_id
      returning q.intake_id,q.document_id,q.lease_id
    )
    select c.intake_id,c.document_id,c.lease_id from claimed c;
end;
$function$;
revoke all on function public.claim_policy_intake_ai_queue_v3(integer,text,uuid)
from public,anon,authenticated;
grant execute on function public.claim_policy_intake_ai_queue_v3(integer,text,uuid)
to service_role;
comment on function public.claim_policy_intake_ai_queue_v3(integer,text,uuid)
is 'Service-role-only unified AI Policy Intake queue. No policy booking or manual lane transfer.';

-- Remove the old ability to discard a failed automated intake into a manual lane.
-- DROP IF EXISTS also works on databases where the transfer function was
-- removed by the initial production rollout. Its privileges vanish on DROP.
drop function if exists public.move_policy_intake_automation_to_manual_v1(uuid,uuid,text);

commit;
