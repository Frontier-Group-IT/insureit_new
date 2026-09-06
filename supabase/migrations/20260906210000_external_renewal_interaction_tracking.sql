begin;

alter table public.external_renewal_opportunities
  add column if not exists last_interaction_at timestamptz,
  add column if not exists next_follow_up_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'external_renewal_opportunity_id_partner_key'
      and conrelid = 'public.external_renewal_opportunities'::regclass
  ) then
    alter table public.external_renewal_opportunities
      add constraint external_renewal_opportunity_id_partner_key unique (id, partner_id);
  end if;
end;
$$;

create table if not exists public.external_renewal_interactions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null,
  partner_id uuid not null references public.partners(id) on delete restrict,
  interaction_type text not null check (interaction_type in ('call','whatsapp','note','follow_up')),
  outcome text not null check (outcome in ('contact_attempted','connected','interested','quote_requested','quote_shared','follow_up','renewed_elsewhere','invalid_contact','do_not_contact','lost')),
  note text,
  follow_up_at timestamptz,
  created_by_auth_user_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (opportunity_id, partner_id)
    references public.external_renewal_opportunities(id, partner_id)
    on delete cascade,
  check (note is null or char_length(note) <= 4000),
  check (outcome <> 'follow_up' or follow_up_at is not null)
);

comment on table public.external_renewal_interactions is
  'Partner interaction history for isolated external renewal opportunities only. It does not write to verified INSUREIT customer, vehicle, policy or activity tables.';

create index if not exists external_renewal_interactions_opportunity_created_idx
  on public.external_renewal_interactions(opportunity_id, created_at desc);

create index if not exists external_renewal_follow_up_idx
  on public.external_renewal_opportunities(partner_id, next_follow_up_at)
  where is_active and next_follow_up_at is not null;

alter table public.external_renewal_interactions enable row level security;
revoke all on public.external_renewal_interactions from public, anon, authenticated;
grant all on public.external_renewal_interactions to service_role;

create or replace function public.partner_app_external_renewal_detail(p_opportunity_id uuid)
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
  if v_scope is null or coalesce(v_scope->>'scope_mode','none') = 'none' then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  select jsonb_build_object(
    'opportunity', jsonb_build_object(
      'opportunity_id', o.id,
      'source_name', b.source_name,
      'account_name', o.account_name,
      'customer_name', o.customer_name,
      'contact_name', o.contact_name,
      'mobile', o.mobile,
      'chassis_no', o.chassis_no,
      'registration_no', o.registration_no,
      'vehicle_make', o.vehicle_make,
      'vehicle_model', o.vehicle_model,
      'vehicle_lob', o.vehicle_lob,
      'invoice_date', o.invoice_date,
      'policy_start_date', o.policy_start_date,
      'policy_end_date', o.policy_end_date,
      'current_insurer', o.current_insurer,
      'current_policy_no', o.current_policy_no,
      'opportunity_status', o.opportunity_status,
      'last_interaction_at', o.last_interaction_at,
      'next_follow_up_at', o.next_follow_up_at
    ),
    'interactions', coalesce((
      select jsonb_agg(jsonb_build_object(
        'interaction_id', i.id,
        'interaction_type', i.interaction_type,
        'outcome', i.outcome,
        'note', i.note,
        'follow_up_at', i.follow_up_at,
        'created_at', i.created_at
      ) order by i.created_at desc)
      from public.external_renewal_interactions i
      where i.opportunity_id=o.id and i.partner_id=o.partner_id
    ), '[]'::jsonb)
  )
  into v_result
  from public.external_renewal_opportunities o
  join public.external_renewal_import_batches b on b.id=o.batch_id
  where o.id=p_opportunity_id
    and o.partner_id=any(v_partner_ids)
    and b.status='published'
    and o.is_active;

  if v_result is null then
    raise exception 'External renewal opportunity is unavailable' using errcode='P0002';
  end if;

  return v_result;
end;
$$;

revoke all on function public.partner_app_external_renewal_detail(uuid) from public, anon;
grant execute on function public.partner_app_external_renewal_detail(uuid) to authenticated, service_role;

create or replace function public.partner_app_record_external_renewal_interaction(
  p_opportunity_id uuid,
  p_interaction_type text,
  p_outcome text,
  p_note text default null,
  p_follow_up_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_partner_ids uuid[] := array[]::uuid[];
  v_partner_id uuid;
  v_status text;
  v_note text := nullif(btrim(coalesce(p_note,'')),'');
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  if p_interaction_type not in ('call','whatsapp','note','follow_up') then
    raise exception 'Invalid interaction type';
  end if;

  if p_outcome not in ('contact_attempted','connected','interested','quote_requested','quote_shared','follow_up','renewed_elsewhere','invalid_contact','do_not_contact','lost') then
    raise exception 'Invalid interaction outcome';
  end if;

  if v_note is not null and char_length(v_note) > 4000 then
    raise exception 'Interaction note is too long';
  end if;

  if p_outcome='follow_up' and p_follow_up_at is null then
    raise exception 'Follow-up date is required';
  end if;

  if p_follow_up_at is not null and p_follow_up_at < now() - interval '5 minutes' then
    raise exception 'Follow-up date cannot be in the past';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none') = 'none' then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  select o.partner_id
  into v_partner_id
  from public.external_renewal_opportunities o
  join public.external_renewal_import_batches b on b.id=o.batch_id
  where o.id=p_opportunity_id
    and o.partner_id=any(v_partner_ids)
    and b.status='published'
    and o.is_active
  for update;

  if v_partner_id is null then
    raise exception 'External renewal opportunity is unavailable' using errcode='P0002';
  end if;

  v_status := case p_outcome
    when 'contact_attempted' then 'contact_attempted'
    when 'connected' then 'connected'
    when 'interested' then 'interested'
    when 'quote_requested' then 'quote_requested'
    when 'quote_shared' then 'quote_shared'
    when 'follow_up' then 'follow_up'
    when 'renewed_elsewhere' then 'renewed_elsewhere'
    when 'invalid_contact' then 'invalid_contact'
    when 'do_not_contact' then 'do_not_contact'
    when 'lost' then 'lost'
    else 'new'
  end;

  insert into public.external_renewal_interactions (
    opportunity_id, partner_id, interaction_type, outcome, note, follow_up_at, created_by_auth_user_id
  ) values (
    p_opportunity_id, v_partner_id, p_interaction_type, p_outcome, v_note, p_follow_up_at, auth.uid()
  );

  update public.external_renewal_opportunities
  set opportunity_status=v_status,
      last_interaction_at=now(),
      next_follow_up_at=p_follow_up_at,
      updated_at=now()
  where id=p_opportunity_id and partner_id=v_partner_id;

  return public.partner_app_external_renewal_detail(p_opportunity_id);
end;
$$;

revoke all on function public.partner_app_record_external_renewal_interaction(uuid,text,text,text,timestamptz) from public, anon;
grant execute on function public.partner_app_record_external_renewal_interaction(uuid,text,text,text,timestamptz) to authenticated, service_role;

commit;
