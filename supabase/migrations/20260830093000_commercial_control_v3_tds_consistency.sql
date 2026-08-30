-- Repair Commercial Control v2 Pay-In rows that changed projected Pay-In
-- without recomputing TDS / after-TDS, and keep retained margin aligned.
-- The write path is corrected in the matching application change.

begin;

with corrected as (
  select
    pi.policy_id,
    pi.id as payin_id,
    coalesce(pi.total_projected_payin, 0)::numeric as total_projected_payin,
    coalesce(pi.tds_percent, 10)::numeric as tds_percent,
    (coalesce(pi.total_projected_payin, 0) * coalesce(pi.tds_percent, 10) / 100)::numeric as corrected_tds_amount,
    (coalesce(pi.total_projected_payin, 0) - (coalesce(pi.total_projected_payin, 0) * coalesce(pi.tds_percent, 10) / 100))::numeric as corrected_after_tds
  from public.policy_payin_details pi
  where pi.calculation_version = 'commercial_control_v2'
)
update public.policy_payin_details pi
set
  tds_amount = c.corrected_tds_amount,
  payin_after_tds = c.corrected_after_tds,
  calculation_version = 'commercial_control_v3',
  updated_at = now()
from corrected c
where pi.id = c.payin_id
  and (
    abs(coalesce(pi.tds_amount, 0) - c.corrected_tds_amount) > 0.01
    or abs(coalesce(pi.payin_after_tds, 0) - c.corrected_after_tds) > 0.01
    or pi.calculation_version <> 'commercial_control_v3'
  );

with latest_payin as (
  select
    pi.policy_id,
    coalesce(pi.payin_after_tds, 0)::numeric as payin_after_tds
  from public.policy_payin_details pi
  where pi.calculation_version = 'commercial_control_v3'
)
update public.policy_intermediary_payouts po
set
  retention_amount = lp.payin_after_tds - coalesce(po.partner_payout_amount, po.gross_payout, 0),
  calculation_version = case
    when po.calculation_version = 'commercial_control_v2' then 'commercial_control_v3'
    else po.calculation_version
  end,
  updated_at = now()
from latest_payin lp
where po.policy_id = lp.policy_id
  and abs(
    coalesce(po.retention_amount, 0)
    - (lp.payin_after_tds - coalesce(po.partner_payout_amount, po.gross_payout, 0))
  ) > 0.01;

alter table public.policy_payin_details
  drop constraint if exists policy_payin_details_after_tds_consistency_check;

alter table public.policy_payin_details
  add constraint policy_payin_details_after_tds_consistency_check
  check (
    abs(
      coalesce(payin_after_tds, 0)
      - (coalesce(total_projected_payin, 0) - coalesce(tds_amount, 0))
    ) <= 0.02
  );

alter table public.policy_payin_details
  drop constraint if exists policy_payin_details_tds_consistency_check;

alter table public.policy_payin_details
  add constraint policy_payin_details_tds_consistency_check
  check (
    abs(
      coalesce(tds_amount, 0)
      - (coalesce(total_projected_payin, 0) * coalesce(tds_percent, 0) / 100)
    ) <= 0.02
  );

commit;
