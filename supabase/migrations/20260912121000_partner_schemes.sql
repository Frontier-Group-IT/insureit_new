BEGIN;

CREATE TABLE IF NOT EXISTS public.partner_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (btrim(name) <> ''),
  description text,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  target_type text CHECK (target_type IS NULL OR target_type IN ('premium', 'policies', 'custom')),
  target_value numeric CHECK (target_value IS NULL OR target_value >= 0),
  target_label text,
  reward_text text,
  conditions_text text,
  priority integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_schemes_valid_window CHECK (ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.partner_scheme_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scheme_id uuid NOT NULL REFERENCES public.partner_schemes(id) ON DELETE CASCADE,
  partner_id uuid REFERENCES public.partners(id) ON DELETE CASCADE,
  group_id uuid REFERENCES public.intermediary_groups(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_scheme_assignment_one_scope CHECK (
    (partner_id IS NOT NULL AND group_id IS NULL)
    OR (partner_id IS NULL AND group_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS partner_scheme_assignments_partner_unique
  ON public.partner_scheme_assignments (scheme_id, partner_id)
  WHERE partner_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS partner_scheme_assignments_group_unique
  ON public.partner_scheme_assignments (scheme_id, group_id)
  WHERE group_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS partner_schemes_window_idx
  ON public.partner_schemes (is_active, starts_at, ends_at, priority DESC);

CREATE INDEX IF NOT EXISTS partner_scheme_assignments_partner_idx
  ON public.partner_scheme_assignments (partner_id, is_active)
  WHERE partner_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS partner_scheme_assignments_group_idx
  ON public.partner_scheme_assignments (group_id, is_active)
  WHERE group_id IS NOT NULL;

ALTER TABLE public.partner_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_scheme_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.partner_schemes FROM public, anon, authenticated;
REVOKE ALL ON TABLE public.partner_scheme_assignments FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.partner_web_schemes()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  target_type text,
  target_value numeric,
  target_label text,
  reward_text text,
  conditions_text text,
  priority integer,
  status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_partner_ids uuid[] := ARRAY[]::uuid[];
  v_group_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  SELECT s.profile_id, s.partner_ids, s.group_ids
  INTO v_profile_id, v_partner_ids, v_group_ids
  FROM public.partner_app_commercial_scope(auth.uid()) s
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Partner scope unavailable';
  END IF;

  RETURN QUERY
  WITH scoped AS (
    SELECT
      ps.id,
      ps.name,
      ps.description,
      ps.starts_at,
      ps.ends_at,
      ps.target_type,
      ps.target_value,
      ps.target_label,
      ps.reward_text,
      ps.conditions_text,
      ps.priority,
      CASE
        WHEN now() < ps.starts_at THEN 'upcoming'
        WHEN now() >= ps.ends_at THEN 'completed'
        ELSE 'active'
      END AS scheme_status,
      row_number() OVER (
        PARTITION BY ps.id
        ORDER BY (psa.partner_id IS NOT NULL) DESC, psa.created_at ASC
      ) AS assignment_rank
    FROM public.partner_scheme_assignments psa
    JOIN public.partner_schemes ps ON ps.id = psa.scheme_id
    WHERE psa.is_active
      AND ps.is_active
      AND (
        psa.partner_id = ANY(COALESCE(v_partner_ids, ARRAY[]::uuid[]))
        OR psa.group_id = ANY(COALESCE(v_group_ids, ARRAY[]::uuid[]))
      )
  )
  SELECT
    scoped.id,
    scoped.name,
    scoped.description,
    scoped.starts_at,
    scoped.ends_at,
    scoped.target_type,
    scoped.target_value,
    scoped.target_label,
    scoped.reward_text,
    scoped.conditions_text,
    scoped.priority,
    scoped.scheme_status
  FROM scoped
  WHERE scoped.assignment_rank = 1
  ORDER BY
    CASE scoped.scheme_status WHEN 'active' THEN 0 WHEN 'upcoming' THEN 1 ELSE 2 END,
    scoped.priority DESC,
    scoped.starts_at DESC,
    scoped.ends_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.partner_web_active_scheme()
RETURNS TABLE (
  id uuid,
  name text,
  description text,
  starts_at timestamptz,
  ends_at timestamptz,
  target_type text,
  target_value numeric,
  target_label text,
  reward_text text,
  conditions_text text,
  priority integer,
  status text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    schemes.id,
    schemes.name,
    schemes.description,
    schemes.starts_at,
    schemes.ends_at,
    schemes.target_type,
    schemes.target_value,
    schemes.target_label,
    schemes.reward_text,
    schemes.conditions_text,
    schemes.priority,
    schemes.status
  FROM public.partner_web_schemes() schemes
  WHERE schemes.status = 'active'
  ORDER BY schemes.priority DESC, schemes.ends_at ASC
  LIMIT 1;
$$;

ALTER FUNCTION public.partner_web_schemes() OWNER TO postgres;
ALTER FUNCTION public.partner_web_active_scheme() OWNER TO postgres;

REVOKE ALL ON FUNCTION public.partner_web_schemes() FROM public;
REVOKE ALL ON FUNCTION public.partner_web_schemes() FROM anon;
REVOKE ALL ON FUNCTION public.partner_web_active_scheme() FROM public;
REVOKE ALL ON FUNCTION public.partner_web_active_scheme() FROM anon;

GRANT EXECUTE ON FUNCTION public.partner_web_schemes() TO authenticated;
GRANT EXECUTE ON FUNCTION public.partner_web_active_scheme() TO authenticated;

COMMIT;
