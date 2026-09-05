begin;

create table if not exists public.external_renewal_import_batches (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners(id) on delete restrict,
  source_name text not null,
  source_file_name text,
  source_period text,
  status text not null default 'draft' check (status in ('draft','validated','published','archived')),
  total_rows integer not null default 0 check (total_rows >= 0),
  accepted_rows integer not null default 0 check (accepted_rows >= 0),
  rejected_rows integer not null default 0 check (rejected_rows >= 0),
  duplicate_rows integer not null default 0 check (duplicate_rows >= 0),
  imported_by uuid,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, partner_id)
);

comment on table public.external_renewal_import_batches is
  'Isolated source batches for external renewal opportunities. These rows are not verified INSUREIT customer, vehicle or policy business.';

create table if not exists public.external_renewal_opportunities (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null,
  partner_id uuid not null references public.partners(id) on delete restrict,
  source_row_number integer,
  account_name text,
  customer_name text,
  contact_name text,
  mobile text,
  address text,
  city text,
  state text,
  postal_code text,
  chassis_no text,
  registration_no text,
  vehicle_make text,
  vehicle_model text,
  vehicle_lob text,
  invoice_date date not null,
  policy_start_date date generated always as (invoice_date) stored,
  policy_end_date date generated always as ((invoice_date + interval '1 year')::date) stored,
  current_insurer text,
  current_policy_no text,
  opportunity_status text not null default 'new' check (
    opportunity_status in ('new','contact_attempted','connected','interested','quote_requested','quote_shared','follow_up','won','lost','invalid_contact','do_not_contact','renewed_elsewhere','duplicate')
  ),
  is_active boolean not null default true,
  source_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (batch_id, partner_id) references public.external_renewal_import_batches(id, partner_id) on delete cascade,
  check (nullif(btrim(coalesce(chassis_no,'')),'') is not null or nullif(btrim(coalesce(registration_no,'')),'') is not null)
);

comment on table public.external_renewal_opportunities is
  'Opportunity-only external renewal snapshots. Never counted as verified INSUREIT customer, vehicle, policy, premium or business until converted through normal verified onboarding.';
comment on column public.external_renewal_opportunities.policy_start_date is
  'Derived source assumption approved for this workflow: policy start date equals vehicle invoice date.';
comment on column public.external_renewal_opportunities.policy_end_date is
  'Derived as one calendar year after invoice date; PostgreSQL calendar arithmetic maps leap-day starts deterministically.';

create unique index if not exists external_renewal_opportunity_business_key_uidx
  on public.external_renewal_opportunities (
    partner_id,
    coalesce(nullif(upper(btrim(chassis_no)),''), 'REG:' || upper(btrim(registration_no))),
    invoice_date
  );

create index if not exists external_renewal_opportunity_partner_expiry_idx
  on public.external_renewal_opportunities(partner_id, policy_end_date)
  where is_active;

create index if not exists external_renewal_opportunity_batch_idx
  on public.external_renewal_opportunities(batch_id);

alter table public.external_renewal_import_batches enable row level security;
alter table public.external_renewal_opportunities enable row level security;

revoke all on public.external_renewal_import_batches from public, anon, authenticated;
revoke all on public.external_renewal_opportunities from public, anon, authenticated;
grant all on public.external_renewal_import_batches to service_role;
grant all on public.external_renewal_opportunities to service_role;

create or replace function public.partner_app_external_renewal_summary()
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
  v_scope := public.partner_app_commercial_scope();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none') = 'none' then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  select jsonb_build_object(
    'due_0_7_count', count(*) filter (where o.policy_end_date between current_date and current_date + 7),
    'due_8_15_count', count(*) filter (where o.policy_end_date between current_date + 8 and current_date + 15),
    'due_16_30_count', count(*) filter (where o.policy_end_date between current_date + 16 and current_date + 30),
    'due_30_count', count(*) filter (where o.policy_end_date between current_date and current_date + 30),
    'expired_30_count', count(*) filter (where o.policy_end_date between current_date - 30 and current_date - 1),
    'total_active_count', count(*)
  )
  into v_result
  from public.external_renewal_opportunities o
  join public.external_renewal_import_batches b on b.id=o.batch_id
  where o.partner_id=any(v_partner_ids)
    and b.status='published'
    and o.is_active
    and o.opportunity_status not in ('duplicate','do_not_contact');

  return coalesce(v_result, jsonb_build_object(
    'due_0_7_count',0,
    'due_8_15_count',0,
    'due_16_30_count',0,
    'due_30_count',0,
    'expired_30_count',0,
    'total_active_count',0
  ));
end;
$$;

revoke all on function public.partner_app_external_renewal_summary() from public, anon;
grant execute on function public.partner_app_external_renewal_summary() to authenticated, service_role;

