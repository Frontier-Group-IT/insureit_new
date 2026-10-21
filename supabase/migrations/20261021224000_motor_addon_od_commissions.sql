-- Amend the pending atomic-save wrapper to include Add-on Premium in OD commissions.\n-- Existing policy rows are not modified by this migration.
CREATE OR REPLACE FUNCTION public.save_motor_policy_with_addon_v1(
  p_operation text, p_payload jsonb, p_policy_id uuid DEFAULT NULL,
  p_intake_id uuid DEFAULT NULL, p_expected_revision integer DEFAULT NULL,
  p_existing_policy_id uuid DEFAULT NULL, p_reason text DEFAULT NULL, p_effective_date date DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_result jsonb;
  v_id uuid;
  v_amount numeric;
  v_existing_amount numeric;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN RAISE EXCEPTION 'Service role required'; END IF;
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object' THEN RAISE EXCEPTION 'Invalid policy payload'; END IF;
  IF coalesce(p_payload #>> '{premium,addOnPremium}','') !~ '^[0-9]{1,9}([.][0-9]{1,2})?$' THEN
    IF coalesce(p_payload #>> '{premium,addOnPremium}','') NOT IN ('','0') THEN
      RAISE EXCEPTION 'Invalid Add-on Premium';
    END IF;
  END IF;
  v_amount := coalesce(nullif(p_payload #>> '{premium,addOnPremium}','')::numeric,0);
  IF v_amount > 100000000 THEN RAISE EXCEPTION 'Add-on Premium exceeds limit'; END IF;
  CASE p_operation
    WHEN 'create' THEN
      v_result := public.onboard_motor_policy_commercial_status_v2(p_payload);
    WHEN 'intake' THEN
      IF p_intake_id IS NULL OR p_expected_revision IS NULL THEN RAISE EXCEPTION 'Missing intake reference or revision'; END IF;
      v_result := public.finalize_policy_intake_motor_v1(p_intake_id,p_payload,p_expected_revision);
    WHEN 'replace' THEN
      IF p_existing_policy_id IS NULL THEN RAISE EXCEPTION 'Missing replacement policy'; END IF;
      v_result := public.replace_active_motor_policy_v1(p_existing_policy_id,p_payload,p_reason,p_effective_date);
    WHEN 'edit' THEN
      IF p_policy_id IS NULL THEN RAISE EXCEPTION 'Missing policy id'; END IF;
      v_result := public.update_motor_policy_commercial_status_v2(p_policy_id,p_payload);
    ELSE RAISE EXCEPTION 'Unsupported motor save operation';
  END CASE;
  IF coalesce((v_result ->> 'ok')::boolean,false) IS NOT TRUE THEN
    RAISE EXCEPTION 'Motor policy save did not succeed';
  END IF;
  v_id := nullif(v_result ->> 'policyId','')::uuid;
  IF v_id IS NULL THEN RAISE EXCEPTION 'Motor policy save returned no policy id'; END IF;
  -- Do not recalculate historical zero-add-on premiums (some have historical
  -- overrides/rounding). Edits that clear a nonzero add-on must recalculate.
  SELECT add_on_premium INTO v_existing_amount
  FROM public.policy_premium_details WHERE policy_id = v_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motor premium row not found'; END IF;
  IF v_amount <> 0 OR coalesce(v_existing_amount,0) <> 0 THEN
    PERFORM public.set_motor_policy_addon_premium_v1(v_id,v_amount);
  END IF;
  -- Add-on is OD business: adjust percentage-based commissions after the base
  -- motor RPC recalculates its OD/TP values. Retain absolute flat payouts.
  IF v_amount > 0 THEN
    UPDATE public.policy_payin_details pi
       SET projected_od_amount = coalesce(pi.projected_od_amount,0) +
             round(v_amount * coalesce(pi.projected_od_percent,0) / 100,2),
           total_projected_payin = coalesce(pi.total_projected_payin,0) +
             round(v_amount * coalesce(pi.projected_od_percent,0) / 100,2),
           updated_at = now()
     WHERE pi.policy_id = v_id;
    UPDATE public.policy_payin_details pi
       SET tds_amount = round(coalesce(pi.total_projected_payin,0) * coalesce(pi.tds_percent,0)/100,2),
           payin_after_tds = coalesce(pi.total_projected_payin,0) -
             round(coalesce(pi.total_projected_payin,0) * coalesce(pi.tds_percent,0)/100,2),
           updated_at = now()
     WHERE pi.policy_id = v_id;
    UPDATE public.policy_intermediary_payouts po
       SET od_payout_amount = coalesce(po.od_payout_amount,0) +
              round(v_amount * coalesce(po.od_payout_percent,0)/100,2),
           gross_payout = coalesce(po.gross_payout,0) +
              round(v_amount * coalesce(po.od_payout_percent,0)/100,2),
           updated_at = now()
     WHERE po.policy_id = v_id
       AND coalesce(po.payout_basis,'') <> 'FIXED_AMOUNT'
       AND po.id = (
         SELECT id FROM public.policy_intermediary_payouts
          WHERE policy_id = v_id ORDER BY created_at DESC, id DESC LIMIT 1
       );
  END IF;
  RETURN v_result;
END; $$;
REVOKE ALL ON FUNCTION public.save_motor_policy_with_addon_v1(text,jsonb,uuid,uuid,integer,uuid,text,date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_motor_policy_with_addon_v1(text,jsonb,uuid,uuid,integer,uuid,text,date) TO service_role;
