-- Phase 3 foundation: canonical new Branches are NOT inserted into public.partners.
-- This is deliberately separate from legacy partner_branch_profiles, whose partner_id remains NOT NULL.
-- Auth / portal cutover is a subsequent gated release. Existing login functions are untouched.
BEGIN;
CREATE TABLE IF NOT EXISTS public.partner_branches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_code text NOT NULL UNIQUE,
  parent_partner_id uuid NOT NULL REFERENCES public.partners(id) ON DELETE RESTRICT,
  branch_name text NOT NULL,
  contact_name text NOT NULL,
  phone text NOT NULL,
  email text NOT NULL,
  address text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
  legacy_branch_profile_id uuid UNIQUE REFERENCES public.partner_branch_profiles(id) ON DELETE RESTRICT,
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT partner_branches_name_valid CHECK (length(btrim(branch_name)) BETWEEN 2 AND 120),
  CONSTRAINT partner_branches_code_valid CHECK (branch_code ~ '^BR[0-9]{5,}$')
);
CREATE INDEX IF NOT EXISTS partner_branches_parent_idx ON public.partner_branches(parent_partner_id);
ALTER TABLE public.partner_branches ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_branches FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.partner_branches TO service_role;

-- Backfill canonical branch records without rewriting legacy IDs or codes.
INSERT INTO public.partner_branches (
  id, branch_code, parent_partner_id, branch_name, contact_name, phone, email,
  address, legacy_branch_profile_id, created_by, created_at, updated_at
)
SELECT b.id, b.branch_code, b.parent_partner_id, b.branch_name, b.contact_name,
       b.phone, b.email, b.address, b.id, b.created_by, b.created_at, b.updated_at
FROM public.partner_branch_profiles b
WHERE b.branch_code IS NOT NULL AND b.parent_partner_id IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Refuse duplicate/misparented data, including id collision conflicts.
DO $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM public.partner_branch_profiles legacy
   LEFT JOIN public.partner_branches canonical ON canonical.legacy_branch_profile_id=legacy.id
   WHERE canonical.id IS DISTINCT FROM legacy.id
      OR canonical.parent_partner_id IS DISTINCT FROM legacy.parent_partner_id
      OR canonical.branch_code IS DISTINCT FROM legacy.branch_code
 ) THEN
    RAISE EXCEPTION 'Canonical Branch backfill mismatch; refusing rollout';
 END IF;
END $$;

CREATE SEQUENCE IF NOT EXISTS public.partner_branch_code_seq AS bigint START WITH 100000;
REVOKE ALL ON SEQUENCE public.partner_branch_code_seq FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SEQUENCE public.partner_branch_code_seq TO service_role;

-- Server-only API: a new Branch belongs to an active ROOT Partner, never becomes a Partner row.
CREATE OR REPLACE FUNCTION public.service_create_canonical_partner_branch(
 p_parent_partner_id uuid,
 p_branch_name text,
 p_contact_name text,
 p_phone text,
 p_email text,
 p_address text,
 p_actor_profile_id uuid
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $fn$
DECLARE v_id uuid; v_code text;
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM public.partners p
   WHERE p.id=p_parent_partner_id AND p.parent_partner_id IS NULL
     AND p.partner_status='active_partner'
     AND NOT EXISTS (SELECT 1 FROM public.partner_branch_profiles b WHERE b.partner_id=p.id)
 ) THEN
   RAISE EXCEPTION 'Active root Partner required';
 END IF;
 IF nullif(btrim(p_branch_name),'') IS NULL OR nullif(btrim(p_contact_name),'') IS NULL
    OR nullif(btrim(p_phone),'') IS NULL OR nullif(btrim(p_email),'') IS NULL
    OR nullif(btrim(p_address),'') IS NULL THEN
   RAISE EXCEPTION 'All Branch contact fields required';
 END IF;
 IF NOT EXISTS (SELECT 1 FROM public.profiles pr WHERE pr.id=p_actor_profile_id AND pr.is_active AND pr.role IN ('super_admin','admin','it_super_user')) THEN
   RAISE EXCEPTION 'Authorized administrator profile required';
 END IF;
 v_code := 'BR' || nextval('public.partner_branch_code_seq')::text;
 INSERT INTO public.partner_branches(
  branch_code,parent_partner_id,branch_name,contact_name,phone,email,address,created_by
 ) VALUES (
  v_code,p_parent_partner_id,btrim(p_branch_name),btrim(p_contact_name),
  btrim(p_phone),lower(btrim(p_email)),btrim(p_address),p_actor_profile_id
 ) RETURNING id INTO v_id;
 RETURN v_id;
END;
$fn$;
REVOKE ALL ON FUNCTION public.service_create_canonical_partner_branch(uuid,text,text,text,text,text,uuid)
 FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.service_create_canonical_partner_branch(uuid,text,text,text,text,text,uuid)
 TO service_role;

-- Login mapping supports either a canonical Branch UUID or a preserved legacy entity UUID.
-- Only service-side code can use it. No user-supplied branch ID grants another Branch's scope.
CREATE TABLE IF NOT EXISTS public.partner_branch_login_links (
 profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE RESTRICT,
 branch_id uuid NOT NULL REFERENCES public.partner_branches(id) ON DELETE RESTRICT,
 status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','disabled')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_branch_login_links_branch_idx
 ON public.partner_branch_login_links(branch_id);
ALTER TABLE public.partner_branch_login_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.partner_branch_login_links FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.partner_branch_login_links TO service_role;

CREATE OR REPLACE FUNCTION public.partner_branch_canonical_access()
RETURNS TABLE(branch_id uuid, parent_partner_id uuid, branch_code text, legacy_partner_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public','auth'
AS $fn$
 WITH authorized_branch AS (
   -- Explicit canonical login link, or existing active Branch login mapped through its
   -- immutable legacy partner ID. The latter keeps old Branch accounts working.
   SELECT l.branch_id
   FROM public.partner_branch_login_links l
   WHERE l.profile_id = auth.uid() AND l.status='active'
   UNION
   SELECT b.id
   FROM public.portal_access_identities a
   JOIN public.partner_branch_profiles legacy ON legacy.partner_id=a.entity_id
   JOIN public.partner_branches b ON b.legacy_branch_profile_id=legacy.id
   WHERE a.profile_id=auth.uid() AND a.entity_type='branch' AND a.status='active'
 ),
 resolved AS (
   SELECT b.id,b.parent_partner_id,b.branch_code,legacy.partner_id
   FROM authorized_branch ab
   JOIN public.partner_branches b ON b.id=ab.branch_id AND b.status='active'
   LEFT JOIN public.partner_branch_profiles legacy ON legacy.id=b.legacy_branch_profile_id
   JOIN public.profiles pr ON pr.id=auth.uid() AND pr.is_active
   JOIN public.partners parent ON parent.id=b.parent_partner_id
     AND parent.parent_partner_id IS NULL AND parent.partner_status='active_partner'
 )
 -- If multiple distinct active Branch links exist, fail closed rather than choose one.
 SELECT r.id,r.parent_partner_id,r.branch_code,r.partner_id
 FROM resolved r
 WHERE (SELECT count(DISTINCT id) FROM resolved)=1
   AND NOT EXISTS (
     SELECT 1 FROM public.portal_access_identities existing
     WHERE existing.profile_id=auth.uid() AND existing.entity_type='branch'
       AND existing.status<>'active'
   );
$fn$;
REVOKE ALL ON FUNCTION public.partner_branch_canonical_access() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.partner_branch_canonical_access() TO authenticated, service_role;
COMMIT;
