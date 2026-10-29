-- Store optional partial-year projected TP / CPA commission settings.
-- Preserve existing unselected pay-in behavior and all historical values.
ALTER TABLE public.policy_payin_details
  ADD COLUMN IF NOT EXISTS partial_tp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS partial_cpa boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.save_motor_policy_with_addon_v1(p_operation text, p_payload jsonb, p_policy_id uuid DEFAULT NULL::uuid, p_intake_id uuid DEFAULT NULL::uuid, p_expected_revision integer DEFAULT NULL::integer, p_existing_policy_id uuid DEFAULT NULL::uuid, p_reason text DEFAULT NULL::text, p_effective_date date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  v_result jsonb;
  v_id uuid;
  v_amount numeric;
  v_existing_amount numeric;
  v_tp numeric;
  v_cpa numeric;
  v_rate numeric;
  v_previous_tp numeric;
  v_previous_total numeric;
  v_tds_rate numeric;
  v_new_tp numeric;
  v_new_total numeric;
  v_new_tds numeric;
  v_tp_years integer;
  v_cpa_years integer;
  v_partial_tp boolean;
  v_partial_cpa boolean;
  v_bundled boolean;
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

  -- Optional TP/CPA partial-year projection, performed within the same booking
  -- transaction after the motor RPC writes premium and pay-in base amounts.
  IF coalesce((p_payload #>> '{payin,provided}')::boolean, false) THEN
    v_partial_tp := coalesce((p_payload #>> '{payin,partialTp}')::boolean,false);
    v_partial_cpa := coalesce((p_payload #>> '{payin,partialCpa}')::boolean,false);
    SELECT pp.tp_premium, pp.cpa_amount, pi.projected_tp_percent,
           pi.projected_tp_amount, pi.total_projected_payin, pi.tds_percent,
           upper(coalesce(p.policy_type,'')) = 'BUNDLED'
              AND upper(coalesce(v.vehicle_type,'')) IN ('TWP','PCP'),
           CASE WHEN p.tp_valid_from IS NOT NULL AND p.tp_valid_upto IS NOT NULL
             THEN extract(year FROM age(p.tp_valid_upto + 1, p.tp_valid_from))::integer
             ELSE CASE WHEN upper(coalesce(v.vehicle_type,''))='TWP' THEN 5 ELSE 3 END END,
           CASE WHEN p.cpa_valid_from IS NOT NULL AND p.cpa_valid_upto IS NOT NULL
             THEN extract(year FROM age(p.cpa_valid_upto + 1, p.cpa_valid_from))::integer
             ELSE CASE WHEN upper(coalesce(v.vehicle_type,''))='TWP' THEN 5 ELSE 3 END END
      INTO v_tp,v_cpa,v_rate,v_previous_tp,v_previous_total,v_tds_rate,
           v_bundled,v_tp_years,v_cpa_years
      FROM public.policies p
      JOIN public.vehicles v ON v.id=p.vehicle_id
      JOIN public.policy_premium_details pp ON pp.policy_id=p.id
      JOIN public.policy_payin_details pi ON pi.policy_id=p.id
     WHERE p.id=v_id;
    v_partial_tp := coalesce(v_partial_tp AND v_bundled,false);
    v_partial_cpa := coalesce(v_partial_cpa AND v_bundled,false);
    IF v_partial_tp OR v_partial_cpa THEN
      IF (v_partial_tp AND coalesce(v_tp_years,0)<1) OR
         (v_partial_cpa AND coalesce(v_cpa_years,0)<1) THEN
        RAISE EXCEPTION 'Missing valid TP/CPA policy coverage years';
      END IF;
      v_new_tp := round((
        CASE WHEN v_partial_tp THEN coalesce(v_tp,0)/v_tp_years ELSE coalesce(v_tp,0) END
        + CASE WHEN v_partial_cpa THEN coalesce(v_cpa,0)/v_cpa_years ELSE coalesce(v_cpa,0) END
      ) * coalesce(v_rate,0)/100,2);
      v_new_total := round(coalesce(v_previous_total,0)-coalesce(v_previous_tp,0)+v_new_tp,2);
      v_new_tds := round(v_new_total*coalesce(v_tds_rate,0)/100,2);
      UPDATE public.policy_payin_details SET
        projected_tp_amount=v_new_tp,
        total_projected_payin=v_new_total,
        tds_amount=v_new_tds,
        payin_after_tds=v_new_total-v_new_tds,
        partial_tp=v_partial_tp,
        partial_cpa=v_partial_cpa,
        updated_at=now()
      WHERE policy_id=v_id;
    ELSE
      UPDATE public.policy_payin_details
         SET partial_tp=false,partial_cpa=false,updated_at=now()
       WHERE policy_id=v_id;
    END IF;
  END IF;
  RETURN v_result;
END; $function$

