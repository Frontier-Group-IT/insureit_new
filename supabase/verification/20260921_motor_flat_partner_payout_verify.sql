select
  to_regprocedure('public.apply_motor_flat_partner_payout_v1(uuid,jsonb)') is not null as flat_helper_ready,
  to_regprocedure('public.onboard_motor_policy_commercial_status_v2(jsonb)') is not null as onboard_wrapper_ready,
  to_regprocedure('public.update_motor_policy_commercial_status_v2(uuid,jsonb)') is not null as update_wrapper_ready;

select
  exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='policy_intermediary_payouts'
      and column_name='partner_payout_amount'
  ) as fixed_amount_column_ready,
  exists (
    select 1
    from pg_constraint
    where conrelid='public.policy_intermediary_payouts'::regclass
      and conname='policy_intermediary_payouts_payout_basis_check'
      and pg_get_constraintdef(oid) like '%FIXED_AMOUNT%'
  ) as fixed_basis_constraint_ready;
