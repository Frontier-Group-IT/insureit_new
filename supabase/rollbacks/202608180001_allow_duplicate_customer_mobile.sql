-- Roll back 202608180001_allow_duplicate_customer_mobile.sql.
-- This script is deliberately fail-safe: it refuses to restore uniqueness while duplicate
-- normalized 10-digit mobile numbers exist. Reconcile those rows first, then rerun.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM public.customers
    WHERE length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 10
    GROUP BY right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'Rollback blocked: duplicate normalized customer mobile numbers exist. Reconcile them before restoring uniqueness.';
  END IF;
END
$$;

CREATE UNIQUE INDEX IF NOT EXISTS customers_mobile_unique_idx
ON public.customers (
  right(regexp_replace(coalesce(phone, ''), '\D', '', 'g'), 10)
)
WHERE length(regexp_replace(coalesce(phone, ''), '\D', '', 'g')) >= 10;

COMMENT ON TABLE public.customers IS NULL;
