-- Commercial Control v3 verification.
-- Fails if persisted Pay-In/TDS or retained-margin values drift from their stored bases.

do $$
declare
  v_payin_mismatch_count bigint;
  v_retention_mismatch_count bigint;
begin
  select count(*)
  into v_payin_mismatch_count
  from public.policy_payin_details pi
  where abs(
    coalesce(pi.payin_after_tds, 0)
    - (coalesce(pi.total_projected_payin, 0) - coalesce(pi.tds_amount, 0))
  ) > 0.02
  or abs(
    coalesce(pi.tds_amount, 0)
    - (coalesce(pi.total_projected_payin, 0) * coalesce(pi.tds_percent, 0) / 100)
  ) > 0.02;

  if v_payin_mismatch_count <> 0 then
    raise exception 'Pay-In/TDS consistency verification failed for % rows', v_payin_mismatch_count;
  end if;

  select count(*)
  into v_retention_mismatch_count
  from public.policy_intermediary_payouts po
  join public.policy_payin_details pi on pi.policy_id = po.policy_id
  where abs(
    coalesce(po.retention_amount, 0)
    - (
      coalesce(pi.payin_after_tds, 0)
      - coalesce(po.partner_payout_amount, po.gross_payout, 0)
    )
  ) > 0.02;

  if v_retention_mismatch_count <> 0 then
    raise exception 'Commercial retention consistency verification failed for % rows', v_retention_mismatch_count;
  end if;
end $$;
