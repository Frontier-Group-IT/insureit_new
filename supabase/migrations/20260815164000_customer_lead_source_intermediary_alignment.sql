-- Preserve the existing meaning of customers.assigned_agent_id (internal profile assignment)
-- while recording the POSP / MISP / Partner / Corporate intermediary that originated
-- the customer's policy relationship.

alter table public.customers
  add column if not exists lead_source_intermediary_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'customers'
      and c.conname = 'customers_lead_source_intermediary_id_fkey'
  ) then
    alter table public.customers
      add constraint customers_lead_source_intermediary_id_fkey
      foreign key (lead_source_intermediary_id)
      references public.intermediaries(id)
      on delete set null;
  end if;
end
$$;

create index if not exists customers_lead_source_intermediary_id_idx
  on public.customers(lead_source_intermediary_id);

comment on column public.customers.assigned_agent_id is
  'Internal portal/profile assignment. This field references profiles(id) and must not store POSP, MISP, Partner or Corporate intermediary IDs.';

comment on column public.customers.lead_source_intermediary_id is
  'Canonical intermediary lead source for the customer, derived from the earliest policy source when resolvable. Full intermediary relationship history remains in intermediary_customer_links.';

-- Backfill the canonical customer source from the earliest policy only.
-- Prefer the stable intermediary code. Legacy rows without a code are resolved only
-- when lead_source exactly matches one and only one intermediary display name.
with policy_resolution as (
  select
    p.id as policy_id,
    p.customer_id,
    p.created_at,
    coalesce(code_match.id, name_match.id) as intermediary_id
  from public.policies p
  left join lateral (
    select i.id
    from public.intermediaries i
    where p.intermediary_code is not null
      and btrim(p.intermediary_code) <> ''
      and i.intermediary_code = p.intermediary_code
    order by (i.account_status = 'active') desc, i.updated_at desc, i.id
    limit 1
  ) code_match on true
  left join lateral (
    select i.id
    from public.intermediaries i
    where (p.intermediary_code is null or btrim(p.intermediary_code) = '')
      and p.lead_source is not null
      and btrim(p.lead_source) <> ''
      and lower(btrim(coalesce(p.intermediary_type, ''))) not in ('direct', 'sibl / direct')
      and lower(btrim(i.display_name)) = lower(btrim(p.lead_source))
      and not exists (
        select 1
        from public.intermediaries duplicate_i
        where duplicate_i.id <> i.id
          and lower(btrim(duplicate_i.display_name)) = lower(btrim(p.lead_source))
      )
    order by (i.account_status = 'active') desc, i.updated_at desc, i.id
    limit 1
  ) name_match on true
), first_policy as (
  select distinct on (customer_id)
    customer_id,
    intermediary_id
  from policy_resolution
  order by customer_id, created_at asc nulls last, policy_id asc
)
update public.customers c
set lead_source_intermediary_id = fp.intermediary_id,
    updated_at = now()
from first_policy fp
where c.id = fp.customer_id
  and c.lead_source_intermediary_id is null
  and fp.intermediary_id is not null;

-- Reconcile the durable intermediary/customer relationship history for every policy
-- with an unambiguous source. This is idempotent and does not create commission rows.
with policy_resolution as (
  select
    p.customer_id,
    p.created_at,
    coalesce(code_match.id, name_match.id) as intermediary_id
  from public.policies p
  left join lateral (
    select i.id
    from public.intermediaries i
    where p.intermediary_code is not null
      and btrim(p.intermediary_code) <> ''
      and i.intermediary_code = p.intermediary_code
    order by (i.account_status = 'active') desc, i.updated_at desc, i.id
    limit 1
  ) code_match on true
  left join lateral (
    select i.id
    from public.intermediaries i
    where (p.intermediary_code is null or btrim(p.intermediary_code) = '')
      and p.lead_source is not null
      and btrim(p.lead_source) <> ''
      and lower(btrim(coalesce(p.intermediary_type, ''))) not in ('direct', 'sibl / direct')
      and lower(btrim(i.display_name)) = lower(btrim(p.lead_source))
      and not exists (
        select 1
        from public.intermediaries duplicate_i
        where duplicate_i.id <> i.id
          and lower(btrim(duplicate_i.display_name)) = lower(btrim(p.lead_source))
      )
    order by (i.account_status = 'active') desc, i.updated_at desc, i.id
    limit 1
  ) name_match on true
)
insert into public.intermediary_customer_links (
  intermediary_id,
  customer_id,
  relationship_type,
  created_at
)
select
  intermediary_id,
  customer_id,
  'referred_customer',
  min(coalesce(created_at, now()))
from policy_resolution
where intermediary_id is not null
group by intermediary_id, customer_id
on conflict (intermediary_id, customer_id, relationship_type) do nothing;

