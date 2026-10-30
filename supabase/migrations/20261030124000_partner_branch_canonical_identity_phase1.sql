-- PHASE 1 ONLY: canonical Branch metadata alongside legacy Branch-as-Partner references.
-- No policy, payout, portal login, partner, or financial records are updated or deleted.
-- Do NOT switch authorization to this mapping until Phase 2 code and isolation tests are ready.
BEGIN;
ALTER TABLE public.partner_branch_profiles
  ADD COLUMN IF NOT EXISTS branch_code text,
  ADD COLUMN IF NOT EXISTS parent_partner_id uuid REFERENCES public.partners(id) ON DELETE RESTRICT;

-- Existing canonical branch UUID is partner_branch_profiles.id.
-- Stable, distinct branch codes are derived from historical codes WITHOUT modifying them.
UPDATE public.partner_branch_profiles b
SET branch_code = 'BR' || substring(p.partner_code from 3),
    parent_partner_id = p.parent_partner_id
FROM public.partners p
WHERE p.id = b.partner_id
  AND p.partner_code ~ '^PT[0-9]+$'
  AND b.branch_code IS NULL
  AND b.parent_partner_id IS NULL;

-- Do not silently accept an orphan or unrecognised legacy Branch.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.partner_branch_profiles b
    LEFT JOIN public.partners legacy ON legacy.id=b.partner_id
    LEFT JOIN public.partners parent ON parent.id=b.parent_partner_id
    WHERE b.branch_code IS NULL OR b.parent_partner_id IS NULL
       OR legacy.id IS NULL
       OR legacy.parent_partner_id IS DISTINCT FROM b.parent_partner_id
       OR parent.id IS NULL OR parent.parent_partner_id IS NOT NULL
       OR EXISTS (SELECT 1 FROM public.partner_branch_profiles pb WHERE pb.partner_id=parent.id)
  ) THEN
    RAISE EXCEPTION 'Branch hierarchy reconciliation failed: refusing incomplete backfill';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS partner_branch_profiles_branch_code_unique
  ON public.partner_branch_profiles(branch_code);
CREATE INDEX IF NOT EXISTS partner_branch_profiles_parent_partner_id_idx
  ON public.partner_branch_profiles(parent_partner_id);

-- A read-only internal mapping supports later conversion without mutating historical policy codes.
CREATE OR REPLACE VIEW public.partner_branch_legacy_mapping
WITH (security_invoker = true)
AS SELECT b.id AS branch_id, b.branch_code, b.parent_partner_id,
          b.partner_id AS legacy_partner_id, legacy.partner_code AS legacy_partner_code,
          b.branch_name
   FROM public.partner_branch_profiles b
   JOIN public.partners legacy ON legacy.id=b.partner_id;
REVOKE ALL ON public.partner_branch_legacy_mapping FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.partner_branch_legacy_mapping TO service_role;
COMMIT;
