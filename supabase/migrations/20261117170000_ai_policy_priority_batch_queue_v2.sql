-- Safe, additive priority claim for immediate n8n extraction + bounded backlog drain.
-- Keeps v1 function, private RLS queue table and all existing queue rows intact.
-- No customer, Intake OCR, vehicle or policy rows are changed by this migration.
begin;

create or replace function public.claim_policy_intake_ai_queue_v2(
  p_max integer default 6,
  p_parser_revision text default 'bridge-v1',
  p_preferred_intake_id uuid default null
)
returns table (intake_id uuid, document_id uuid, lease_id uuid)
language plpgsql security invoker set search_path = public, pg_catalog
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_max < 1 or p_max > 8
     or length(p_parser_revision) < 1 or length(p_parser_revision) > 80 then
    raise exception 'invalid_queue_claim_parameters';
  end if;
  -- For an immediate upload claim, upsert just that Intake's CURRENT
  -- private document. For cron drain, reconcile all still-open Intakes.
  -- A new document revision or parser revision gets a fresh queue lease;
  -- an already processed/current revision is never reset by retries.
  insert into public.policy_intake_ai_processing_queue as q
    (intake_id,document_id,parser_revision,state,retry_after)
  select i.id,d.id,p_parser_revision,'pending',now()
    from public.policy_intake_requests i
    join public.policy_intake_documents d on d.intake_id=i.id
      and d.is_current=true
      and d.storage_bucket=i.storage_bucket
      and d.storage_path=i.storage_path
    where i.status in ('processing','ready_for_review','in_review','needs_attention')
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
       or q.parser_revision is distinct from excluded.parser_revision;

  return query
    with selected as (
      select q.intake_id
      from public.policy_intake_ai_processing_queue q
      join public.policy_intake_requests i on i.id=q.intake_id
      where i.status in ('processing','ready_for_review','in_review','needs_attention')
        and (p_preferred_intake_id is null or q.intake_id=p_preferred_intake_id)
        and (
          (q.state in ('pending','failed') and q.retry_after<=now() and q.attempts<5)
          or (q.state='processing' and q.leased_until<now() and q.attempts<5)
        )
      order by q.retry_after asc,q.created_at asc
      limit p_max
      for update of q skip locked
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
$$;

revoke all on function public.claim_policy_intake_ai_queue_v2(integer,text,uuid)
  from public, anon, authenticated;
grant execute on function public.claim_policy_intake_ai_queue_v2(integer,text,uuid)
  to service_role;

-- One-time canonical OCR synchronization from a fully validated n8n source.
-- This is intentionally not a booking/customer-link operation. The check is
-- executed atomically under an active lease; stale PDF or a manual draft
-- makes it a no-op. Duplicate classification is handled by the existing
-- shared policy-number check after the canonical field is available.
create or replace function public.sync_verified_ai_intake_ocr_v1(
  p_intake_id uuid,
  p_document_id uuid,
  p_lease_id uuid,
  p_parser_revision text,
  p_verified_fields jsonb,
  p_checks_passed integer
)
returns boolean
language plpgsql security invoker set search_path = public, pg_catalog
as $
declare
  v_updated uuid;
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_checks_passed <> 13
     or p_verified_fields is null
     or jsonb_typeof(p_verified_fields) <> 'array'
     or jsonb_array_length(p_verified_fields) < 8
     or jsonb_array_length(p_verified_fields) > 80
     or p_parser_revision not in ('bridge-v1') then
    return false;
  end if;
  if not exists(
    select 1 from jsonb_array_elements(p_verified_fields) f
    where f->>'key'='policy_number'
      and length(btrim(coalesce(f->>'value',''))) between 5 and 120
  ) or not exists(
    select 1 from jsonb_array_elements(p_verified_fields) f
    where f->>'key'='insured_name'
      and length(btrim(coalesce(f->>'value',''))) between 2 and 160
  ) then
    return false;
  end if;
  update public.policy_intake_requests i
     set status='ready_for_review', ocr_status='completed',
         ocr_fields=p_verified_fields,ocr_warnings='[]'::jsonb,
         ocr_parser_id='icici_3005_n8n_native_pdf',
         ocr_parser_version=p_parser_revision,
         attention_reason=null
   where i.id=p_intake_id
     and i.status='processing'
     and i.policy_type in ('motor')
     and i.ocr_status in ('pending','processing','failed')
     and coalesce(i.ocr_fields,'[]'::jsonb)='[]'::jsonb
     and exists(
       select 1 from public.policy_intake_ai_processing_queue q
       where q.intake_id=i.id and q.document_id=p_document_id
         and q.lease_id=p_lease_id and q.state='processing'
         and q.parser_revision=p_parser_revision
         and q.leased_until>now()
     )
     and exists(
       select 1 from public.policy_intake_documents d
       where d.id=p_document_id and d.intake_id=i.id
         and d.is_current=true
         and d.storage_bucket=i.storage_bucket
         and d.storage_path=i.storage_path
         and d.mime_type='application/pdf'
     )
     and not exists(
       select 1 from public.policy_intake_onboarding_drafts draft
       where draft.intake_id=i.id
     )
  returning i.id into v_updated;
  return v_updated is not null;
end;
$;
revoke all on function public.sync_verified_ai_intake_ocr_v1(uuid,uuid,uuid,text,jsonb,integer)
  from public,anon,authenticated;
grant execute on function public.sync_verified_ai_intake_ocr_v1(uuid,uuid,uuid,text,jsonb,integer)
  to service_role;

commit;
