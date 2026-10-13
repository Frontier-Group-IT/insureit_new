-- Customer Firebase read-only coverage for the Customer App home/dashboard.
-- Additive SELECT policies; existing Supabase login/staff grants remain unchanged.
-- Uses the approved Firebase UID -> canonical customer profile resolver.
CREATE POLICY firebase_customer_external_policies_select
ON public.external_policies FOR SELECT TO authenticated
USING (public.customer_firebase_can_read_customer(customer_id));

CREATE POLICY firebase_customer_claim_tasks_select
ON public.claim_tasks FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.claims c
  WHERE c.id = claim_tasks.claim_id
    AND public.customer_firebase_can_read_customer(c.customer_id)
));

CREATE POLICY firebase_customer_claim_financials_select
ON public.claim_financials FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.claims c
  WHERE c.id = claim_financials.claim_id
    AND public.customer_firebase_can_read_customer(c.customer_id)
));

CREATE POLICY firebase_customer_policy_documents_select
ON public.policy_documents FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.policies p
  WHERE p.id = policy_documents.policy_id
    AND public.customer_firebase_can_read_customer(p.customer_id)
));
