-- 2026-10-08: additive Firebase UID binding registry (phase 1 only)
-- Production-safe first stage: no user records, RLS policies, or RPCs changed.
CREATE TABLE public.customer_firebase_identity_links (
  firebase_project_id text NOT NULL,
  firebase_uid text NOT NULL,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  verified_phone_at_approval text NOT NULL,
  approved_at timestamptz,
  is_approved boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (firebase_project_id, firebase_uid),
  CONSTRAINT customer_firebase_identity_one_profile UNIQUE (profile_id),
  CONSTRAINT customer_firebase_uid_nonempty CHECK (length(trim(firebase_uid)) BETWEEN 1 AND 128),
  CONSTRAINT customer_firebase_phone_e164 CHECK (verified_phone_at_approval ~ '^[+]91[6-9][0-9]{9}$'),
  CONSTRAINT customer_firebase_active_requires_approval CHECK (
    NOT is_active OR (is_approved AND approved_at IS NOT NULL)
  )
);
ALTER TABLE public.customer_firebase_identity_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_firebase_identity_links FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.customer_firebase_identity_links FROM PUBLIC, anon, authenticated;
-- No client policies and no grant to client roles. Only controlled privileged
-- administration may create mappings in a future explicitly reviewed phase.
