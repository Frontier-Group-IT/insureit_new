begin;

do $$
begin
  if to_regclass('public.partner_code_format_migration_20260916_backup') is null then
    raise exception 'Partner code rollback aborted: migration backup table is missing.';
  end if;
end
$$;

create temp table partner_code_rollback_map on commit drop as
with meta as (
  select sequence_at_apply, applied_at
  from public.partner_code_format_migration_20260916_backup
  where record_type = 'meta'
  order by backup_id
  limit 1
),
backfilled as (
  select partner_id, old_code, new_code
  from public.partner_code_format_migration_20260916_backup
  where record_type = 'backfill'
),
generated_after as (
  select
    p.id as partner_id,
    'PART-' || to_char(p.created_at, 'YYYY') || '-' || right(p.partner_code, 5) as old_code,
    p.partner_code as new_code
  from public.partners p
  cross join meta m
  left join public.intermediary_onboarding_applications a on a.id = p.source_application_id
  where p.partner_code ~ '^PT[0-9]{5}$'
    and right(p.partner_code, 5)::bigint > m.sequence_at_apply
    and p.created_at >= m.applied_at
    and not exists (
      select 1 from backfilled b where b.partner_id = p.id
    )
    and coalesce(a.source, '') <> 'legacy_manual'
    and coalesce(a.draft_data ->> 'onboarding_mode', '') <> 'legacy_existing_partner'
    and coalesce(a.draft_data ->> 'record_source', '') not in ('legacy_manual', 'legacy_manual_pending_activation')
)
select * from backfilled
union all
select * from generated_after;

do $$
begin
  if exists (
    select 1
    from partner_code_rollback_map m
    group by m.old_code
    having count(*) > 1
  ) then
    raise exception 'Partner code rollback aborted: two PT codes would restore to the same PART code.';
  end if;

  if exists (
    select 1
    from partner_code_rollback_map m
    join public.partners p
      on upper(p.partner_code) = upper(m.old_code)
     and p.id <> m.partner_id
  ) then
    raise exception 'Partner code rollback aborted: restored PART code already exists in partners.';
  end if;

  if exists (
    select 1
    from partner_code_rollback_map m
    join public.intermediaries i on upper(i.intermediary_code) = upper(m.old_code)
  ) then
    raise exception 'Partner code rollback aborted: restored PART code already exists in intermediaries.';
  end if;

  if exists (
    select 1
    from partner_code_rollback_map m
    join public.policies p on upper(coalesce(p.intermediary_code, '')) = upper(m.old_code)
  ) then
    raise exception 'Partner code rollback aborted: restored PART code already exists on a policy.';
  end if;

  if exists (
    select 1
    from partner_code_rollback_map m
    join public.policy_intermediary_payouts p on upper(coalesce(p.intermediary_code, '')) = upper(m.old_code)
  ) then
    raise exception 'Partner code rollback aborted: restored PART code already exists on a policy payout.';
  end if;

  if exists (
    select 1
    from partner_code_rollback_map m
    join public.partner_payables p on upper(coalesce(p.intermediary_code, '')) = upper(m.old_code)
  ) then
    raise exception 'Partner code rollback aborted: restored PART code already exists on a payable.';
  end if;

  if exists (
    select 1
    from partner_code_rollback_map m
    join public.partner_payments p on upper(coalesce(p.intermediary_code, '')) = upper(m.old_code)
  ) then
    raise exception 'Partner code rollback aborted: restored PART code already exists on a payment.';
  end if;
end
$$;

update public.posp_misp_onboarding_profiles p
set partner_id = m.old_code
from partner_code_rollback_map m
where upper(btrim(coalesce(p.partner_id, ''))) = upper(m.new_code);

update public.intermediaries i
set intermediary_code = m.old_code
from partner_code_rollback_map m
where upper(btrim(i.intermediary_code)) = upper(m.new_code);

update public.policies p
set intermediary_code = m.old_code
from partner_code_rollback_map m
where upper(btrim(coalesce(p.intermediary_code, ''))) = upper(m.new_code);

update public.policy_intermediary_payouts p
set intermediary_code = m.old_code
from partner_code_rollback_map m
where upper(btrim(coalesce(p.intermediary_code, ''))) = upper(m.new_code);

update public.partner_payables p
set intermediary_code = m.old_code
from partner_code_rollback_map m
where upper(btrim(coalesce(p.intermediary_code, ''))) = upper(m.new_code);

update public.partner_payments p
set intermediary_code = m.old_code
from partner_code_rollback_map m
where upper(btrim(coalesce(p.intermediary_code, ''))) = upper(m.new_code);

update public.partners p
set partner_code = m.old_code
from partner_code_rollback_map m
where p.id = m.partner_id
  and upper(p.partner_code) = upper(m.new_code);

create or replace function public.next_partner_code()
returns text
language sql
security definer
set search_path to 'public'
as $function$
  select 'PART-' || to_char(current_date, 'YYYY') || '-' || lpad(nextval('public.partner_code_sequence')::text, 5, '0');
$function$;

do $$
begin
  if exists (
    select 1
    from partner_code_rollback_map m
    join public.partners p on p.id = m.partner_id
    where upper(p.partner_code) <> upper(m.old_code)
  ) then
    raise exception 'Partner code rollback verification failed: a partner code was not restored.';
  end if;

  if exists (
    select 1
    from partner_code_rollback_map m
    join public.policies p on upper(coalesce(p.intermediary_code, '')) = upper(m.new_code)
  ) then
    raise exception 'Partner code rollback verification failed: policy references remain on PT codes.';
  end if;
end
$$;

drop table public.partner_code_format_migration_20260916_backup;

commit;
