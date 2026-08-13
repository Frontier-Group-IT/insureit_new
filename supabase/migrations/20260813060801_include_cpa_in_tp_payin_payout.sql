-- Treat opted CPA premium as part of the TP-side commercial base for PayIn and payout.
-- This migration also corrects persisted derived values for existing policies.
-- Actual/manual PayIn bill amounts are preserved; only untouched auto-filled bill amounts are adjusted.

begin;

do $$
declare
  v_def text;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'onboard_motor_policy';

  if v_def is null then
    raise exception 'onboard_motor_policy not found';
  end if;

  v_def := replace(
    v_def,
    'v_tp_payin := v_tp * coalesce((p_payload #>> ''{payin,tpPercent}'')::numeric, 0) / 100;',
    'v_tp_payin := (v_tp + v_cpa) * coalesce((p_payload #>> ''{payin,tpPercent}'')::numeric, 0) / 100;'
  );
  v_def := replace(
    v_def,
    'v_tp_payout := case when p_payload #>> ''{payin,basis}'' = ''OD'' then 0 else v_tp * coalesce((p_payload #>> ''{payout,tpPercent}'')::numeric, 0) / 100 end;',
    'v_tp_payout := case when p_payload #>> ''{payin,basis}'' = ''OD'' then 0 else (v_tp + v_cpa) * coalesce((p_payload #>> ''{payout,tpPercent}'')::numeric, 0) / 100 end;'
  );
  execute v_def;

  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'update_motor_policy';

  if v_def is null then
    raise exception 'update_motor_policy not found';
  end if;

  v_def := replace(
    v_def,
    'v_projected_tp := v_tp * v_projected_tp_percent / 100;',
    'v_projected_tp := (v_tp + v_cpa) * v_projected_tp_percent / 100;'
  );
  v_def := replace(
    v_def,
    'v_payout_tp := case when upper(v_payout_basis) = ''OD'' then 0 else v_tp * v_payout_tp_percent / 100 end;',
    'v_payout_tp := case when upper(v_payout_basis) = ''OD'' then 0 else (v_tp + v_cpa) * v_payout_tp_percent / 100 end;'
  );
  execute v_def;
end $$;

-- Correct persisted PayIn derivations for every existing policy using the stored
-- OD/TP/CPA premiums and the stored PayIn percentages.
with recalculated as (
  select
    pi.policy_id,
    (coalesce(pr.od_premium, 0) * coalesce(pi.projected_od_percent, 0) / 100) as od_payin,
    ((coalesce(pr.tp_premium, 0) + case when coalesce(pr.cpa_opted, false) then coalesce(pr.cpa_amount, 0) else 0 end)
      * coalesce(pi.projected_tp_percent, 0) / 100) as tp_payin,
    coalesce(pi.insurer_scheme_amount, 0) as scheme
  from public.policy_payin_details pi
  join public.policy_premium_details pr on pr.policy_id = pi.policy_id
)
update public.policy_payin_details pi
set projected_od_amount = r.od_payin,
    projected_tp_amount = r.tp_payin,
    total_projected_payin = r.od_payin + r.tp_payin + r.scheme,
    tds_percent = 10,
    tds_amount = (r.od_payin + r.tp_payin + r.scheme) * 0.10,
    payin_after_tds = (r.od_payin + r.tp_payin + r.scheme) * 0.90,
    calculation_version = 'cpa_in_tp_v2',
    updated_at = now()
from recalculated r
where pi.policy_id = r.policy_id;

-- Correct persisted intermediary payout amounts and residual retention.
with recalculated as (
  select
    po.id as payout_id,
    (coalesce(pr.od_premium, 0) * coalesce(po.od_payout_percent, 0) / 100) as od_payout,
    case
      when upper(coalesce(pi.payout_basis, 'NET')) = 'OD' then 0
      else (coalesce(pr.tp_premium, 0) + case when coalesce(pr.cpa_opted, false) then coalesce(pr.cpa_amount, 0) else 0 end)
        * coalesce(po.tp_payout_percent, 0) / 100
    end as tp_payout,
    coalesce(pi.payin_after_tds, 0) as payin_after_tds
  from public.policy_intermediary_payouts po
  join public.policy_premium_details pr on pr.policy_id = po.policy_id
  join public.policy_payin_details pi on pi.policy_id = po.policy_id
)
update public.policy_intermediary_payouts po
set od_payout_amount = r.od_payout,
    tp_payout_amount = r.tp_payout,
    gross_payout = greatest(0, r.od_payout + r.tp_payout),
    retention_amount = r.payin_after_tds - greatest(0, r.od_payout + r.tp_payout),
    calculation_version = 'cpa_in_tp_v2',
    updated_at = now()
from recalculated r
where po.id = r.payout_id;

-- If an existing PayIn bill was only the untouched auto-filled amount from the
-- old formula (and no real bill number/date has been entered), move it to the
-- corrected projected PayIn. Never overwrite an actual/manual billed invoice.
with bill_calc as (
  select
    b.id as bill_id,
    b.billed_amount,
    b.bill_number,
    b.bill_date,
    (coalesce(pr.od_premium, 0) * coalesce(pi.projected_od_percent, 0) / 100
      + coalesce(pr.tp_premium, 0) * coalesce(pi.projected_tp_percent, 0) / 100
      + coalesce(pi.insurer_scheme_amount, 0)) as old_auto_amount,
    coalesce(pi.total_projected_payin, 0) as new_auto_amount
  from public.policy_payin_bills b
  join public.policy_premium_details pr on pr.policy_id = b.policy_id
  join public.policy_payin_details pi on pi.policy_id = b.policy_id
)
update public.policy_payin_bills b
set billed_amount = c.new_auto_amount,
    status = case
      when b.bill_number is null and b.bill_date is null and c.new_auto_amount > 0 then 'Billing details incomplete'
      else b.status
    end,
    short_payout_amount = 0,
    updated_at = now()
from bill_calc c
where b.id = c.bill_id
  and c.bill_number is null
  and c.bill_date is null
  and abs(coalesce(c.billed_amount, 0) - c.old_auto_amount) <= 0.01;

-- Recalculate the shortfall indicator for all bills against the corrected PayIn,
-- while retaining whatever actual billed amount the user entered.
update public.policy_payin_bills b
set short_payout_amount = greatest(coalesce(pi.total_projected_payin, 0) - coalesce(b.billed_amount, 0), 0),
    updated_at = now()
from public.policy_payin_details pi
where pi.policy_id = b.policy_id;

update public.policies p
set calculation_version = 'cpa_in_tp_v2',
    updated_at = now()
where exists (
  select 1 from public.policy_payin_details pi where pi.policy_id = p.id
);

commit;
