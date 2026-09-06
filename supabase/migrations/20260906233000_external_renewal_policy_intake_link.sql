begin;

create table if not exists public.external_renewal_policy_intake_links (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null,
  partner_id uuid not null references public.partners(id) on delete restrict,
  intake_id uuid not null references public.policy_intake_requests(id) on delete cascade,
  created_by_auth_user_id uuid not null,
  created_at timestamptz not null default now(),
  foreign key (opportunity_id, partner_id)
    references public.external_renewal_opportunities(id, partner_id)
    on delete cascade,
  unique (opportunity_id),
  unique (intake_id)
);

comment on table public.external_renewal_policy_intake_links is
  'Isolated conversion link from an external renewal opportunity to a normal Partner Policy Intake. It does not create or modify verified customer, vehicle or policy records.';

create index if not exists external_renewal_policy_intake_links_partner_idx
  on public.external_renewal_policy_intake_links(partner_id, created_at desc);

alter table public.external_renewal_policy_intake_links enable row level security;
revoke all on public.external_renewal_policy_intake_links from public, anon, authenticated;
grant all on public.external_renewal_policy_intake_links to service_role;

create or replace function public.partner_app_link_external_renewal_policy_intake(
  p_opportunity_id uuid,
  p_intake_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_identity jsonb;
  v_partner_ids uuid[] := array[]::uuid[];
  v_partner_id uuid;
  v_status text;
  v_existing uuid;
  v_owned boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;
  if p_opportunity_id is null or p_intake_id is null then
    raise exception 'Opportunity and Policy Intake are required';
  end if;

  v_scope := public.partner_app_commercial_scope();
  v_identity := public.partner_app_current_identity();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none')='none' or v_identity is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  select o.partner_id, o.opportunity_status
  into v_partner_id, v_status
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

  if v_status not in ('connected','interested','quote_requested','quote_shared','follow_up') then
    raise exception 'Record customer interest before starting Policy Intake';
  end if;

  if coalesce(v_identity->>'actor_kind','')='employee' then
    select exists(
      select 1 from public.policy_intake_requests r
      where r.id=p_intake_id
        and r.submitted_by_profile_id=(v_identity->>'profile_id')::uuid
    ) into v_owned;
  elsif coalesce(v_identity->>'actor_kind','')='intermediary' then
    select exists(
      select 1 from public.policy_intake_requests r
      where r.id=p_intake_id
        and r.submitted_by_portal_account_id=(v_identity->>'portal_account_id')::uuid
    ) into v_owned;
  end if;

  if not v_owned then
    raise exception 'Policy Intake is unavailable in this Partner account' using errcode='P0002';
  end if;

  select l.intake_id into v_existing
  from public.external_renewal_policy_intake_links l
  where l.opportunity_id=p_opportunity_id;

  if v_existing is not null and v_existing<>p_intake_id then
    raise exception 'This opportunity already has a Policy Intake';
  end if;

  insert into public.external_renewal_policy_intake_links (
    opportunity_id, partner_id, intake_id, created_by_auth_user_id
  ) values (
    p_opportunity_id, v_partner_id, p_intake_id, auth.uid()
  )
  on conflict (opportunity_id) do nothing;

  return jsonb_build_object(
    'opportunity_id', p_opportunity_id,
    'intake_id', p_intake_id,
    'linked', true
  );
end;
$$;

revoke all on function public.partner_app_link_external_renewal_policy_intake(uuid,uuid) from public, anon;
grant execute on function public.partner_app_link_external_renewal_policy_intake(uuid,uuid) to authenticated, service_role;

create or replace function public.partner_app_external_renewal_intake_link(p_opportunity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_identity jsonb;
  v_partner_ids uuid[] := array[]::uuid[];
  v_result jsonb;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode='28000';
  end if;

  v_scope := public.partner_app_commercial_scope();
  v_identity := public.partner_app_current_identity();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none')='none' or v_identity is null then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  select jsonb_build_object(
    'intake_id', r.id,
    'intake_number', r.intake_number,
    'status', r.status,
    'final_policy_id', r.final_policy_id
  )
  into v_result
  from public.external_renewal_policy_intake_links l
  join public.policy_intake_requests r on r.id=l.intake_id
  where l.opportunity_id=p_opportunity_id
    and l.partner_id=any(v_partner_ids)
    and (
      (coalesce(v_identity->>'actor_kind','')='employee' and r.submitted_by_profile_id=(v_identity->>'profile_id')::uuid)
      or
      (coalesce(v_identity->>'actor_kind','')='intermediary' and r.submitted_by_portal_account_id=(v_identity->>'portal_account_id')::uuid)
    );

  return v_result;
end;
$$;

revoke all on function public.partner_app_external_renewal_intake_link(uuid) from public, anon;
grant execute on function public.partner_app_external_renewal_intake_link(uuid) to authenticated, service_role;

commit;
