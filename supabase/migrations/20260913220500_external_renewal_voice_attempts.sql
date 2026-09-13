begin;

create table if not exists public.external_renewal_voice_attempts (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null,
  partner_id uuid not null references public.partners(id) on delete restrict,
  provider text not null default 'sarvam' check (provider = 'sarvam'),
  provider_app_id text,
  provider_campaign_id text,
  provider_cohort_id text,
  provider_attempt_id text,
  provider_interaction_id text,
  submission_status text not null default 'created' check (submission_status in ('created','submitted','queued','calling','completed','failed','cancelled')),
  connectivity_status text check (connectivity_status is null or connectivity_status in ('connected','busy','no_answer','failed')),
  completion_status text check (completion_status is null or completion_status in ('completed','partial','failed')),
  retry_attempt integer not null default 0 check (retry_attempt >= 0),
  duration_seconds numeric check (duration_seconds is null or duration_seconds >= 0),
  started_at timestamptz,
  ended_at timestamptz,
  call_disposition text check (call_disposition is null or call_disposition in ('no_decision','interested','follow_up','not_interested','already_renewed','wrong_person','human_assistance','quote_requested')),
  customer_interest text check (customer_interest is null or customer_interest in ('unknown','high','medium','low')),
  follow_up_required boolean,
  follow_up_at timestamptz,
  customer_objection text check (customer_objection is null or char_length(customer_objection) <= 1000),
  call_summary text check (call_summary is null or char_length(call_summary) <= 2000),
  provider_payload_version integer not null default 1 check (provider_payload_version > 0),
  requested_by_auth_user_id uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (opportunity_id, partner_id)
    references public.external_renewal_opportunities(id, partner_id)
    on delete cascade
);

comment on table public.external_renewal_voice_attempts is
  'Provider-level outbound voice attempt state for isolated external renewal opportunities. This table does not create or update verified INSUREIT customer, vehicle or policy business.';

create unique index if not exists external_renewal_voice_provider_attempt_uidx
  on public.external_renewal_voice_attempts(provider, provider_attempt_id)
  where provider_attempt_id is not null;

create index if not exists external_renewal_voice_opportunity_created_idx
  on public.external_renewal_voice_attempts(opportunity_id, created_at desc);

create unique index if not exists external_renewal_voice_one_active_attempt_uidx
  on public.external_renewal_voice_attempts(opportunity_id)
  where submission_status in ('created','submitted','queued','calling');

alter table public.external_renewal_voice_attempts enable row level security;
revoke all on public.external_renewal_voice_attempts from public, anon, authenticated;
grant all on public.external_renewal_voice_attempts to service_role;

