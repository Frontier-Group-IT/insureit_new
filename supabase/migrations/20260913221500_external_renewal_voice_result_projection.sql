begin;

alter table public.external_renewal_voice_attempts
  drop constraint if exists external_renewal_voice_attempts_call_disposition_check;

alter table public.external_renewal_voice_attempts
  add constraint external_renewal_voice_attempts_call_disposition_check check (
    call_disposition is null or call_disposition in (
      'no_decision','interested','follow_up','not_interested','already_renewed',
      'wrong_person','human_assistance','quote_requested','do_not_contact'
    )
  );

create table if not exists public.external_renewal_voice_attempt_events (
  id uuid primary key default gen_random_uuid(),
  voice_attempt_id uuid not null references public.external_renewal_voice_attempts(id) on delete cascade,
  provider_attempt_id text not null,
  provider_interaction_id text,
  connectivity_status text check (connectivity_status is null or connectivity_status in ('connected','busy','no_answer','failed')),
  completion_status text check (completion_status is null or completion_status in ('completed','partial','failed')),
  next_action_status text,
  failure_reason text check (failure_reason is null or char_length(failure_reason) <= 1000),
  retry_attempt integer not null default 0 check (retry_attempt >= 0),
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_attempt_id)
);

comment on table public.external_renewal_voice_attempt_events is
  'Minimal per-provider-attempt delivery history used for retry-safe Sarvam webhook idempotency. Raw transcripts and raw webhook payloads are intentionally not stored.';

create index if not exists external_renewal_voice_attempt_events_parent_idx
  on public.external_renewal_voice_attempt_events(voice_attempt_id, retry_attempt desc, created_at desc);

alter table public.external_renewal_voice_attempt_events enable row level security;
revoke all on public.external_renewal_voice_attempt_events from public, anon, authenticated;
grant all on public.external_renewal_voice_attempt_events to service_role;

create or replace function public.partner_app_external_renewal_voice_latest(p_opportunity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_partner_ids uuid[] := array[]::uuid[];
  v_result jsonb;
begin
  if p_opportunity_id is null then
    raise exception 'Opportunity id is required';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none')='none' then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  select jsonb_build_object(
    'attempt_id', a.id,
    'submission_status', a.submission_status,
    'connectivity_status', a.connectivity_status,
    'completion_status', a.completion_status,
    'call_disposition', a.call_disposition,
    'customer_interest', a.customer_interest,
    'follow_up_required', a.follow_up_required,
    'follow_up_at', a.follow_up_at,
    'customer_objection', a.customer_objection,
    'call_summary', a.call_summary,
    'duration_seconds', a.duration_seconds,
    'created_at', a.created_at,
    'updated_at', a.updated_at
  )
  into v_result
  from public.external_renewal_voice_attempts a
  join public.external_renewal_opportunities o
    on o.id=a.opportunity_id and o.partner_id=a.partner_id
  join public.external_renewal_import_batches b on b.id=o.batch_id
  where a.opportunity_id=p_opportunity_id
    and a.partner_id=any(v_partner_ids)
    and b.status='published'
    and o.is_active
  order by a.created_at desc
  limit 1;

  return v_result;
end;
$$;

revoke all on function public.partner_app_external_renewal_voice_latest(uuid) from public, anon;
grant execute on function public.partner_app_external_renewal_voice_latest(uuid) to authenticated, service_role;

drop function if exists public.apply_external_renewal_voice_result(
  uuid,text,text,text,text,text,text,integer,numeric,timestamptz,timestamptz,text,text,boolean,timestamptz,text,text
);