-- Future policy onboarding: keep the existing relationship/referral behavior and also
-- stamp the customer-level lead source when the first policy has an intermediary.
create or replace function public.sync_policy_customer_intermediary_assignment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_intermediary_id uuid;
begin
  update public.customers c
  set partner_type = 'individual_proprietor',
      updated_at = now()
  where c.id = new.customer_id
    and c.partner_type is null;

  if new.intermediary_code is not null and btrim(new.intermediary_code) <> '' then
    select i.id
      into v_intermediary_id
    from public.intermediaries i
    where i.intermediary_code = new.intermediary_code
    order by (i.account_status = 'active') desc, i.updated_at desc, i.id
    limit 1;
  elsif new.lead_source is not null
    and btrim(new.lead_source) <> ''
    and lower(btrim(coalesce(new.intermediary_type, ''))) not in ('direct', 'sibl / direct') then
    select i.id
      into v_intermediary_id
    from public.intermediaries i
    where lower(btrim(i.display_name)) = lower(btrim(new.lead_source))
      and not exists (
        select 1
        from public.intermediaries duplicate_i
        where duplicate_i.id <> i.id
          and lower(btrim(duplicate_i.display_name)) = lower(btrim(new.lead_source))
      )
    order by (i.account_status = 'active') desc, i.updated_at desc, i.id
    limit 1;
  end if;

  if v_intermediary_id is null then
    return new;
  end if;

  update public.customers c
  set lead_source_intermediary_id = v_intermediary_id,
      updated_at = now()
  where c.id = new.customer_id
    and c.lead_source_intermediary_id is null
    and new.id = (
      select first_policy.id
      from public.policies first_policy
      where first_policy.customer_id = new.customer_id
      order by first_policy.created_at asc nulls last, first_policy.id asc
      limit 1
    );

  insert into public.intermediary_customer_links (
    intermediary_id,
    customer_id,
    relationship_type,
    created_at
  ) values (
    v_intermediary_id,
    new.customer_id,
    'referred_customer',
    coalesce(new.created_at, now())
  )
  on conflict (intermediary_id, customer_id, relationship_type) do nothing;

  if not exists (
    select 1
    from public.intermediary_referrals r
    where r.intermediary_id = v_intermediary_id
      and r.customer_id = new.customer_id
      and r.policy_id = new.id
  ) then
    insert into public.intermediary_referrals (
      intermediary_id,
      customer_id,
      policy_id,
      source_label,
      commission_eligible,
      referred_at,
      assigned_employee_id,
      created_by,
      created_at
    ) values (
      v_intermediary_id,
      new.customer_id,
      new.id,
      'Policy onboarding',
      true,
      coalesce(new.created_at, now()),
      null,
      new.created_by,
      coalesce(new.created_at, now())
    );
  end if;

  return new;
end;
$$;

-- Read-only hierarchy bridge. It deliberately does not replace can_access_customer(),
-- because that function is also used by some UPDATE/DELETE policies. Keeping this
-- separate prevents intermediary-derived visibility from silently broadening write access.
create or replace function public.can_view_customer_via_intermediary(
  viewer_id uuid,
  target_customer_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  with downline_profiles as (
    select profile_id
    from public.get_user_downline(viewer_id)
  ), downline_employees as (
    select p.employee_id
    from public.profiles p
    join downline_profiles d on d.profile_id = p.id
    where p.employee_id is not null
  )
  select
    viewer_id is not null
    and target_customer_id is not null
    and exists (
      select 1
      from public.intermediary_customer_links link
      join public.intermediaries i on i.id = link.intermediary_id
      where link.customer_id = target_customer_id
        and link.relationship_type = 'referred_customer'
        and (
          i.associate_profile_id in (select profile_id from downline_profiles)
          or i.associate_employee_id in (select employee_id from downline_employees)
        )
    );
$$;

revoke all on function public.can_view_customer_via_intermediary(uuid, uuid) from public;
grant execute on function public.can_view_customer_via_intermediary(uuid, uuid) to authenticated;

-- Additive SELECT-only policies keep existing write authority unchanged.
drop policy if exists "customers intermediary hierarchy read" on public.customers;
create policy "customers intermediary hierarchy read"
on public.customers
for select
to authenticated
using (public.can_view_customer_via_intermediary(auth.uid(), id));

drop policy if exists "vehicles intermediary hierarchy read" on public.vehicles;
create policy "vehicles intermediary hierarchy read"
on public.vehicles
for select
to authenticated
using (public.can_view_customer_via_intermediary(auth.uid(), customer_id));

drop policy if exists "policies intermediary hierarchy read" on public.policies;
create policy "policies intermediary hierarchy read"
on public.policies
for select
to authenticated
using (public.can_view_customer_via_intermediary(auth.uid(), customer_id));