create or replace function public.partner_app_start_external_renewal_voice_attempt(
  p_opportunity_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_partner_ids uuid[] := array[]::uuid[];
  v_opportunity public.external_renewal_opportunities%rowtype;
  v_attempt_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  if p_opportunity_id is null then
    raise exception 'Opportunity id is required';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none') = 'none' then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  select o.*
  into v_opportunity
  from public.external_renewal_opportunities o
  join public.external_renewal_import_batches b on b.id=o.batch_id
  where o.id=p_opportunity_id
    and o.partner_id=any(v_partner_ids)
    and b.status='published'
    and o.is_active
  for update of o;

  if v_opportunity.id is null then
    raise exception 'External renewal opportunity is unavailable' using errcode='P0002';
  end if;

  if v_opportunity.opportunity_status in ('won','renewed_elsewhere','invalid_contact','do_not_contact','lost','duplicate') then
    raise exception 'This external renewal opportunity is not eligible for AI outreach';
  end if;

  if nullif(regexp_replace(coalesce(v_opportunity.mobile,''),'\D','','g'),'') is null then
    raise exception 'A valid mobile number is required before starting an AI call';
  end if;

  if exists (
    select 1
    from public.external_renewal_voice_attempts a
    where a.opportunity_id=v_opportunity.id
      and a.submission_status in ('created','submitted','queued','calling')
  ) then
    raise exception 'An AI call is already active for this opportunity';
  end if;

  insert into public.external_renewal_voice_attempts (
    opportunity_id,
    partner_id,
    requested_by_auth_user_id
  ) values (
    v_opportunity.id,
    v_opportunity.partner_id,
    auth.uid()
  ) returning id into v_attempt_id;

  return jsonb_build_object(
    'attempt_id', v_attempt_id,
    'opportunity_id', v_opportunity.id,
    'mobile', v_opportunity.mobile,
    'customer_name', coalesce(v_opportunity.customer_name, v_opportunity.contact_name, v_opportunity.account_name),
    'vehicle_make_model', nullif(btrim(concat_ws(' ', v_opportunity.vehicle_make, v_opportunity.vehicle_model)),''),
    'vehicle_number', coalesce(nullif(btrim(v_opportunity.registration_no),''), nullif(btrim(v_opportunity.chassis_no),'')),
    'current_insurer', v_opportunity.current_insurer,
    'policy_expiry_date', v_opportunity.policy_end_date,
    'previous_idv', null,
    'previous_premium', null
  );
end;
$$;

revoke all on function public.partner_app_start_external_renewal_voice_attempt(uuid) from public, anon;
grant execute on function public.partner_app_start_external_renewal_voice_attempt(uuid) to authenticated, service_role;

create or replace function public.apply_external_renewal_voice_submission(
  p_attempt_id uuid,
  p_provider_campaign_id text,
  p_provider_cohort_id text,
  p_provider_app_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.external_renewal_voice_attempts%rowtype;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'Service role required' using errcode='42501';
  end if;

  select * into v_attempt
  from public.external_renewal_voice_attempts
  where id=p_attempt_id
  for update;

  if v_attempt.id is null then
    raise exception 'Voice attempt not found' using errcode='P0002';
  end if;

  if v_attempt.submission_status not in ('created','submitted') then
    return jsonb_build_object('attempt_id',v_attempt.id,'status',v_attempt.submission_status,'changed',false);
  end if;

  update public.external_renewal_voice_attempts
  set provider_campaign_id=nullif(btrim(coalesce(p_provider_campaign_id,'')),''),
      provider_cohort_id=nullif(btrim(coalesce(p_provider_cohort_id,'')),''),
      provider_app_id=nullif(btrim(coalesce(p_provider_app_id,'')),''),
      submission_status='queued',
      updated_at=now()
  where id=p_attempt_id;

  return jsonb_build_object('attempt_id',p_attempt_id,'status','queued','changed',true);
end;
$$;

revoke all on function public.apply_external_renewal_voice_submission(uuid,text,text,text) from public, anon, authenticated;
grant execute on function public.apply_external_renewal_voice_submission(uuid,text,text,text) to service_role;

create or replace function public.fail_external_renewal_voice_submission(
  p_attempt_id uuid,
  p_summary text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_attempt public.external_renewal_voice_attempts%rowtype;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'Service role required' using errcode='42501';
  end if;

  select * into v_attempt
  from public.external_renewal_voice_attempts
  where id=p_attempt_id
  for update;

  if v_attempt.id is null then
    raise exception 'Voice attempt not found' using errcode='P0002';
  end if;

  if v_attempt.submission_status in ('completed','failed','cancelled') then
    return jsonb_build_object('attempt_id',v_attempt.id,'status',v_attempt.submission_status,'changed',false);
  end if;

  update public.external_renewal_voice_attempts
  set submission_status='failed',
      completion_status='failed',
      call_summary=left(nullif(btrim(coalesce(p_summary,'')),''),2000),
      ended_at=coalesce(ended_at,now()),
      updated_at=now()
  where id=p_attempt_id;

  return jsonb_build_object('attempt_id',p_attempt_id,'status','failed','changed',true);
end;
$$;

revoke all on function public.fail_external_renewal_voice_submission(uuid,text) from public, anon, authenticated;
grant execute on function public.fail_external_renewal_voice_submission(uuid,text) to service_role;

create or replace function public.apply_external_renewal_voice_result(
  p_attempt_id uuid,
  p_provider_attempt_id text,
  p_provider_interaction_id text,
  p_provider_campaign_id text,
  p_provider_cohort_id text,
  p_connectivity_status text,
  p_completion_status text,
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
  v_interaction_type text := 'call';
  v_note text;
  v_effective_follow_up timestamptz;
begin
  if current_user not in ('postgres','service_role') then
    raise exception 'Service role required' using errcode='42501';
  end if;

  if p_connectivity_status is not null and p_connectivity_status not in ('connected','busy','no_answer','failed') then
    raise exception 'Invalid connectivity status';
  end if;
  if p_completion_status is not null and p_completion_status not in ('completed','partial','failed') then
    raise exception 'Invalid completion status';
  end if;
  if p_call_disposition is not null and p_call_disposition not in ('no_decision','interested','follow_up','not_interested','already_renewed','wrong_person','human_assistance','quote_requested') then
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

  if v_attempt.provider_attempt_id is not null
     and p_provider_attempt_id is not null
     and v_attempt.provider_attempt_id <> p_provider_attempt_id then
    raise exception 'Provider attempt mismatch';
  end if;

  if v_attempt.submission_status='completed'
     and (p_provider_attempt_id is null or v_attempt.provider_attempt_id=p_provider_attempt_id) then
    return jsonb_build_object('attempt_id',v_attempt.id,'status','completed','changed',false,'idempotent',true);
  end if;

  select opportunity_status into v_opportunity_status
  from public.external_renewal_opportunities
  where id=v_attempt.opportunity_id and partner_id=v_attempt.partner_id
  for update;

  if v_opportunity_status is null then
    raise exception 'External renewal opportunity is unavailable' using errcode='P0002';
  end if;

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
      when 'wrong_person' then 'invalid_contact'
      when 'not_interested' then 'lost'
      when 'human_assistance' then 'connected'
      else 'connected'
    end;
  end if;

  v_note := left(nullif(btrim(coalesce(p_call_summary,'')),''),4000);

  update public.external_renewal_voice_attempts
  set provider_attempt_id=coalesce(nullif(btrim(coalesce(p_provider_attempt_id,'')),''),provider_attempt_id),
      provider_interaction_id=coalesce(nullif(btrim(coalesce(p_provider_interaction_id,'')),''),provider_interaction_id),
      provider_campaign_id=coalesce(nullif(btrim(coalesce(p_provider_campaign_id,'')),''),provider_campaign_id),
      provider_cohort_id=coalesce(nullif(btrim(coalesce(p_provider_cohort_id,'')),''),provider_cohort_id),
      submission_status=case when p_completion_status='failed' and p_connectivity_status<>'connected' then 'failed' else 'completed' end,
      connectivity_status=p_connectivity_status,
      completion_status=p_completion_status,
      retry_attempt=greatest(coalesce(p_retry_attempt,0),0),
      duration_seconds=case when p_duration_seconds is null then null else greatest(p_duration_seconds,0) end,
      started_at=coalesce(p_started_at,started_at),
      ended_at=coalesce(p_ended_at,ended_at,now()),
      call_disposition=p_call_disposition,
      customer_interest=p_customer_interest,
      follow_up_required=p_follow_up_required,
      follow_up_at=v_effective_follow_up,
      customer_objection=left(nullif(btrim(coalesce(p_customer_objection,'')),''),1000),
      call_summary=left(nullif(btrim(coalesce(p_call_summary,'')),''),2000),
      updated_at=now()
  where id=v_attempt.id;

  if v_outcome is not null
     and v_opportunity_status not in ('won','renewed_elsewhere','invalid_contact','do_not_contact','lost') then
    insert into public.external_renewal_interactions (
      opportunity_id,
      partner_id,
      interaction_type,
      outcome,
      note,
      follow_up_at,
      created_by_auth_user_id
    ) values (
      v_attempt.opportunity_id,
      v_attempt.partner_id,
      v_interaction_type,
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

  return jsonb_build_object(
    'attempt_id',v_attempt.id,
    'status',case when p_completion_status='failed' and p_connectivity_status<>'connected' then 'failed' else 'completed' end,
    'crm_outcome',v_outcome,
    'changed',true
  );
end;
$$;

revoke all on function public.apply_external_renewal_voice_result(uuid,text,text,text,text,text,text,integer,numeric,timestamptz,timestamptz,text,text,boolean,timestamptz,text,text) from public, anon, authenticated;
grant execute on function public.apply_external_renewal_voice_result(uuid,text,text,text,text,text,text,integer,numeric,timestamptz,timestamptz,text,text,boolean,timestamptz,text,text) to service_role;

commit;
