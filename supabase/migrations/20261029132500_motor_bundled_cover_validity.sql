-- Add cover-specific motor validity dates without removing legacy start_date/end_date.
-- Existing historical validity is OD-only; do not infer historical TP/CPA coverage.
ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS od_valid_from date,
  ADD COLUMN IF NOT EXISTS od_valid_upto date,
  ADD COLUMN IF NOT EXISTS tp_valid_from date,
  ADD COLUMN IF NOT EXISTS tp_valid_upto date,
  ADD COLUMN IF NOT EXISTS cpa_valid_from date,
  ADD COLUMN IF NOT EXISTS cpa_valid_upto date;

UPDATE public.policies
SET od_valid_from = COALESCE(od_valid_from, start_date),
    od_valid_upto = COALESCE(od_valid_upto, end_date)
WHERE od_valid_from IS NULL OR od_valid_upto IS NULL;

CREATE OR REPLACE FUNCTION public.sync_motor_policy_cover_validities()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_class text;
  v_years integer;
BEGIN
  -- Keep the legacy policy validity columns as the OD compatibility contract.
  NEW.od_valid_from := NEW.start_date;
  NEW.od_valid_upto := NEW.end_date;

  IF TG_OP = 'UPDATE'
    AND NEW.start_date IS NOT DISTINCT FROM OLD.start_date
    AND NEW.end_date IS NOT DISTINCT FROM OLD.end_date
    AND NEW.policy_type IS NOT DISTINCT FROM OLD.policy_type
    AND NEW.vehicle_id IS NOT DISTINCT FROM OLD.vehicle_id
  THEN
    RETURN NEW;
  END IF;

  SELECT upper(trim(v.vehicle_type)) INTO v_class
    FROM public.vehicles v WHERE v.id = NEW.vehicle_id;

  IF upper(trim(coalesce(NEW.policy_type, ''))) = 'BUNDLED'
     AND v_class IN ('TWP', 'PCP') AND NEW.start_date IS NOT NULL
  THEN
    v_years := CASE WHEN v_class = 'TWP' THEN 5 ELSE 3 END;
    NEW.od_valid_upto := (NEW.start_date + interval '1 year' - interval '1 day')::date;
    NEW.end_date := NEW.od_valid_upto;
    NEW.tp_valid_from := NEW.start_date;
    NEW.tp_valid_upto := (NEW.start_date + make_interval(years => v_years) - interval '1 day')::date;
    NEW.cpa_valid_from := NEW.start_date;
    NEW.cpa_valid_upto := NEW.tp_valid_upto;
  ELSE
    NEW.tp_valid_from := NULL;
    NEW.tp_valid_upto := NULL;
    NEW.cpa_valid_from := NULL;
    NEW.cpa_valid_upto := NULL;
  END IF;
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS trg_sync_motor_policy_cover_validities ON public.policies;
CREATE TRIGGER trg_sync_motor_policy_cover_validities
BEFORE INSERT OR UPDATE ON public.policies
FOR EACH ROW EXECUTE FUNCTION public.sync_motor_policy_cover_validities();

COMMENT ON COLUMN public.policies.od_valid_upto IS 'OD expiry, inclusive. Existing legacy end_date retained as compatibility alias.';
COMMENT ON COLUMN public.policies.tp_valid_upto IS 'TP expiry for TWP/PCP Bundled policies; NULL for historical unknown / other products.';
COMMENT ON COLUMN public.policies.cpa_valid_upto IS 'CPA expiry for TWP/PCP Bundled policies; NULL for historical unknown / other products.';
