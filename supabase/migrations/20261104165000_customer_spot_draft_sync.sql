-- Persist unsubmitted Spot Intimation fields for internal and external claims.
-- This is a draft ONLY: the existing claims status and milestones are not advanced.
CREATE TABLE IF NOT EXISTS public.claim_spot_intimation_drafts (
  claim_id uuid PRIMARY KEY REFERENCES public.claims(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  fields jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT claim_spot_intimation_drafts_fields_object CHECK (jsonb_typeof(fields) = 'object'),
  CONSTRAINT claim_spot_intimation_drafts_size CHECK (octet_length(fields::text) <= 5000)
);

CREATE INDEX IF NOT EXISTS claim_spot_intimation_drafts_customer_idx
  ON public.claim_spot_intimation_drafts(customer_id);

ALTER TABLE public.claim_spot_intimation_drafts ENABLE ROW LEVEL SECURITY;

-- A customer may read only their own claim's draft. Operations reads through its
-- existing authorized server-side claim detail page and service-role client.
CREATE POLICY "claim spot draft customer read"
ON public.claim_spot_intimation_drafts FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.id = claim_spot_intimation_drafts.claim_id AND c.customer_id = claim_spot_intimation_drafts.customer_id
      AND public.can_access_claim((SELECT auth.uid()), c.id)
  )
);

-- Draft writes may not alter a claim that has left Draft status.
CREATE POLICY "claim spot draft customer insert"
ON public.claim_spot_intimation_drafts FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.id = claim_spot_intimation_drafts.claim_id AND c.customer_id = claim_spot_intimation_drafts.customer_id
      AND c.current_status = 'Draft'
      AND public.can_access_claim((SELECT auth.uid()), c.id)
  )
);
CREATE POLICY "claim spot draft customer update"
ON public.claim_spot_intimation_drafts FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.id = claim_spot_intimation_drafts.claim_id AND c.customer_id = claim_spot_intimation_drafts.customer_id
      AND c.current_status = 'Draft'
      AND public.can_access_claim((SELECT auth.uid()), c.id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.claims c
    WHERE c.id = claim_spot_intimation_drafts.claim_id AND c.customer_id = claim_spot_intimation_drafts.customer_id
      AND c.current_status = 'Draft'
      AND public.can_access_claim((SELECT auth.uid()), c.id)
  )
);
GRANT SELECT, INSERT, UPDATE ON public.claim_spot_intimation_drafts TO authenticated;
COMMENT ON TABLE public.claim_spot_intimation_drafts IS 'Customer-unsubmitted Spot Intimation fields; never treated as a completed claim stage.';
