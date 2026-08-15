-- Policy onboarding must allow the same vehicle to carry policy history and future renewals.
-- Only overlapping coverage components are blocked. Complementary TP + SAOD coverage can coexist.

create or replace function public.policy_coverage_components(p_policy_type text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case
    when lower(btrim(coalesce(p_policy_type, ''))) in ('saod', 'standalone own damage')
      or lower(coalesce(p_policy_type, '')) like '%standalone%own%damage%'
      or lower(coalesce(p_policy_type, '')) like '%own damage only%'
      then array['OD']::text[]
    when lower(btrim(coalesce(p_policy_type, ''))) in ('third party', 'long term third party')
      or lower(coalesce(p_policy_type, '')) like '%third party%'
      or lower(coalesce(p_policy_type, '')) like '%third-party%'
      or lower(coalesce(p_policy_type, '')) like '%liability only%'
      then array['TP']::text[]
    else array['OD','TP']::text[]
  end;
$$;

create or replace function public.enforce_single_active_policy_per_vehicle()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new_coverage text[];
  v_conflict record;
begin
  if new.vehicle_id is null or new.start_date is null or new.end_date is null then
    return new;
  end if;

  v_new_coverage := public.policy_coverage_components(new.policy_type);

  select conflict_source, conflict_id, conflict_policy_no, conflict_policy_type, conflict_start_date, conflict_end_date
  into v_conflict
  from (
    select
      'managed'::text as conflict_source,
      p.id as conflict_id,
      p.policy_no as conflict_policy_no,
      p.policy_type as conflict_policy_type,
      p.start_date as conflict_start_date,
      p.end_date as conflict_end_date
    from public.policies p
    where p.vehicle_id = new.vehicle_id
      and lower(coalesce(p.status, 'active')) not in ('cancelled', 'canceled', 'rejected', 'superseded', 'void')
      and new.start_date <= p.end_date
      and new.end_date >= p.start_date
      and public.policy_coverage_components(p.policy_type) && v_new_coverage
      and (tg_table_name <> 'policies' or p.id <> new.id)

    union all

    select
      'external'::text as conflict_source,
      ep.id as conflict_id,
      ep.policy_no as conflict_policy_no,
      ep.policy_type as conflict_policy_type,
      ep.start_date as conflict_start_date,
      ep.end_date as conflict_end_date
    from public.external_policies ep
    where ep.vehicle_id = new.vehicle_id
      and new.start_date <= ep.end_date
      and new.end_date >= ep.start_date
      and public.policy_coverage_components(ep.policy_type) && v_new_coverage
      and (tg_table_name <> 'external_policies' or ep.id <> new.id)
  ) conflicts
  order by conflict_end_date desc
  limit 1;

  if found then
    raise exception 'POLICY_COVERAGE_OVERLAP:%:%:%:%:%:%',
      v_conflict.conflict_source,
      v_conflict.conflict_id,
      coalesce(v_conflict.conflict_policy_no, ''),
      coalesce(v_conflict.conflict_policy_type, ''),
      v_conflict.conflict_start_date,
      v_conflict.conflict_end_date
      using errcode = '23505';
  end if;

  return new;
end;
$$;

comment on function public.policy_coverage_components(text) is
  'Maps motor policy products to OD/TP coverage components for overlap validation. Unknown products are treated conservatively as OD+TP.';

comment on function public.enforce_single_active_policy_per_vehicle() is
  'Allows expired/history and future renewals on the same vehicle; blocks only overlapping policy periods that share OD or TP coverage.';
