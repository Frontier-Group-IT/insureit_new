-- Business rule: a lead source may provide the same contact mobile for multiple insured customers.
-- Customer identity remains the customer UUID; mobile is contact data and is no longer globally unique.
-- Keep the normal phone lookup index (idx_customers_phone) for candidate matching/search.

DROP INDEX IF EXISTS public.customers_phone_normalized_uidx;
DROP INDEX IF EXISTS public.customers_mobile_unique_idx;

COMMENT ON TABLE public.customers IS
  'Customer master. A mobile number may be shared by multiple customer records when the insured names are different; customer UUID is the identity.';

-- Rollback is intentionally NOT automatic because duplicate mobile rows may exist after this migration.
-- Use supabase/rollbacks/202608180001_allow_duplicate_customer_mobile.sql after reconciling any duplicates.
