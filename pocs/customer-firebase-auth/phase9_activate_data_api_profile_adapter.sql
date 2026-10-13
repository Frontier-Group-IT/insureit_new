-- APPLIED to production Supabase 2026-10-09 after successful
-- read-only simulations and transaction-rolled-back temporary identity tests.
-- The function public.customer_firebase_data_api_pre_request()
-- was created separately in migration:
-- customer_firebase_pre_request_function_only_20261009
--
-- PostgREST Data API only; Supabase Storage is separately served through
-- customer-firebase-doc-read and future file operations must be scoped.
ALTER ROLE authenticator
SET pgrst.db_pre_request = 'public.customer_firebase_data_api_pre_request';
NOTIFY pgrst, 'reload config';

-- EMERGENCY ROLLBACK (apply only as separate reviewed migration):
-- ALTER ROLE authenticator RESET pgrst.db_pre_request;
-- NOTIFY pgrst, 'reload config';