create or replace function public.apply_external_renewal_voice_result(
  p_attempt_id uuid,
  p_provider_attempt_id text,
  p_provider_interaction_id text,
  p_provider_campaign_id text,
  p_provider_cohort_id text,
  p_connectivity_status text,
  p_completion_status text,
  p_next_action_status text,
  p_failure_reason text,
  p_retry_attempt integer,
  p_duration_seconds numeric,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_call_disposition text,
  p_customer_interest text,
  p_follow_up_required boolean,
  p_follow_up_at timestamptz,
  p_customer_objection text,
  p_call_summary text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.external_renewal_voice_attempts%rowtype;
  v_opportunity_status text;
  v_outcome text;
  v_note text;
  v_effective_follow_up timestamptz;
  v_event_id uuid;
  v_is_retry_pending boolean := false;
  v_parent_status text;
begin
  if p_provider_attempt_id is null or nullif(btrim(p_provider_attempt_id),'') is null then
    raise exception 'Provider attempt id is required';
  end if;

  if p_connectivity_status is not null and p_connectivity_status not in ('connected','busy','no_answer','failed') then
    raise exception 'Invalid connectivity status';
  end if;
  if p_completion_status is not null and p_completion_status not in ('completed','partial','failed') then
    raise exception 'Invalid completion status';
  end if;
  if p_call_disposition is not null and p_call_disposition not in (
    'no_decision','interested','follow_up','not_interested','already_renewed',
    'wrong_person','human_assistance','quote_requested','do_not_contact'
  ) then
    raise exception 'Invalid call disposition';
  end if;
  if p_customer_interest is not null and p_customer_interest not in ('unknown','high','medium','low') then
    raise exception 'Invalid customer interest';
  end if;

  select * into v_attempt
  from public.external_renewal_voice_attempts
  where id=p_attempt_id
  for update;

  if v_attempt.id is null then
    raise exception 'Voice attempt not found' using errcode='P0002';
  end if;

  if p_provider_campaign_id is not null
     and v_attempt.provider_campaign_id is not null
     and p_provider_campaign_id <> v_attempt.provider_campaign_id then
    raise exception 'Campaign mismatch for voice attempt';
  end if;
  if p_provider_cohort_id is not null
     and v_attempt.provider_cohort_id is not null
     and p_provider_cohort_id <> v_attempt.provider_cohort_id then
    raise exception 'Cohort mismatch for voice attempt';
  end if;

  select id into v_event_id
  from public.external_renewal_voice_attempt_events
  where provider_attempt_id=p_provider_attempt_id;

  if v_event_id is not null then
    return jsonb_build_object(
      'attempt_id',v_attempt.id,
      'provider_attempt_id',p_provider_attempt_id,
      'status',v_attempt.submission_status,
      'changed',false,
      'idempotent',true
    );
  end if;

  insert into public.external_renewal_voice_attempt_events (
    voice_attempt_id,
    provider_attempt_id,
    provider_interaction_id,
    connectivity_status,
    completion_status,
    next_action_status,
    failure_reason,
    retry_attempt,
    duration_seconds,
    started_at,
    ended_at
  ) values (
    v_attempt.id,
    p_provider_attempt_id,
    nullif(btrim(coalesce(p_provider_interaction_id,'')),''),
    p_connectivity_status,
    p_completion_status,
    nullif(btrim(coalesce(p_next_action_status,'')),''),
    left(nullif(btrim(coalesce(p_failure_reason,'')),''),1000),
    greatest(coalesce(p_retry_attempt,0),0),
    case when p_duration_seconds is null then null else greatest(p_duration_seconds,0) end,
    p_started_at,
    p_ended_at
  );

  v_is_retry_pending := p_connectivity_status <> 'connected'
    and nullif(btrim(coalesce(p_next_action_status,'')),'') is not null;

  v_parent_status := case
    when p_connectivity_status='connected' then 'completed'
    when v_is_retry_pending then 'queued'
    when p_completion_status='failed' or p_connectivity_status in ('busy','no_answer','failed') then 'failed'
    else 'completed'
  end;

  v_effective_follow_up := case
    when p_follow_up_required is true and p_follow_up_at is not null and p_follow_up_at > now() then p_follow_up_at
    else null
  end;

  v_outcome := null;
  if p_connectivity_status='connected' then
    v_outcome := case p_call_disposition
      when 'interested' then 'interested'
      when 'quote_requested' then 'quote_requested'
      when 'follow_up' then case when v_effective_follow_up is not null then 'follow_up' else 'connected' end
      when 'already_renewed' then 'renewed_elsewhere'
      when 'do_not_contact' then 'do_not_contact'
      -- Wrong person and a simple decline require human review in the first slice;
      -- neither is allowed to create a terminal CRM state automatically.
      when 'wrong_person' then 'connected'
      when 'not_interested' then 'connected'
      when 'human_assistance' then 'connected'
      else 'connected'
    end;
  end if;

  v_note := left(nullif(btrim(coalesce(p_call_summary,'')),''),4000);

  update public.external_renewal_voice_attempts
  set provider_attempt_id=p_provider_attempt_id,
      provider_interaction_id=coalesce(nullif(btrim(coalesce(p_provider_interaction_id,'')),''),provider_interaction_id),
      provider_campaign_id=coalesce(nullif(btrim(coalesce(p_provider_campaign_id,'')),''),provider_campaign_id),
      provider_cohort_id=coalesce(nullif(btrim(coalesce(p_provider_cohort_id,'')),''),provider_cohort_id),
      submission_status=v_parent_status,
      connectivity_status=p_connectivity_status,
      completion_status=p_completion_status,
      retry_attempt=greatest(coalesce(p_retry_attempt,0),0),
      duration_seconds=case when p_duration_seconds is null then duration_seconds else greatest(p_duration_seconds,0) end,
      started_at=coalesce(p_started_at,started_at),
      ended_at=case when v_is_retry_pending then ended_at else coalesce(p_ended_at,ended_at,now()) end,
      call_disposition=case when p_connectivity_status='connected' then p_call_disposition else call_disposition end,
      customer_interest=case when p_connectivity_status='connected' then p_customer_interest else customer_interest end,
      follow_up_required=case when p_connectivity_status='connected' then p_follow_up_required else follow_up_required end,
      follow_up_at=case when p_connectivity_status='connected' then v_effective_follow_up else follow_up_at end,
      customer_objection=case when p_connectivity_status='connected' then left(nullif(btrim(coalesce(p_customer_objection,'')),''),1000) else customer_objection end,
      call_summary=case when p_connectivity_status='connected' then left(nullif(btrim(coalesce(p_call_summary,'')),''),2000) else call_summary end,
      updated_at=now()
  where id=v_attempt.id;

  if v_outcome is not null then
    select opportunity_status into v_opportunity_status
    from public.external_renewal_opportunities
    where id=v_attempt.opportunity_id and partner_id=v_attempt.partner_id
    for update;

    if v_opportunity_status is null then
      raise exception 'External renewal opportunity is unavailable' using errcode='P0002';
    end if;

    if v_opportunity_status not in ('won','renewed_elsewhere','invalid_contact','do_not_contact','lost') then
      insert into public.external_renewal_interactions (
        opportunity_id, partner_id, interaction_type, outcome, note, follow_up_at, created_by_auth_user_id
      ) values (
        v_attempt.opportunity_id,
        v_attempt.partner_id,
        'call',
        v_outcome,
        v_note,
        case when v_outcome='follow_up' then v_effective_follow_up else null end,
        v_attempt.requested_by_auth_user_id
      );

      update public.external_renewal_opportunities
      set opportunity_status=v_outcome,
          last_interaction_at=now(),
          next_follow_up_at=case when v_outcome='follow_up' then v_effective_follow_up else null end,
          updated_at=now()
      where id=v_attempt.opportunity_id and partner_id=v_attempt.partner_id;
    end if;
  end if;

  return jsonb_build_object(
    'attempt_id',v_attempt.id,
    'provider_attempt_id',p_provider_attempt_id,
    'status',v_parent_status,
    'crm_outcome',v_outcome,
    'retry_pending',v_is_retry_pending,
    'changed',true
  );
end;
$$;

revoke all on function public.apply_external_renewal_voice_result(uuid,text,text,text,text,text,text,text,text,integer,numeric,timestamptz,timestamptz,text,text,boolean,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.apply_external_renewal_voice_result(uuid,text,text,text,text,text,text,text,text,integer,numeric,timestamptz,timestamptz,text,text,boolean,timestamptz,text,text) to service_role;

commit;
