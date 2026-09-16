do $$
declare
  v_function_def text;
  v_sequence_at_apply bigint;
  v_sequence_now bigint;
begin
  if to_regclass('public.partner_code_format_migration_20260916_backup') is null then
    raise exception 'PT partner code verification failed: reversible backup table is missing.';
  end if;

  select sequence_at_apply
  into v_sequence_at_apply
  from public.partner_code_format_migration_20260916_backup
  where record_type = 'meta'
  order by backup_id
  limit 1;

  select last_value into v_sequence_now from public.partner_code_sequence;

  if v_sequence_now < v_sequence_at_apply then
    raise exception 'PT partner code verification failed: partner sequence moved backwards.';
  end if;

  if exists (
    select 1
    from public.partners
    where partner_code ~ '^PART-[0-9]{4}-[0-9]{5}$'
  ) then
    raise exception 'PT partner code verification failed: legacy PART-format partner codes remain.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.partners p on p.id = b.partner_id
    where b.record_type = 'backfill'
      and upper(p.partner_code) <> upper(b.new_code)
  ) then
    raise exception 'PT partner code verification failed: a canonical partner row was not converted.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.posp_misp_onboarding_profiles p
      on upper(btrim(coalesce(p.partner_id, ''))) = upper(b.old_code)
    where b.record_type = 'backfill'
  ) then
    raise exception 'PT partner code verification failed: onboarding profile references remain on old codes.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.intermediaries i on upper(i.intermediary_code) = upper(b.old_code)
    where b.record_type = 'backfill'
  ) then
    raise exception 'PT partner code verification failed: intermediary references remain on old codes.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.policies p on upper(coalesce(p.intermediary_code, '')) = upper(b.old_code)
    where b.record_type = 'backfill'
  ) then
    raise exception 'PT partner code verification failed: policy references remain on old codes.';
  end if;

  if exists (
    select 1
    from public.partner_code_format_migration_20260916_backup b
    join public.policy_intermediary_payouts p on upper(coalesce(p.intermediary_code, '')) = upper(b.old_code)
    where b.record_type = 'backfill'
  ) then
    raise exception 'PT partner code verification failed: payout references remain on old codes.';
  end if;

  select pg_get_functiondef('public.next_partner_code()'::regprocedure)
  into v_function_def;

  if position("'PT'" in v_function_def) = 0
     or position('partner_code_sequence' in v_function_def) = 0 then
    raise exception 'PT partner code verification failed: next_partner_code() is not using the PT sequence format.';
  end if;
end
$$;
