-- Allow Life and Health policies to have no fixed end/maturity date.
-- Motor and other business lines retain their existing mandatory end date.
-- Apply this migration before deploying the optional-date server/client code.
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.policies
  DROP CONSTRAINT IF EXISTS policies_end_date_required_except_life_pension;

ALTER TABLE public.policies
  ADD CONSTRAINT policies_end_date_required_except_life_health
  CHECK (
    end_date IS NOT NULL
    OR lower(btrim(coalesce(business_line, ''))) IN ('life', 'health')
  );

COMMIT;