create or replace function public.partner_app_list_external_renewals(
  p_limit integer default 25,
  p_offset integer default 0,
  p_search text default null,
  p_mode text default 'due',
  p_window text default 'all'
)
returns table (
  opportunity_id uuid,
  batch_id uuid,
  source_name text,
  account_name text,
  customer_name text,
  contact_name text,
  mobile text,
  chassis_no text,
  registration_no text,
  vehicle_make text,
  vehicle_model text,
  vehicle_lob text,
  invoice_date date,
  policy_start_date date,
  policy_end_date date,
  current_insurer text,
  current_policy_no text,
  opportunity_status text,
  days_to_expiry integer,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_scope jsonb;
  v_partner_ids uuid[] := array[]::uuid[];
  v_limit integer := greatest(1,least(coalesce(p_limit,25),100));
  v_offset integer := greatest(0,least(coalesce(p_offset,0),100000));
  v_search text := nullif(btrim(coalesce(p_search,'')),'');
  v_mode text := lower(coalesce(nullif(btrim(p_mode),''),'due'));
  v_window text := lower(coalesce(nullif(btrim(p_window),''),'all'));
begin
  if v_mode not in ('due','expired','future') then
    raise exception 'Invalid external renewal mode';
  end if;

  if v_window not in ('all','0_7','8_15','16_30') then
    raise exception 'Invalid external renewal window';
  end if;

  if v_mode <> 'due' then
    v_window := 'all';
  end if;

  v_scope := public.partner_app_commercial_scope();
  if v_scope is null or coalesce(v_scope->>'scope_mode','none') = 'none' then
    raise exception 'INSUREIT Partner access is unavailable' using errcode='28000';
  end if;

  select coalesce(array_agg(value::uuid),array[]::uuid[])
  into v_partner_ids
  from jsonb_array_elements_text(coalesce(v_scope->'partner_ids','[]'::jsonb)) value;

  return query
  with filtered as (
    select
      o.id as opportunity_id,
      o.batch_id,
      b.source_name,
      o.account_name,
      o.customer_name,
      o.contact_name,
      o.mobile,
      o.chassis_no,
      o.registration_no,
      o.vehicle_make,
      o.vehicle_model,
      o.vehicle_lob,
      o.invoice_date,
      o.policy_start_date,
      o.policy_end_date,
      o.current_insurer,
      o.current_policy_no,
      o.opportunity_status,
      (o.policy_end_date-current_date)::integer as days_to_expiry,
      o.created_at
    from public.external_renewal_opportunities o
    join public.external_renewal_import_batches b on b.id=o.batch_id
    where o.partner_id=any(v_partner_ids)
      and b.status='published'
      and o.is_active
      and o.opportunity_status not in ('duplicate','do_not_contact')
      and (
        (v_mode='due' and o.policy_end_date between current_date and current_date+30 and (
          v_window='all'
          or (v_window='0_7' and o.policy_end_date between current_date and current_date+7)
          or (v_window='8_15' and o.policy_end_date between current_date+8 and current_date+15)
          or (v_window='16_30' and o.policy_end_date between current_date+16 and current_date+30)
        ))
        or (v_mode='expired' and o.policy_end_date between current_date-30 and current_date-1)
        or (v_mode='future' and o.policy_end_date>current_date+30)
      )
      and (
        v_search is null
        or o.account_name ilike '%'||v_search||'%'
        or o.customer_name ilike '%'||v_search||'%'
        or o.contact_name ilike '%'||v_search||'%'
        or o.mobile ilike '%'||v_search||'%'
        or o.chassis_no ilike '%'||v_search||'%'
        or o.registration_no ilike '%'||v_search||'%'
        or o.vehicle_model ilike '%'||v_search||'%'
        or o.current_insurer ilike '%'||v_search||'%'
        or o.current_policy_no ilike '%'||v_search||'%'
      )
  )
  select
    f.opportunity_id,
    f.batch_id,
    f.source_name,
    f.account_name,
    f.customer_name,
    f.contact_name,
    f.mobile,
    f.chassis_no,
    f.registration_no,
    f.vehicle_make,
    f.vehicle_model,
    f.vehicle_lob,
    f.invoice_date,
    f.policy_start_date,
    f.policy_end_date,
    f.current_insurer,
    f.current_policy_no,
    f.opportunity_status,
    f.days_to_expiry,
    count(*) over() as total_count
  from filtered f
  order by
    case when v_mode='expired' then f.policy_end_date end desc,
    case when v_mode in ('due','future') then f.policy_end_date end asc,
    f.created_at desc
  limit v_limit offset v_offset;
end;
$$;

revoke all on function public.partner_app_list_external_renewals(integer,integer,text,text,text) from public, anon;
grant execute on function public.partner_app_list_external_renewals(integer,integer,text,text,text) to authenticated, service_role;

commit;
