create index if not exists policy_payin_details_commercial_reviewed_by_idx
  on public.policy_payin_details(commercial_reviewed_by);

create index if not exists policy_intermediary_payouts_commercial_reviewed_by_idx
  on public.policy_intermediary_payouts(commercial_reviewed_by);
