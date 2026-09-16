begin;

-- Preserve enough state to make this identity-format migration reversible.
-- This table is intentionally retained until the companion rollback is run.
create table public.partner_code_format_migration_20260916_backup (
  backup_id bigint generated always as identity primary key,
  record_type text not null check (record_type in ('meta', 'backfill')),
  partner_id uuid,
  old_code text,
  new_code text,
  sequence_at_apply bigint not null,
  applied_at timestamptz not null default now()
);

create unique index partner_code_format_migration_20260916_partner_unique
  on public.partner_code_format_migration_20260916_backup(partner_id)
  where record_type = 'backfill';

insert into public.partner_code_format_migration_20260916_backup (
  record_type,
  partner_id,
  old_code,
  new_code,
  sequence_at_apply
)
select
  'meta',
  null,
  null,
  null,
  last_value
from public.partner_code_sequence;

insert into public.partner_code_format_migration_20260916_backup (
  record_type,
  partner_id,
  old_code,
  new_code,
  sequence_at_apply
)
select
  'backfill',
  p.id,
  p.partner_code,
  'PT' || right(p.partner_code, 5),
  (select sequence_at_apply from public.partner_code_format_migration_20260916_backup where record_type = 'meta')
from public.partners p
where p.partner_code ~ '^PART-[0-9]{4}-[0-9]{5}$';

do $$
begin
  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    where b.record_type = 'backfill'
    group by b.new_code
    having count(*) > 1
  ) then
    raise exception 'Partner code migration aborted: two legacy PART codes map to the same PT code.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.partners p
      on upper(p.partner_code) = upper(b.new_code)
     and p.id <> b.partner_id
    where b.record_type = 'backfill'
  ) then
    raise exception 'Partner code migration aborted: target PT code already exists in partners.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.intermediaries i on upper(i.intermediary_code) = upper(b.new_code)
    where b.record_type = 'backfill'
  ) then
    raise exception 'Partner code migration aborted: target PT code already exists in intermediaries.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.policies p on upper(coalesce(p.intermediary_code, '')) = upper(b.new_code)
    where b.record_type = 'backfill'
  ) then
    raise exception 'Partner code migration aborted: target PT code already exists on a policy.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.policy_intermediary_payouts p on upper(coalesce(p.intermediary_code, '')) = upper(b.new_code)
    where b.record_type = 'backfill'
  ) then
    raise exception 'Partner code migration aborted: target PT code already exists on a policy payout.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.partner_payables p on upper(coalesce(p.intermediary_code, '')) = upper(b.new_code)
    where b.record_type = 'backfill'
  ) then
    raise exception 'Partner code migration aborted: target PT code already exists on a payable.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.partner_payments p on upper(coalesce(p.intermediary_code, '')) = upper(b.new_code)
    where b.record_type = 'backfill'
  ) then
    raise exception 'Partner code migration aborted: target PT code already exists on a payment.';
  end if;
end
$$;

-- Rewrite every live code-based reference as one transaction. UUID-based partner
-- relationships are intentionally untouched.
update public.posp_misp_onboarding_profiles p
set partner_id = b.new_code,
    updated_at = now()
from public.partner_code_format_migration_20260916_backup b
where b.record_type = 'backfill'
  and upper(btrim(coalesce(p.partner_id, ''))) = upper(b.old_code);

update public.intermediaries i
set intermediary_code = b.new_code,
    updated_at = now()
from public.partner_code_format_migration_20260916_backup b
where b.record_type = 'backfill'
  and upper(btrim(i.intermediary_code)) = upper(b.old_code);

update public.policies p
set intermediary_code = b.new_code,
    updated_at = now()
from public.partner_code_format_migration_20260916_backup b
where b.record_type = 'backfill'
  and upper(btrim(coalesce(p.intermediary_code, ''))) = upper(b.old_code);

update public.policy_intermediary_payouts p
set intermediary_code = b.new_code,
    updated_at = now()
from public.partner_code_format_migration_20260916_backup b
where b.record_type = 'backfill'
  and upper(btrim(coalesce(p.intermediary_code, ''))) = upper(b.old_code);

update public.partner_payables p
set intermediary_code = b.new_code,
    updated_at = now()
from public.partner_code_format_migration_20260916_backup b
where b.record_type = 'backfill'
  and upper(btrim(coalesce(p.intermediary_code, ''))) = upper(b.old_code);

update public.partner_payments p
set intermediary_code = b.new_code,
    updated_at = now()
from public.partner_code_format_migration_20260916_backup b
where b.record_type = 'backfill'
  and upper(btrim(coalesce(p.intermediary_code, ''))) = upper(b.old_code);

update public.partners p
set partner_code = b.new_code,
    updated_at = now()
from public.partner_code_format_migration_20260916_backup b
where b.record_type = 'backfill'
  and p.id = b.partner_id
  and p.partner_code = b.old_code;

-- Keep the existing global sequence. Only the presentation format changes.
create or replace function public.next_partner_code()
returns text
language sql
security definer
set search_path to 'public'
as $function$
  select 'PT' || lpad(nextval('public.partner_code_sequence')::text, 5, '0');
$function$;

do $$
begin
  if exists (
    select 1
    from public.partners
    where partner_code ~ '^PART-[0-9]{4}-[0-9]{5}$'
  ) then
    raise exception 'Partner code migration verification failed: PART-format partner rows remain.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.intermediaries i on upper(i.intermediary_code) = upper(b.old_code)
    where b.record_type = 'backfill'
  ) then
    raise exception 'Partner code migration verification failed: intermediary references remain on old codes.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.policies p on upper(coalesce(p.intermediary_code, '')) = upper(b.old_code)
    where b.record_type = 'backfill'
  ) then
    raise exception 'Partner code migration verification failed: policy references remain on old codes.';
  end if;
end
$$;

commit;
