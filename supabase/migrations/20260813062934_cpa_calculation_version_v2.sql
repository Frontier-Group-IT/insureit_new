begin;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='onboard_motor_policy';
  if v_def is null then raise exception 'onboard_motor_policy not found'; end if;
  v_def := replace(v_def, '''prototype_v1''', '''cpa_in_tp_v2''');
  execute v_def;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='update_motor_policy';
  if v_def is null then raise exception 'update_motor_policy not found'; end if;
  v_def := replace(v_def, '''prototype_v1''', '''cpa_in_tp_v2''');
  execute v_def;
end $$;

update public.policies set calculation_version='cpa_in_tp_v2' where calculation_version is distinct from 'cpa_in_tp_v2';
update public.policy_premium_details set calculation_version='cpa_in_tp_v2', updated_at=now() where calculation_version is distinct from 'cpa_in_tp_v2';
update public.policy_payin_details set calculation_version='cpa_in_tp_v2', updated_at=now() where calculation_version is distinct from 'cpa_in_tp_v2';
update public.policy_intermediary_payouts set calculation_version='cpa_in_tp_v2', updated_at=now() where calculation_version is distinct from 'cpa_in_tp_v2';

commit;
