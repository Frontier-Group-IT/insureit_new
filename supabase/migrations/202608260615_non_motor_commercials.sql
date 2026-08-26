-- Generic commercial fields for policy types that do not use Motor OD/TP splits.
-- Existing Motor columns and formulas remain unchanged.

alter table public.policy_payin_details
  add column if not exists commercial_basis text,
  add column if not exists projected_commission_percent numeric(10,4),
  add column if not exists projected_commission_amount numeric(16,2);

alter table public.policy_intermediary_payouts
  add column if not exists payout_basis text,
  add column if not exists partner_payout_percent numeric(10,4),
  add column if not exists partner_payout_amount numeric(16,2);

alter table public.policy_payin_details
  drop constraint if exists policy_payin_details_commercial_basis_check;
alter table public.policy_payin_details
  add constraint policy_payin_details_commercial_basis_check
  check (commercial_basis is null or commercial_basis in ('NET_PREMIUM_PERCENT', 'FIXED_AMOUNT'));

alter table public.policy_intermediary_payouts
  drop constraint if exists policy_intermediary_payouts_payout_basis_check;
alter table public.policy_intermediary_payouts
  add constraint policy_intermediary_payouts_payout_basis_check
  check (payout_basis is null or payout_basis in ('NET_PREMIUM_PERCENT', 'FIXED_AMOUNT'));

alter table public.policy_payin_details
  drop constraint if exists policy_payin_details_projected_commission_percent_check;
alter table public.policy_payin_details
  add constraint policy_payin_details_projected_commission_percent_check
  check (projected_commission_percent is null or (projected_commission_percent >= 0 and projected_commission_percent <= 100));

alter table public.policy_intermediary_payouts
  drop constraint if exists policy_intermediary_payouts_partner_payout_percent_check;
alter table public.policy_intermediary_payouts
  add constraint policy_intermediary_payouts_partner_payout_percent_check
  check (partner_payout_percent is null or (partner_payout_percent >= 0 and partner_payout_percent <= 100));
