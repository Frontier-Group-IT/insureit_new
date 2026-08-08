-- Align partner payout with the client-defined Retention meaning.
-- Partner payout is OD payout + TP payout.
-- Retention is the residual commercial margin: pay-in after TDS - partner payout.

do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='onboard_motor_policy';

  if v_def is null then raise exception 'onboard_motor_policy not found'; end if;
  if position('v_retention numeric;' in v_def)=0 then
    v_def := replace(v_def, 'v_gross_payout numeric;', 'v_gross_payout numeric;' || E'\n  v_retention numeric;');
  end if;
  v_def := replace(
    v_def,
    'v_gross_payout := greatest(v_od_payout + v_tp_payout - coalesce((p_payload #>> ''{payout,retention}'')::numeric, 0), 0);',
    'v_gross_payout := greatest(v_od_payout + v_tp_payout, 0);' || E'\n  v_retention := v_payin_after_tds - v_gross_payout;'
  );
  v_def := replace(
    v_def,
    'coalesce((p_payload #>> ''{payout,retention}'')::numeric, 0), coalesce((p_payload #>> ''{payout,odPercent}'')::numeric, 0)',
    'v_retention, coalesce((p_payload #>> ''{payout,odPercent}'')::numeric, 0)'
  );
  execute v_def;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='update_motor_policy';

  if v_def is null then raise exception 'update_motor_policy not found'; end if;
  v_def := replace(
    v_def,
    'v_retention numeric := coalesce(nullif(p_payload #>> ''{payout,retention}'', '''')::numeric, 0);',
    'v_retention numeric;'
  );
  v_def := replace(v_def, ' or v_retention < 0', '');
  v_def := replace(
    v_def,
    'v_gross_payout := greatest(0, v_payout_od + v_payout_tp - v_retention);',
    'v_gross_payout := greatest(0, v_payout_od + v_payout_tp);' || E'\n  v_retention := v_payin_after_tds - v_gross_payout;'
  );
  execute v_def;
end $$;
