-- Pension policies may have no fixed contractual maturity date.
-- Other policies retain the mandatory end-date invariant at database level.
ALTER TABLE public.policies
  ALTER COLUMN end_date DROP NOT NULL;

ALTER TABLE public.policies
  ADD CONSTRAINT policies_end_date_required_except_life_pension
  CHECK (
    end_date IS NOT NULL
    OR (
      lower(btrim(coalesce(business_line, ''))) = 'life'
      AND coalesce(policy_product, '') ~* '(^|[^[:alnum:]])pension([^[:alnum:]]|$)'
    )
  );
