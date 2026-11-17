-- Private, additive staging foundation for unattended AI Policy Intake extraction.
-- IMPORTANT: this migration must be applied separately after operator approval.
-- No policies, customer master rows, existing drafts, or Intake OCR are changed.
begin;

create table if not exists public.policy_intake_ai_processing_queue (
  intake_id uuid primary key references public.policy_intake_requests(id) on delete cascade,
  document_id uuid not null references public.policy_intake_documents(id),
  parser_revision text not null default 'bridge-v1',
  state text not null default 'pending'
    check (state in ('pending','processing','exception','verified','unsupported','failed')),
  exception_codes text[] not null default '{}'::text[],
  field_keys text[] not null default '{}'::text[],
  parser_id text,
  checks_passed smallint not null default 0,
  extraction_fingerprint text,
  lease_id uuid,
  leased_until timestamptz,
  attempts integer not null default 0 check (attempts >= 0),
  retry_after timestamptz not null default now(),
  last_error_code text,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_queue_fingerprint_size check (
    extraction_fingerprint is null or extraction_fingerprint ~ '^[a-f0-9]{64}$'
  ),
  constraint ai_queue_lease_state check (
    (state='processing' and lease_id is not null and leased_until is not null)
    or (state<>'processing' and lease_id is null and leased_until is null)
  )
);

create index if not exists policy_intake_ai_queue_claim_idx
  on public.policy_intake_ai_processing_queue(state,retry_after,created_at)
  where state in ('pending','failed','processing');
create index if not exists policy_intake_ai_queue_processed_idx
  on public.policy_intake_ai_processing_queue(processed_at desc);

alter table public.policy_intake_ai_processing_queue enable row level security;
revoke all on public.policy_intake_ai_processing_queue from public, anon, authenticated;
grant select, insert, update on public.policy_intake_ai_processing_queue to service_role;

-- Service-role-only claim. Never exposed to authenticated browser roles.
-- Enqueue fresh/current PDF revisions and reclaim expired leases atomically.
-- Transaction and SKIP LOCKED guarantee concurrent workers don't take the
-- same Intake. Always keep a bounded run size.
create or replace function public.claim_policy_intake_ai_queue_v1(
  p_max integer default 2,
  p_parser_revision text default 'bridge-v1'
)
returns table (intake_id uuid, document_id uuid, lease_id uuid)
language plpgsql security invoker set search_path = public, pg_catalog
as $$
begin
  if current_user <> 'service_role' then
    raise exception 'service_role_required';
  end if;
  if p_max < 1 or p_max > 3 or length(p_parser_revision) > 80 or length(p_parser_revision) < 1 then
    raise exception 'invalid_queue_claim_parameters';
  end if;

  insert into public.policy_intake_ai_processing_queue as q
    (intake_id,document_id,parser_revision,state,retry_after)
  select i.id,d.id,p_parser_revision,'pending',now()
    from public.policy_intake_requests i
    join public.policy_intake_documents d on d.intake_id=i.id
      and d.is_current=true
      and d.storage_bucket=i.storage_bucket
      and d.storage_path=i.storage_path
    where i.status in ('processing','ready_for_review','in_review','needs_attention')
      and i.policy_type in ('motor','non_motor','life','health')
  on conflict (intake_id) do update
    set document_id=excluded.document_id,
        parser_revision=excluded.parser_revision,
        state='pending',exception_codes='{}'::text[],field_keys='{}'::text[],
        parser_id=null,checks_passed=0,extraction_fingerprint=null,
        lease_id=null,leased_until=null,attempts=0,retry_after=now(),
        last_error_code=null,processed_at=null,updated_at=now()
    where q.document_id is distinct from excluded.document_id
       or q.parser_revision is distinct from excluded.parser_revision;

  -- The queue remains locked in one transaction until the lease claim is
  -- committed. Expired processing leases are eligible again.
  return query
    with selected as (
      select q.intake_id
      from public.policy_intake_ai_processing_queue q
      join public.policy_intake_requests i on i.id=q.intake_id
      where i.status in ('processing','ready_for_review','in_review','needs_attention')
        and (
          (q.state in ('pending','failed') and q.retry_after <= now() and q.attempts < 5)
          or (q.state='processing' and q.leased_until < now() and q.attempts < 5)
        )
      order by q.retry_after asc,q.created_at asc
      limit p_max
      for update of q skip locked
    ),
    claimed as (
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

revoke all on function public.claim_policy_intake_ai_queue_v1(integer,text) from public,anon,authenticated;
grant execute on function public.claim_policy_intake_ai_queue_v1(integer,text) to service_role;

commit;
