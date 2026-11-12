-- Revert Life/Health optional maturity to the pension-only exception.
-- Non-pension Life/Health policies created with NULL end_date must first
-- receive an authorized, correct maturity date; do not fabricate one.
BEGIN;
SET LOCAL lock_timeout = '5s';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.policies
    WHERE end_date IS NULL
      AND NOT (
        lower(btrim(coalesce(business_line, ''))) = 'life'
        AND coalesce(policy_product, '') ~* '(^|[^[:alnum:]])pension([^[:alnum:]]|$)'
      )
  ) THEN
    RAISE EXCEPTION 'Cannot restore pension-only maturity constraint: non-pension policies have NULL end_date. Resolve those records with authorized policy data first.';
  END IF;
END;
$$;

ALTER TABLE public.policies
  DROP CONSTRAINT IF EXISTS policies_end_date_required_except_life_health;

ALTER TABLE public.policies
  ADD CONSTRAINT policies_end_date_required_except_life_pension
  CHECK (
    end_date IS NOT NULL
    OR (
      lower(btrim(coalesce(business_line, ''))) = 'life'
      AND coalesce(policy_product, '') ~* '(^|[^[:alnum:]])pension([^[:alnum:]]|$)'
    )
  );
COMMIT;
