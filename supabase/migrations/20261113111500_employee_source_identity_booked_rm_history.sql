-- Employee/source identity reconciliation: immutable booked RM, mutable display identity.
-- Apply only through the approved production migration process, before deploying the web changes.
-- No historic RM reassignment is performed by this migration.
BEGIN;

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS source_intermediary_id uuid
  REFERENCES public.intermediaries(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS policies_source_intermediary_id_idx
  ON public.policies(source_intermediary_id);
-- A small number of historical Partner policies have no intermediary register row.
-- Retain their real parent Partner UUID instead of inventing an intermediary.
ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS source_partner_id uuid
  REFERENCES public.partners(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS policies_source_partner_id_idx
  ON public.policies(source_partner_id);

-- A canonical HR code is separate from the legacy 'associate_id' used by external integrations.
ALTER TABLE public.posp_misp_onboarding_profiles
  ADD COLUMN IF NOT EXISTS associate_employee_code text;

-- A restricted snapshot of fields modified during this deployment, not complete PII rows.
CREATE SCHEMA IF NOT EXISTS identity_maintenance;
REVOKE ALL ON SCHEMA identity_maintenance FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS identity_maintenance.employee_source_sync_backup_20261113 (
  table_name text NOT NULL,
  record_id uuid NOT NULL,
  previous_values jsonb NOT NULL,
  captured_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(table_name, record_id)
);
REVOKE ALL ON ALL TABLES IN SCHEMA identity_maintenance FROM PUBLIC, anon, authenticated;

INSERT INTO identity_maintenance.employee_source_sync_backup_20261113(table_name,record_id,previous_values)
SELECT 'policies',p.id,jsonb_build_object(
  'rm_employee_id',p.rm_employee_id,'rm_name',p.rm_name,
  'intermediary_code',p.intermediary_code,'lead_source',p.lead_source,
  'source_intermediary_id',p.source_intermediary_id,'source_partner_id',p.source_partner_id,
  'intermediary_group_id',p.intermediary_group_id,
  'intermediary_group_code',p.intermediary_group_code,
  'intermediary_group_name',p.intermediary_group_name)
FROM public.policies p ON CONFLICT DO NOTHING;

INSERT INTO identity_maintenance.employee_source_sync_backup_20261113(table_name,record_id,previous_values)
SELECT 'life_health_cases',c.id,jsonb_build_object(
  'rm_employee_id',c.rm_employee_id,'rm_name',c.rm_name,'rm_code',c.rm_code,
  'intermediary_id',c.intermediary_id,'intermediary_code',c.intermediary_code,
  'lead_source',c.lead_source)
FROM public.life_health_cases c ON CONFLICT DO NOTHING;

INSERT INTO identity_maintenance.employee_source_sync_backup_20261113(table_name,record_id,previous_values)
SELECT 'posp_misp_onboarding_profiles',o.id,jsonb_build_object(
 'associate_employee_id',o.associate_employee_id,'associate_profile_id',o.associate_profile_id,
 'associate_name',o.associate_name,'associate_id',o.associate_id,
 'associate_employee_code',o.associate_employee_code)
FROM public.posp_misp_onboarding_profiles o ON CONFLICT DO NOTHING;

INSERT INTO identity_maintenance.employee_source_sync_backup_20261113(table_name,record_id,previous_values)
SELECT 'intermediary_onboarding_applications',a.id,jsonb_build_object(
  'associate_employee_id',a.draft_data->'associate_employee_id',
  'associate_name',a.draft_data->'associate_name',
  'associate_id',a.draft_data->'associate_id',
  'associate_employee_code',a.draft_data->'associate_employee_code')
FROM public.intermediary_onboarding_applications a
WHERE a.draft_data ? 'associate_employee_id'
ON CONFLICT DO NOTHING;

INSERT INTO identity_maintenance.employee_source_sync_backup_20261113(table_name,record_id,previous_values)
SELECT 'policy_intake_requests',r.id,jsonb_build_object(
 'lead_source_id',r.lead_source_id,'lead_source_code',r.lead_source_code,
 'lead_source_name',r.lead_source_name)
FROM public.policy_intake_requests r ON CONFLICT DO NOTHING;

INSERT INTO identity_maintenance.employee_source_sync_backup_20261113(table_name,record_id,previous_values)
SELECT 'profiles',p.id,jsonb_build_object(
 'employee_id',p.employee_id,'employee_code',p.employee_code,
 'full_name',p.full_name,'phone',p.phone,'email',p.email,
 'department',p.department,'designation',p.designation)
FROM public.profiles p WHERE p.employee_id IS NOT NULL ON CONFLICT DO NOTHING;

INSERT INTO identity_maintenance.employee_source_sync_backup_20261113(table_name,record_id,previous_values)
SELECT 'employees',e.id,jsonb_build_object(
 'employee_code',e.employee_code,'full_name',e.full_name,
 'reporting_manager_id',e.reporting_manager_id,
 'reporting_manager_employee_code',e.reporting_manager_employee_code)
FROM public.employees e ON CONFLICT DO NOTHING;

-- Transaction-local, non-PII signatures reject unrelated trigger side effects.
-- A migration that changes bank, PAN, compliance, documents, workflow, finance,
-- group membership or audit facts must roll back rather than silently proceed.
CREATE TEMP TABLE identity_sync_before_guard ON COMMIT DROP AS
SELECT 'policies'::text dataset,id,md5((to_jsonb(t)-ARRAY['source_intermediary_id','source_partner_id','rm_name','intermediary_code','lead_source','updated_at'])::text) fingerprint FROM public.policies t
UNION ALL SELECT 'life_health_cases',id,md5((to_jsonb(t)-ARRAY['rm_name','rm_code','intermediary_code','lead_source','updated_at'])::text) FROM public.life_health_cases t
UNION ALL SELECT 'posp_misp_onboarding_profiles',id,md5((to_jsonb(t)-ARRAY['associate_name','associate_employee_code','updated_at','updated_by'])::text) FROM public.posp_misp_onboarding_profiles t
UNION ALL SELECT 'intermediary_onboarding_applications',id,md5(((to_jsonb(t)-ARRAY['draft_data','updated_at']) ||
  jsonb_build_object('draft_preserved',COALESCE(t.draft_data,'{}'::jsonb)-'associate_name'-'associate_employee_code'))::text) FROM public.intermediary_onboarding_applications t
UNION ALL SELECT 'policy_intake_requests',id,md5((to_jsonb(t)-ARRAY['lead_source_code','lead_source_name','updated_at'])::text) FROM public.policy_intake_requests t
UNION ALL SELECT 'profiles',id,md5((to_jsonb(t)-ARRAY['full_name','employee_code','phone','email','department','designation','updated_at'])::text) FROM public.profiles t
UNION ALL SELECT 'employees',id,md5((to_jsonb(t)-ARRAY['reporting_manager_employee_code','updated_at'])::text) FROM public.employees t
UNION ALL SELECT 'intermediaries',id,md5((to_jsonb(t)-ARRAY['updated_at','updated_by'])::text) FROM public.intermediaries t
UNION ALL SELECT 'partners',id,md5((to_jsonb(t)-ARRAY['updated_at'])::text) FROM public.partners t
UNION ALL SELECT 'intermediary_onboarding_contacts',id,md5(to_jsonb(t)::text) FROM public.intermediary_onboarding_contacts t
UNION ALL SELECT 'intermediary_onboarding_documents',id,md5(to_jsonb(t)::text) FROM public.intermediary_onboarding_documents t
UNION ALL SELECT 'pan_verification_jobs',id,md5(to_jsonb(t)::text) FROM public.pan_verification_jobs t
UNION ALL SELECT 'intermediary_group_memberships',id,md5(to_jsonb(t)::text) FROM public.intermediary_group_memberships t;

-- Do not run Motor cover-validity recalculation when only identity labels
-- or source UUID metadata change. Existing cover/business edit behavior remains.
DO $scope_policy_cover_trigger$
DECLARE v_cols text; v_definition text; v_updated text;
BEGIN
  SELECT string_agg(quote_ident(column_name),', ' ORDER BY ordinal_position)
    INTO v_cols FROM information_schema.columns
  WHERE table_schema='public' AND table_name='policies'
    AND column_name NOT IN ('rm_name','intermediary_code','lead_source',
      'source_intermediary_id','source_partner_id','updated_at');

  SELECT pg_get_triggerdef(t.oid) INTO v_definition FROM pg_trigger t
  WHERE t.tgrelid='public.policies'::regclass
    AND t.tgname='trg_sync_motor_policy_cover_validities'
    AND NOT t.tgisinternal;
  IF v_definition IS NULL OR POSITION('BEFORE INSERT OR UPDATE ON' IN v_definition)=0 THEN
    RAISE EXCEPTION 'Unexpected Motor cover trigger scope; reviewed migration required';
  END IF;
  v_updated:=REPLACE(v_definition,'BEFORE INSERT OR UPDATE ON',
     'BEFORE INSERT OR UPDATE OF '||v_cols||' ON');
  DROP TRIGGER trg_sync_motor_policy_cover_validities ON public.policies;
  EXECUTE v_updated;
END;
$scope_policy_cover_trigger$;

-- A name/code correction is NOT a source transfer. Even changing a policy's
-- source code must never infer a new booked RM from today's partner owner.
CREATE OR REPLACE FUNCTION public.sync_policy_rm_employee_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_employee_id uuid;
  v_employee_name text;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.rm_employee_id IS NOT NULL AND
       (NEW.rm_employee_id IS DISTINCT FROM OLD.rm_employee_id OR
        NEW.rm_name IS DISTINCT FROM OLD.rm_name) THEN
      SELECT e.full_name INTO v_employee_name
      FROM public.employees e WHERE e.id = NEW.rm_employee_id;
      IF v_employee_name IS NOT NULL THEN NEW.rm_name := v_employee_name; END IF;
    END IF;
    -- Crucial: changing intermediary_code, source_intermediary_id or lead_source
    -- never reassigns rm_employee_id. Explicit RM changes remain explicit.
    RETURN NEW;
  END IF;

  IF NEW.rm_employee_id IS NOT NULL THEN
    SELECT e.full_name INTO v_employee_name FROM public.employees e WHERE e.id = NEW.rm_employee_id;
    IF v_employee_name IS NOT NULL THEN NEW.rm_name := v_employee_name; END IF;
    RETURN NEW;
  END IF;

  -- New bookings inherit the currently assigned employee once, at creation.
  SELECT CASE WHEN o.application_id IS NOT NULL THEN o.associate_employee_id ELSE i.associate_employee_id END,e.full_name
    INTO v_employee_id,v_employee_name
  FROM public.intermediaries i
  LEFT JOIN public.posp_misp_onboarding_profiles o ON o.application_id=i.application_id
  LEFT JOIN public.employees e ON e.id=CASE WHEN o.application_id IS NOT NULL THEN o.associate_employee_id ELSE i.associate_employee_id END
  WHERE (NEW.source_intermediary_id IS NOT NULL AND i.id=NEW.source_intermediary_id)
     OR (NEW.source_intermediary_id IS NULL AND i.intermediary_code=NEW.intermediary_code)
  ORDER BY (i.id=NEW.source_intermediary_id) DESC, i.updated_at DESC NULLS LAST
  LIMIT 1;
  IF v_employee_id IS NOT NULL THEN NEW.rm_employee_id := v_employee_id; END IF;
  IF v_employee_name IS NOT NULL THEN NEW.rm_name := v_employee_name; END IF;
  RETURN NEW;
END;
$$;

-- A policy source is an immutable intermediary UUID; a corrected code is a label.
-- Resolve the UUID when a source is first chosen. A later code correction must
-- preserve a matching UUID; a user explicitly choosing another code can change it.
CREATE OR REPLACE FUNCTION public.set_policy_source_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_id uuid;
  v_code text;
  v_name text;
  v_partner_id uuid;
BEGIN
  IF NULLIF(BTRIM(COALESCE(NEW.intermediary_code,'')),'') IS NULL THEN
    IF TG_OP = 'UPDATE' THEN
      IF NEW.intermediary_code IS DISTINCT FROM OLD.intermediary_code THEN
        NEW.source_intermediary_id := NULL;
        NEW.source_partner_id := NULL;
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.source_partner_id IS NOT NULL AND NEW.source_intermediary_id IS NULL THEN
    SELECT partner_code,display_name INTO v_code,v_name
      FROM public.partners WHERE id=NEW.source_partner_id;
    IF v_code=NEW.intermediary_code THEN
      IF v_name IS NOT NULL THEN NEW.lead_source:=v_name; END IF;
      RETURN NEW;
    END IF;
  END IF;

  IF NEW.source_intermediary_id IS NOT NULL THEN
    SELECT intermediary_code INTO v_code FROM public.intermediaries WHERE id=NEW.source_intermediary_id;
    IF v_code=NEW.intermediary_code THEN
      SELECT display_name INTO v_name FROM public.intermediaries WHERE id=NEW.source_intermediary_id;
      IF v_name IS NOT NULL THEN NEW.lead_source := v_name; END IF;
      RETURN NEW;
    END IF;
  END IF;

  SELECT id INTO v_id FROM public.intermediaries
    WHERE intermediary_code=NEW.intermediary_code ORDER BY id LIMIT 1;
  IF v_id IS NOT NULL THEN
    NEW.source_intermediary_id := v_id;
    NEW.source_partner_id := NULL;
    SELECT display_name INTO v_name FROM public.intermediaries WHERE id=v_id;
    IF v_name IS NOT NULL THEN NEW.lead_source := v_name; END IF;
  ELSIF TG_OP='INSERT' THEN
    NEW.source_intermediary_id := NULL;
  ELSIF NEW.intermediary_code IS DISTINCT FROM OLD.intermediary_code THEN
    -- Do not attach a different entity on an unrecognized intermediary code.
    NEW.source_intermediary_id := NULL;
  END IF;

  IF NEW.source_intermediary_id IS NULL THEN
    SELECT id,display_name INTO v_partner_id,v_name
      FROM public.partners WHERE partner_code=NEW.intermediary_code ORDER BY id LIMIT 1;
    IF v_partner_id IS NOT NULL THEN
      NEW.source_partner_id:=v_partner_id;
      IF v_name IS NOT NULL THEN NEW.lead_source:=v_name; END IF;
    ELSIF TG_OP='INSERT' THEN
      NEW.source_partner_id:=NULL;
    ELSIF NEW.intermediary_code IS DISTINCT FROM OLD.intermediary_code THEN
      NEW.source_partner_id:=NULL;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS a_set_policy_source_identity ON public.policies;
CREATE TRIGGER a_set_policy_source_identity
BEFORE INSERT OR UPDATE OF intermediary_code,source_intermediary_id,source_partner_id
ON public.policies FOR EACH ROW EXECUTE FUNCTION public.set_policy_source_identity();

-- Group fields are booking-time snapshots as well. Never recalculate them
-- merely because a source identifier has been corrected later.
DROP TRIGGER IF EXISTS sync_policy_intermediary_group_snapshot_trigger ON public.policies;
CREATE TRIGGER sync_policy_intermediary_group_snapshot_trigger
BEFORE INSERT ON public.policies FOR EACH ROW
EXECUTE FUNCTION public.sync_policy_intermediary_group_snapshot();

-- Partner/POSP/MISP name/code identity corrections propagate to current labels,
-- never to policy/case RM ownership or audit actors.
CREATE OR REPLACE FUNCTION public.sync_intermediary_identity_labels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.intermediary_code IS NOT DISTINCT FROM OLD.intermediary_code
    AND NEW.display_name IS NOT DISTINCT FROM OLD.display_name THEN RETURN NEW; END IF;

  UPDATE public.policies p
     SET intermediary_code=NEW.intermediary_code, lead_source=NEW.display_name
   WHERE p.source_intermediary_id=NEW.id
     AND (p.intermediary_code IS DISTINCT FROM NEW.intermediary_code
       OR p.lead_source IS DISTINCT FROM NEW.display_name);

  UPDATE public.life_health_cases c
     SET intermediary_code=NEW.intermediary_code, lead_source=NEW.display_name
   WHERE c.intermediary_id=NEW.id
     AND (c.intermediary_code IS DISTINCT FROM NEW.intermediary_code
       OR c.lead_source IS DISTINCT FROM NEW.display_name);

  UPDATE public.policy_intake_requests r
     SET lead_source_code=NEW.intermediary_code, lead_source_name=NEW.display_name
   WHERE r.lead_source_id=NEW.id
     AND (r.lead_source_code IS DISTINCT FROM NEW.intermediary_code
       OR r.lead_source_name IS DISTINCT FROM NEW.display_name);
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_intermediary_identity_labels ON public.intermediaries;
CREATE TRIGGER trg_sync_intermediary_identity_labels
AFTER UPDATE OF intermediary_code, display_name ON public.intermediaries
FOR EACH ROW EXECUTE FUNCTION public.sync_intermediary_identity_labels();

-- If the Partner master is the editing entrypoint, bring its matching Partner
-- intermediary forward. Do not apply the Partner's identity to child POSP codes.
CREATE OR REPLACE FUNCTION public.sync_partner_master_identity_to_intermediary()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.partner_code IS DISTINCT FROM OLD.partner_code
     OR NEW.display_name IS DISTINCT FROM OLD.display_name THEN
    UPDATE public.policies p
       SET intermediary_code=NEW.partner_code,lead_source=NEW.display_name
     WHERE p.source_partner_id=NEW.id
       AND (p.intermediary_code IS DISTINCT FROM NEW.partner_code
         OR p.lead_source IS DISTINCT FROM NEW.display_name);

    UPDATE public.intermediaries i
       SET intermediary_code=NEW.partner_code,display_name=NEW.display_name
     WHERE i.application_id=NEW.source_application_id
       AND i.intermediary_type='partner'
       AND (i.intermediary_code IS DISTINCT FROM NEW.partner_code
         OR i.display_name IS DISTINCT FROM NEW.display_name);
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_partner_master_identity_to_intermediary ON public.partners;
CREATE TRIGGER trg_sync_partner_master_identity_to_intermediary
AFTER UPDATE OF partner_code, display_name ON public.partners
FOR EACH ROW EXECUTE FUNCTION public.sync_partner_master_identity_to_intermediary();

-- The Employee Master is authoritative; update profile and booked-RM display
-- values by UUID. Never re-resolve business ownership through today's RM.
-- Legacy associate_id is retained, and a separate current HR code is populated.
CREATE OR REPLACE FUNCTION public.sync_employee_canonical_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  UPDATE public.profiles p
     SET full_name=NEW.full_name,employee_code=NEW.employee_code,
         phone=NEW.phone,email=NEW.email,
         department=NEW.department,designation=NEW.designation
   WHERE p.employee_id=NEW.id
     AND (p.full_name,p.employee_code,p.phone,p.email,p.department,p.designation)
         IS DISTINCT FROM
         (NEW.full_name,NEW.employee_code,NEW.phone,NEW.email,NEW.department,NEW.designation);

  IF NEW.full_name IS DISTINCT FROM OLD.full_name
     OR NEW.employee_code IS DISTINCT FROM OLD.employee_code THEN
    UPDATE public.policies p SET rm_name=NEW.full_name
     WHERE p.rm_employee_id=NEW.id AND p.rm_name IS DISTINCT FROM NEW.full_name;

    UPDATE public.life_health_cases c
       SET rm_name=NEW.full_name,rm_code=NEW.employee_code
     WHERE c.rm_employee_id=NEW.id
       AND (c.rm_name IS DISTINCT FROM NEW.full_name
         OR c.rm_code IS DISTINCT FROM NEW.employee_code);

    UPDATE public.posp_misp_onboarding_profiles o
       SET associate_name=NEW.full_name,associate_employee_code=NEW.employee_code
     WHERE o.associate_employee_id=NEW.id
       AND (o.associate_name IS DISTINCT FROM NEW.full_name
         OR o.associate_employee_code IS DISTINCT FROM NEW.employee_code);

    UPDATE public.intermediary_onboarding_applications a
       SET draft_data=COALESCE(a.draft_data,'{}'::jsonb) ||
           jsonb_build_object('associate_name',NEW.full_name,
                              'associate_employee_code',NEW.employee_code)
     WHERE EXISTS (SELECT 1 FROM public.posp_misp_onboarding_profiles o
                   WHERE o.application_id=a.id AND o.associate_employee_id=NEW.id)
       AND (a.draft_data->>'associate_name' IS DISTINCT FROM NEW.full_name
         OR a.draft_data->>'associate_employee_code' IS DISTINCT FROM NEW.employee_code);

    UPDATE public.employees report
       SET reporting_manager_employee_code=NEW.employee_code
     WHERE report.reporting_manager_id=NEW.id
       AND report.reporting_manager_employee_code IS DISTINCT FROM NEW.employee_code;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_sync_policy_rm_name_on_employee_update ON public.employees;
DROP TRIGGER IF EXISTS trg_sync_employee_canonical_identity ON public.employees;
CREATE TRIGGER trg_sync_employee_canonical_identity
AFTER UPDATE OF full_name,employee_code,phone,email,department,designation
ON public.employees FOR EACH ROW EXECUTE FUNCTION public.sync_employee_canonical_identity();

-- Guard new onboarding selections against hand-written code/name aliases.
CREATE OR REPLACE FUNCTION public.canonicalize_onboarding_employee_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_full_name text; v_code text;
BEGIN
  IF NEW.associate_employee_id IS NULL THEN RETURN NEW; END IF;
  SELECT full_name,employee_code INTO v_full_name,v_code FROM public.employees
    WHERE id=NEW.associate_employee_id;
  IF v_full_name IS NOT NULL THEN
    NEW.associate_name := v_full_name;
    NEW.associate_employee_code := v_code;
  END IF;
  -- Legacy associate_id is intentionally not overwritten.
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS a_canonicalize_onboarding_employee_identity ON public.posp_misp_onboarding_profiles;
CREATE TRIGGER a_canonicalize_onboarding_employee_identity
BEFORE INSERT OR UPDATE OF associate_employee_id,associate_name,associate_employee_code
ON public.posp_misp_onboarding_profiles FOR EACH ROW
EXECUTE FUNCTION public.canonicalize_onboarding_employee_identity();

-- Canonicalize new case displays from the booked employee and selected source UUID.
-- This does not assign/change any RM; the UUID stored at booking remains immutable.
CREATE OR REPLACE FUNCTION public.canonicalize_case_identity_labels()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $
DECLARE v_rm_name text; v_rm_code text; v_source_name text; v_source_code text;
BEGIN
  IF NEW.rm_employee_id IS NOT NULL THEN
    SELECT full_name,employee_code INTO v_rm_name,v_rm_code
    FROM public.employees WHERE id=NEW.rm_employee_id;
    IF v_rm_name IS NOT NULL THEN
      NEW.rm_name:=v_rm_name; NEW.rm_code:=v_rm_code;
    END IF;
  END IF;
  IF NEW.intermediary_id IS NOT NULL THEN
    SELECT display_name,intermediary_code INTO v_source_name,v_source_code
    FROM public.intermediaries WHERE id=NEW.intermediary_id;
    IF v_source_name IS NOT NULL THEN
      NEW.lead_source:=v_source_name;
      NEW.intermediary_code:=v_source_code;
    END IF;
  END IF;
  RETURN NEW;
END;
$;
DROP TRIGGER IF EXISTS a_canonicalize_case_identity_labels ON public.life_health_cases;
CREATE TRIGGER a_canonicalize_case_identity_labels
BEFORE INSERT OR UPDATE OF rm_employee_id,rm_name,rm_code,intermediary_id,intermediary_code,lead_source
ON public.life_health_cases FOR EACH ROW
EXECUTE FUNCTION public.canonicalize_case_identity_labels();

-- Intake source ID is stable even if its display name or external code changes.
CREATE OR REPLACE FUNCTION public.canonicalize_intake_source_identity()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $
DECLARE v_name text; v_code text;
BEGIN
  IF NEW.lead_source_id IS NOT NULL THEN
    SELECT display_name,intermediary_code INTO v_name,v_code
    FROM public.intermediaries WHERE id=NEW.lead_source_id;
    IF v_name IS NOT NULL THEN
      NEW.lead_source_name:=v_name; NEW.lead_source_code:=v_code;
    END IF;
  END IF;
  RETURN NEW;
END;
$;
DROP TRIGGER IF EXISTS a_canonicalize_intake_source_identity ON public.policy_intake_requests;
CREATE TRIGGER a_canonicalize_intake_source_identity
BEFORE INSERT OR UPDATE OF lead_source_id,lead_source_name,lead_source_code
ON public.policy_intake_requests FOR EACH ROW
EXECUTE FUNCTION public.canonicalize_intake_source_identity();

-- Existing generic AFTER UPDATE onboarding triggers also synchronize PAN, bank,
-- child profiles, registration, and group data. An employee-name or *official*
-- HR-code correction must NEVER execute those business workflows.
-- Keep the full existing behavior for owner changes / regular onboarding edits;
-- make only canonical associate-name and associate-employee-code edits inert.
DO $scope_onboarding_triggers$
DECLARE
  v_cols text;
  v_name text;
  v_definition text;
  v_updated text;
BEGIN
  -- Only three triggers react to associate-name-only updates. Keep each
  -- column-specific trigger's original event list except associate_name;
  -- do not broaden PAN/compliance/application triggers to every column.
  SELECT string_agg(quote_ident(column_name),', ' ORDER BY ordinal_position)
    INTO v_cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='posp_misp_onboarding_profiles'
    AND column_name NOT IN ('associate_name','associate_employee_code','updated_at','updated_by');

  FOREACH v_name IN ARRAY ARRAY[
    'intermediary_profile_sync_shared_identity',
    'trg_sync_partner_details_to_linked_accounts',
    'trg_sync_posp_misp_profile_to_intermediary'
  ] LOOP
    SELECT pg_get_triggerdef(t.oid) INTO v_definition
    FROM pg_trigger t
    WHERE t.tgrelid='public.posp_misp_onboarding_profiles'::regclass
      AND t.tgname=v_name AND NOT t.tgisinternal;

    IF v_definition IS NULL THEN
      RAISE EXCEPTION 'Missing onboarding trigger %; inspect before migration',v_name;
    END IF;

    IF v_name='trg_sync_posp_misp_profile_to_intermediary' THEN
      IF POSITION('AFTER INSERT OR UPDATE ON' IN v_definition)=0 THEN
        RAISE EXCEPTION 'Unexpected generic onboarding trigger scope %: %',v_name,v_definition;
      END IF;
      v_updated:=REPLACE(v_definition,'AFTER INSERT OR UPDATE ON',
        'AFTER INSERT OR UPDATE OF '||v_cols||' ON');
    ELSE
      IF POSITION(' UPDATE OF ' IN v_definition)=0
         OR POSITION('associate_name, ' IN v_definition)=0 THEN
        RAISE EXCEPTION 'Unexpected column-specific onboarding trigger scope %: %',v_name,v_definition;
      END IF;
      v_updated:=REPLACE(v_definition,'associate_name, ','');
    END IF;
    EXECUTE format('DROP TRIGGER %I ON public.posp_misp_onboarding_profiles',v_name);
    EXECUTE v_updated;
  END LOOP;
END;
$scope_onboarding_triggers$;

-- Trigger bodies need to update UUID-linked dependent tables atomically even when
-- the editor cannot edit those tables directly. Do not expose these definer
-- functions as callable public RPCs; only the registered triggers invoke them.
REVOKE ALL ON FUNCTION public.sync_policy_rm_employee_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_policy_source_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_intermediary_identity_labels() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_partner_master_identity_to_intermediary() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_employee_canonical_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.canonicalize_onboarding_employee_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.canonicalize_case_identity_labels() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.canonicalize_intake_source_identity() FROM PUBLIC, anon, authenticated;

-- The migration is conditional on existing UUIDs, never on matching two names.
UPDATE public.policies p SET source_intermediary_id=i.id
FROM public.intermediaries i
WHERE p.source_intermediary_id IS NULL AND p.source_partner_id IS NULL
  AND p.intermediary_code=i.intermediary_code;

UPDATE public.policies p SET source_partner_id=pm.id
FROM public.partners pm
WHERE p.source_partner_id IS NULL AND p.source_intermediary_id IS NULL
  AND p.intermediary_code=pm.partner_code;

UPDATE public.policies p SET rm_name=e.full_name FROM public.employees e
 WHERE p.rm_employee_id=e.id AND p.rm_name IS DISTINCT FROM e.full_name;

UPDATE public.life_health_cases c SET rm_name=e.full_name,rm_code=e.employee_code
FROM public.employees e WHERE c.rm_employee_id=e.id
 AND (c.rm_name IS DISTINCT FROM e.full_name OR c.rm_code IS DISTINCT FROM e.employee_code);

UPDATE public.posp_misp_onboarding_profiles o
 SET associate_name=e.full_name,associate_employee_code=e.employee_code
FROM public.employees e WHERE o.associate_employee_id=e.id
 AND (o.associate_name IS DISTINCT FROM e.full_name
  OR o.associate_employee_code IS DISTINCT FROM e.employee_code);

UPDATE public.intermediary_onboarding_applications a
 SET draft_data=COALESCE(a.draft_data,'{}'::jsonb) ||
   jsonb_build_object('associate_name',e.full_name,'associate_employee_code',e.employee_code)
FROM public.posp_misp_onboarding_profiles o JOIN public.employees e
 ON e.id=o.associate_employee_id
WHERE a.id=o.application_id
 AND (a.draft_data->>'associate_name' IS DISTINCT FROM e.full_name
   OR a.draft_data->>'associate_employee_code' IS DISTINCT FROM e.employee_code);

UPDATE public.policy_intake_requests r
 SET lead_source_code=i.intermediary_code,lead_source_name=i.display_name
FROM public.intermediaries i WHERE r.lead_source_id=i.id
 AND (r.lead_source_code IS DISTINCT FROM i.intermediary_code
   OR r.lead_source_name IS DISTINCT FROM i.display_name);

UPDATE public.life_health_cases c
 SET intermediary_code=i.intermediary_code,lead_source=i.display_name
FROM public.intermediaries i WHERE c.intermediary_id=i.id
 AND (c.intermediary_code IS DISTINCT FROM i.intermediary_code
   OR c.lead_source IS DISTINCT FROM i.display_name);

UPDATE public.policies p
 SET intermediary_code=i.intermediary_code,lead_source=i.display_name
FROM public.intermediaries i WHERE p.source_intermediary_id=i.id
 AND (p.intermediary_code IS DISTINCT FROM i.intermediary_code
  OR p.lead_source IS DISTINCT FROM i.display_name);

UPDATE public.policies p
 SET intermediary_code=pm.partner_code,lead_source=pm.display_name
FROM public.partners pm WHERE p.source_partner_id=pm.id
 AND (p.intermediary_code IS DISTINCT FROM pm.partner_code
   OR p.lead_source IS DISTINCT FROM pm.display_name);

UPDATE public.profiles p
 SET full_name=e.full_name,employee_code=e.employee_code,
     phone=e.phone,email=e.email,department=e.department,designation=e.designation
FROM public.employees e WHERE p.employee_id=e.id
 AND (p.full_name,p.employee_code,p.phone,p.email,p.department,p.designation)
     IS DISTINCT FROM (e.full_name,e.employee_code,e.phone,e.email,e.department,e.designation);

UPDATE public.employees child SET reporting_manager_employee_code=manager.employee_code
FROM public.employees manager WHERE child.reporting_manager_id=manager.id
 AND child.reporting_manager_employee_code IS DISTINCT FROM manager.employee_code;

-- Fail closed on unauthorized ownership rewrites or group snapshot edits.
DO $assert$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.policies p
    JOIN identity_maintenance.employee_source_sync_backup_20261113 b
      ON b.table_name='policies' AND b.record_id=p.id
    WHERE p.rm_employee_id IS DISTINCT FROM (b.previous_values->>'rm_employee_id')::uuid
       OR p.intermediary_group_id IS DISTINCT FROM (b.previous_values->>'intermediary_group_id')::uuid
       OR p.intermediary_group_code IS DISTINCT FROM b.previous_values->>'intermediary_group_code'
       OR p.intermediary_group_name IS DISTINCT FROM b.previous_values->>'intermediary_group_name'
  ) THEN RAISE EXCEPTION 'identity sync abort: historical policy ownership/group changed'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.life_health_cases c
    JOIN identity_maintenance.employee_source_sync_backup_20261113 b
      ON b.table_name='life_health_cases' AND b.record_id=c.id
    WHERE c.rm_employee_id IS DISTINCT FROM (b.previous_values->>'rm_employee_id')::uuid
  ) THEN RAISE EXCEPTION 'identity sync abort: historical case owner changed'; END IF;
  IF EXISTS (
    SELECT 1 FROM public.posp_misp_onboarding_profiles o
    JOIN identity_maintenance.employee_source_sync_backup_20261113 b
      ON b.table_name='posp_misp_onboarding_profiles' AND b.record_id=o.id
    WHERE o.associate_employee_id IS DISTINCT FROM (b.previous_values->>'associate_employee_id')::uuid
      OR o.associate_profile_id IS DISTINCT FROM (b.previous_values->>'associate_profile_id')::uuid
      OR o.associate_id IS DISTINCT FROM b.previous_values->>'associate_id'
  ) THEN RAISE EXCEPTION 'identity sync abort: partner owner / legacy code changed'; END IF;
