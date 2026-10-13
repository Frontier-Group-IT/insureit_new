-- ONLY if phase 1 registry is confirmed empty and no future changes depend on it.
-- First verify SELECT count(*) FROM public.customer_firebase_identity_links = 0
-- before running this rollback with migration tooling.
DROP TABLE IF EXISTS public.customer_firebase_identity_links;
