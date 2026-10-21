-- Add-on premium is a separate motor premium component, taxed at 18%.
-- Existing policy amounts remain untouched until their policy is edited.
ALTER TABLE public.policy_premium_details
  ADD COLUMN IF NOT EXISTS add_on_premium numeric(14,2) NOT NULL DEFAULT 0;
ALTER TABLE public.policy_premium_details
  ADD CONSTRAINT policy_premium_details_add_on_nonnegative
  CHECK (add_on_premium >= 0) NOT VALID;
ALTER TABLE public.policy_premium_details
  VALIDATE CONSTRAINT policy_premium_details_add_on_nonnegative;

CREATE OR REPLACE FUNCTION public.set_motor_policy_addon_premium_v1(
  p_policy_id uuid, p_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_premium public.policy_premium_details%ROWTYPE;
  v_class text;
  v_net numeric;
  v_gst numeric;
  v_gross numeric;
BEGIN
  IF auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Service role required';
  END IF;
  IF p_amount IS NULL OR p_amount < 0 OR p_amount > 100000000 OR p_amount <> round(p_amount,2) THEN
    RAISE EXCEPTION 'Invalid add-on premium';
  END IF;
  SELECT d.* INTO v_premium
  FROM public.policy_premium_details d
  JOIN public.policies p ON p.id = d.policy_id
  WHERE d.policy_id = p_policy_id AND p.business_line = 'Motor'
  FOR UPDATE OF d;
  IF NOT FOUND THEN RAISE EXCEPTION 'Motor policy premium record not found'; END IF;
  IF v_premium.calculation_overridden IS TRUE THEN
    RAISE EXCEPTION 'Premium is manually overridden; review it before editing add-on';
  END IF;
  SELECT upper(coalesce(v.vehicle_class_code,'')) INTO v_class
  FROM public.policies p JOIN public.vehicles v ON v.id = p.vehicle_id
  WHERE p.id = p_policy_id;
  v_net := coalesce(v_premium.od_premium,0) + coalesce(v_premium.tp_premium,0)
    + CASE WHEN v_premium.cpa_opted THEN coalesce(v_premium.cpa_amount,0) ELSE 0 END + p_amount;
  IF v_class = 'GCV' THEN
    v_gst := round((coalesce(v_premium.od_premium,0)
      + CASE WHEN v_premium.cpa_opted THEN coalesce(v_premium.cpa_amount,0) ELSE 0 END
      + p_amount) * 0.18 + coalesce(v_premium.tp_premium,0) * 0.05,2);
  ELSE
    v_gst := round(v_net * 0.18,2);
  END IF;
  v_gross := v_net + v_gst;
  UPDATE public.policy_premium_details
  SET add_on_premium = p_amount, net_premium = v_net, gst_amount = v_gst,
      gross_premium = v_gross, updated_at = now()
  WHERE id = v_premium.id;
  -- Most policies store premium in the detail row; preserve NULL if summary is unused.
  UPDATE public.policies
  SET premium_amount = CASE WHEN premium_amount IS NULL THEN NULL ELSE v_gross END
  WHERE id = p_policy_id;
  RETURN jsonb_build_object('ok',true,'policyId',p_policy_id,'net',v_net,'gst',v_gst,'gross',v_gross);
END;
$$;
REVOKE ALL ON FUNCTION public.set_motor_policy_addon_premium_v1(uuid,numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_motor_policy_addon_premium_v1(uuid,numeric) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_motor_policy_addon_premium_v1(uuid,numeric) TO service_role;
