-- REVIEW ONLY: additional scoped Firebase customer reads.
-- Requires: verified Firebase JWT, approved binding, and resolution of
-- auth.uid() throwing on Firebase non-UUID subjects.
-- Does not allow writes or expose mappings.
--
-- Claim documents must belong to an accessible customer AND an existing
-- claim for that same customer. Avoid trusting only the document customer_id.
CREATE POLICY firebase_customer_claim_documents_select
ON public.claim_documents FOR SELECT TO authenticated
USING (
  public.customer_firebase_can_read_customer(customer_id)
  AND EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.id = claim_id AND c.customer_id = claim_documents.customer_id
  )
);

-- Existing onboarding applications/documents remain scoped to their canonical
-- applicant profile, never an arbitrary Firebase UID.
CREATE POLICY firebase_customer_onboarding_applications_select
ON public.customer_onboarding_applications FOR SELECT TO authenticated
USING (
  profile_id = (SELECT public.customer_firebase_profile_id())
  AND source = 'customer_app'
);

CREATE POLICY firebase_customer_onboarding_documents_select
ON public.customer_onboarding_documents FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.customer_onboarding_applications a
    WHERE a.id = customer_onboarding_documents.application_id
      AND a.profile_id = (SELECT public.customer_firebase_profile_id())
      AND a.source = 'customer_app'
  )
);
