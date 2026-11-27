-- Only failed transport errors may exhaust up to 12 rather than 5 queue claims.
-- No changes to source-verified exceptions, immutable booking ledgers, or Tata recovery.
CREATE OR REPLACE FUNCTION public.claim_policy_intake_ai_queue_v3(p_max integer DEFAULT 6, p_parser_revision text DEFAULT 'bridge-v1'::text, p_preferred_intake_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(intake_id uuid, document_id uuid, lease_id uuid)
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_catalog'
AS $function$
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
          (q.state in ('pending','failed') and q.retry_after<=now() and (q.attempts<5 or (q.state='failed' and q.last_error_code='n8n_unavailable' and q.attempts<12)))
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
$function$
;


-- Exact-once re-assessment after the NIA Intra V30 source-certification
-- release. Never bump the global registry revision: that would also reset
-- the excluded historical Tata AIG extraction queues.
create table if not exists public.policy_intake_ai_source_rule_replays (
 intake_id uuid not null references public.policy_intake_requests(id),
 source_rule text not null check (source_rule='nia_intra_v30_source_v1'),
 document_id uuid not null references public.policy_intake_documents(id),
 queued_at timestamptz not null default now(),
 primary key(intake_id,source_rule)
);
alter table public.policy_intake_ai_source_rule_replays enable row level security;
revoke all on public.policy_intake_ai_source_rule_replays from public,anon,authenticated;
grant select,insert on public.policy_intake_ai_source_rule_replays to service_role;

create or replace function public.requeue_ai_nia_intra_after_rule_v1(
 p_max integer default 12
) returns integer language plpgsql security invoker
set search_path to public,pg_catalog
as $$
declare v_count integer;
begin
 if current_user <> 'service_role' then raise exception 'service_role_required'; end if;
 if p_max<1 or p_max>12 then raise exception 'invalid_requeue_limit'; end if;
 with eligible as (
  select q.intake_id,q.document_id
  from public.policy_intake_ai_processing_queue q
  join public.policy_intake_requests i on i.id=q.intake_id
  join public.policy_intake_documents d on d.id=q.document_id
    and d.intake_id=i.id and d.is_current=true
    and d.storage_bucket=i.storage_bucket and d.storage_path=i.storage_path
  where q.state='exception'
    and q.parser_id='new_india_cv_native_pdf'
    and q.checks_passed=16
    and q.last_error_code='nia_nia_untrained_vehicle_or_product_variant'
    and i.policy_type='motor'
    and i.status in ('processing','ready_for_review','in_review','needs_attention')
    and i.assigned_to_profile_id is null and i.final_policy_id is null
    and not exists (
      select 1 from public.policy_intake_ai_auto_booking_attempts a
      where a.intake_id=q.intake_id)
    and not exists (
      select 1 from public.policy_intake_ai_canonical_recovery_attempts c
      where c.intake_id=q.intake_id)
    and not exists (
      select 1 from public.policy_intake_ai_source_rule_replays prior
      where prior.intake_id=q.intake_id and prior.source_rule='nia_intra_v30_source_v1')
  order by q.updated_at,q.intake_id
  limit p_max for update of q skip locked
 ), marked as (
  insert into public.policy_intake_ai_source_rule_replays as mark
   (intake_id,source_rule,document_id)
  select e.intake_id,'nia_intra_v30_source_v1',e.document_id from eligible e
  on conflict on constraint policy_intake_ai_source_rule_replays_pkey do nothing
  returning mark.intake_id,mark.document_id
 ), queued as (
  update public.policy_intake_ai_processing_queue q
  set state='pending',retry_after=now(),attempts=0,
      last_error_code='source_rule_reassessment_queued',
      processed_at=null,updated_at=now()
  from marked m where q.intake_id=m.intake_id and q.document_id=m.document_id
    and q.state='exception'
    and q.last_error_code='nia_nia_untrained_vehicle_or_product_variant'
  returning q.intake_id
 )
 select count(*) into v_count from queued;
 return v_count;
end $$;
revoke all on function public.requeue_ai_nia_intra_after_rule_v1(integer) from public,anon,authenticated;
grant execute on function public.requeue_ai_nia_intra_after_rule_v1(integer) to service_role;