END;
$assert$;

-- Validate *all* non-identity columns, including rows indirectly touched by
-- onboarding synchronization triggers. FULL JOIN also catches adds/deletes.
CREATE TEMP TABLE identity_sync_after_guard ON COMMIT DROP AS
SELECT 'policies'::text dataset,id,md5((to_jsonb(t)-ARRAY['source_intermediary_id','rm_name','intermediary_code','lead_source','updated_at'])::text) fingerprint FROM public.policies t
UNION ALL SELECT 'life_health_cases',id,md5((to_jsonb(t)-ARRAY['rm_name','rm_code','intermediary_code','lead_source','updated_at'])::text) FROM public.life_health_cases t
UNION ALL SELECT 'posp_misp_onboarding_profiles',id,md5((to_jsonb(t)-ARRAY['associate_name','associate_employee_code','updated_at','updated_by'])::text) FROM public.posp_misp_onboarding_profiles t
UNION ALL SELECT 'intermediary_onboarding_applications',id,md5(((to_jsonb(t)-ARRAY['draft_data','updated_at']) ||
  jsonb_build_object('draft_preserved',COALESCE(t.draft_data,'{}'::jsonb)-'associate_name'-'associate_employee_code'))::text) FROM public.intermediary_onboarding_applications t
UNION ALL SELECT 'policy_intake_requests',id,md5((to_jsonb(t)-ARRAY['lead_source_code','lead_source_name','updated_at'])::text) FROM public.policy_intake_requests t
UNION ALL SELECT 'profiles',id,md5((to_jsonb(t)-ARRAY['full_name','employee_code','phone','email','department','designation','updated_at'])::text) FROM public.profiles t
UNION ALL SELECT 'employees',id,md5((to_jsonb(t)-ARRAY['reporting_manager_employee_code','updated_at'])::text) FROM public.employees t
UNION ALL SELECT 'intermediaries',id,md5((to_jsonb(t)-ARRAY['updated_at','updated_by'])::text) FROM public.intermediaries t
UNION ALL SELECT 'partners',id,md5((to_jsonb(t)-ARRAY['updated_at'])::text) FROM public.partners t
UNION ALL SELECT 'intermediary_onboarding_contacts',id,md5(to_jsonb(t)::text) FROM public.intermediary_onboarding_contacts t
UNION ALL SELECT 'intermediary_onboarding_documents',id,md5(to_jsonb(t)::text) FROM public.intermediary_onboarding_documents t
UNION ALL SELECT 'pan_verification_jobs',id,md5(to_jsonb(t)::text) FROM public.pan_verification_jobs t
UNION ALL SELECT 'intermediary_group_memberships',id,md5(to_jsonb(t)::text) FROM public.intermediary_group_memberships t;

DO $guards$
BEGIN
  IF EXISTS (
    SELECT 1 FROM identity_sync_before_guard b
    FULL OUTER JOIN identity_sync_after_guard a
      ON a.dataset=b.dataset AND a.id=b.id
    WHERE b.fingerprint IS DISTINCT FROM a.fingerprint
  ) THEN
    RAISE EXCEPTION 'Identity-only migration modified protected business/compliance/financial/history data; rolled back';
  END IF;
END;
$guards$;

COMMIT;
