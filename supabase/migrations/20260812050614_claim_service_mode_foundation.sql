-- Self-managed claim foundation.
-- Additive only: existing claims remain broker-managed and existing policies are not guessed as SIBL/external.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'policy_service_source') THEN
    CREATE TYPE public.policy_service_source AS ENUM ('sibl', 'external');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'claim_service_mode') THEN
    CREATE TYPE public.claim_service_mode AS ENUM ('broker_managed', 'self_managed');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'claim_assistance_status') THEN
    CREATE TYPE public.claim_assistance_status AS ENUM ('not_requested', 'requested', 'accepted', 'declined', 'cancelled');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'claim_milestone_key') THEN
    CREATE TYPE public.claim_milestone_key AS ENUM (
      'spot_intimation',
      'spot_status',
      'claim_intimation',
      'work_approval',
      'repair_ri',
      'billing',
      'delivery_order',
      'vehicle_delivery',
      'payment_encashment'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'claim_milestone_status') THEN
    CREATE TYPE public.claim_milestone_status AS ENUM ('not_started', 'in_progress', 'completed', 'not_applicable');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typnamespace = 'public'::regnamespace AND typname = 'claim_milestone_actor') THEN
    CREATE TYPE public.claim_milestone_actor AS ENUM ('customer', 'sankalp', 'system');
  END IF;
END
$$;

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS policy_service_source public.policy_service_source;

COMMENT ON COLUMN public.policies.policy_service_source IS
  'Explicit policy servicing source. NULL means not yet classified; sibl means serviced by Sankalp/SIBL; external means outside Sankalp/SIBL.';

ALTER TABLE public.claims
  ADD COLUMN IF NOT EXISTS policy_service_source public.policy_service_source,
  ADD COLUMN IF NOT EXISTS claim_service_mode public.claim_service_mode NOT NULL DEFAULT 'broker_managed'::public.claim_service_mode,
  ADD COLUMN IF NOT EXISTS assistance_status public.claim_assistance_status NOT NULL DEFAULT 'not_requested'::public.claim_assistance_status,
  ADD COLUMN IF NOT EXISTS assistance_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS assistance_requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assistance_resolved_at timestamptz,
  ADD COLUMN IF NOT EXISTS assistance_resolved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assistance_notes text,
  ADD COLUMN IF NOT EXISTS self_management_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS self_management_acknowledged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.claims.policy_service_source IS
  'Snapshot of the policy servicing source when the claim is created. External claims can later become broker-managed if Sankalp accepts assistance.';
COMMENT ON COLUMN public.claims.claim_service_mode IS
  'Who owns claim processing: broker_managed = Sankalp/claims desk; self_managed = customer tracking only.';
COMMENT ON COLUMN public.claims.assistance_status IS
  'Separate assistance request lifecycle for self-managed external claims. It is intentionally not a claim service mode.';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.claims'::regclass AND conname = 'claims_self_managed_external_check') THEN
    ALTER TABLE public.claims
      ADD CONSTRAINT claims_self_managed_external_check
      CHECK (
        claim_service_mode <> 'self_managed'::public.claim_service_mode
        OR policy_service_source IS NOT DISTINCT FROM 'external'::public.policy_service_source
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.claims'::regclass AND conname = 'claims_self_managed_acknowledged_check') THEN
    ALTER TABLE public.claims
      ADD CONSTRAINT claims_self_managed_acknowledged_check
      CHECK (
        claim_service_mode <> 'self_managed'::public.claim_service_mode
        OR self_management_acknowledged_at IS NOT NULL
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.claims'::regclass AND conname = 'claims_assistance_accepted_mode_check') THEN
    ALTER TABLE public.claims
      ADD CONSTRAINT claims_assistance_accepted_mode_check
      CHECK (
        assistance_status <> 'accepted'::public.claim_assistance_status
        OR claim_service_mode = 'broker_managed'::public.claim_service_mode
      );
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS policies_policy_service_source_idx
  ON public.policies (policy_service_source);

CREATE INDEX IF NOT EXISTS claims_service_mode_assistance_idx
  ON public.claims (claim_service_mode, assistance_status, current_status);

CREATE TABLE IF NOT EXISTS public.claim_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  milestone_key public.claim_milestone_key NOT NULL,
  milestone_status public.claim_milestone_status NOT NULL DEFAULT 'not_started'::public.claim_milestone_status,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  recorded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  recorded_by_actor public.claim_milestone_actor NOT NULL DEFAULT 'customer'::public.claim_milestone_actor,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT claim_milestones_claim_key_unique UNIQUE (claim_id, milestone_key),
  CONSTRAINT claim_milestones_details_object_check CHECK (jsonb_typeof(details) = 'object'),
  CONSTRAINT claim_milestones_completed_at_check CHECK (
    milestone_status <> 'completed'::public.claim_milestone_status OR completed_at IS NOT NULL
  )
);

COMMENT ON TABLE public.claim_milestones IS
  'Customer-controlled milestones for self-managed claims. Kept separate from operational claim_status/current_status so self-tracked claims do not become OPS queue items.';

CREATE INDEX IF NOT EXISTS claim_milestones_claim_status_idx
  ON public.claim_milestones (claim_id, milestone_status);

DROP TRIGGER IF EXISTS set_claim_milestones_updated_at ON public.claim_milestones;
CREATE TRIGGER set_claim_milestones_updated_at
BEFORE UPDATE ON public.claim_milestones
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.claim_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "claim milestones hierarchy read" ON public.claim_milestones;
CREATE POLICY "claim milestones hierarchy read"
ON public.claim_milestones
FOR SELECT
TO authenticated
USING (public.can_access_claim(auth.uid(), claim_id));

DROP POLICY IF EXISTS "customer can create self managed milestones" ON public.claim_milestones;
CREATE POLICY "customer can create self managed milestones"
ON public.claim_milestones
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_app_role() = 'customer'::public.app_role
  AND recorded_by = auth.uid()
  AND recorded_by_actor = 'customer'::public.claim_milestone_actor
  AND EXISTS (
    SELECT 1
    FROM public.claims claim
    WHERE claim.id = claim_id
      AND claim.claim_service_mode = 'self_managed'::public.claim_service_mode
      AND claim.assistance_status <> 'accepted'::public.claim_assistance_status
      AND public.can_access_claim(auth.uid(), claim.id)
  )
);

DROP POLICY IF EXISTS "customer can update self managed milestones" ON public.claim_milestones;
CREATE POLICY "customer can update self managed milestones"
ON public.claim_milestones
FOR UPDATE
TO authenticated
USING (
  public.current_app_role() = 'customer'::public.app_role
  AND EXISTS (
    SELECT 1
    FROM public.claims claim
    WHERE claim.id = claim_id
      AND claim.claim_service_mode = 'self_managed'::public.claim_service_mode
      AND claim.assistance_status <> 'accepted'::public.claim_assistance_status
      AND public.can_access_claim(auth.uid(), claim.id)
  )
)
WITH CHECK (
  public.current_app_role() = 'customer'::public.app_role
  AND recorded_by = auth.uid()
  AND recorded_by_actor = 'customer'::public.claim_milestone_actor
  AND EXISTS (
    SELECT 1
    FROM public.claims claim
    WHERE claim.id = claim_id
      AND claim.claim_service_mode = 'self_managed'::public.claim_service_mode
      AND claim.assistance_status <> 'accepted'::public.claim_assistance_status
      AND public.can_access_claim(auth.uid(), claim.id)
  )
);
