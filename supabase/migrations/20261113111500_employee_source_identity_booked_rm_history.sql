-- Employee/source identity reconciliation: immutable booked RM, mutable display identity.
-- Apply only through the approved production migration process, before deploying the web changes.
-- No historic RM reassignment is performed by this migration.
BEGIN;

ALTER TABLE public.policies
  ADD COLUMN IF NOT EXISTS source_intermediary_id uuid
  REFERENCES public.intermediaries(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS policies_source_intermediary_id_idx
  ON public.policies(source_intermediary_id);

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
  'source_intermediary_id',p.source_intermediary_id,
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

-- A name/code correction is NOT a source transfer. Even changing a policy's
-- source code must never infer a new booked RM from today's partner owner.
CREATE OR REPLACE FUNCTION public.sync_policy_rm_employee_id()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
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
  SELECT COALESCE(i.associate_employee_id,o.associate_employee_id),e.full_name
    INTO v_employee_id,v_employee_name
  FROM public.intermediaries i
  LEFT JOIN public.posp_misp_onboarding_profiles o ON o.application_id=i.application_id
  LEFT JOIN public.employees e ON e.id=COALESCE(i.associate_employee_id,o.associate_employee_id)
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
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  v_id uuid;
  v_code text;
BEGIN
  IF NULLIF(BTRIM(COALESCE(NEW.intermediary_code,'')),'') IS NULL THEN
    IF TG_OP = 'UPDATE' AND NEW.intermediary_code IS DISTINCT FROM OLD.intermediary_code THEN
      NEW.source_intermediary_id := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.source_intermediary_id IS NOT NULL THEN
    SELECT intermediary_code INTO v_code FROM public.intermediaries WHERE id=NEW.source_intermediary_id;
    IF v_code=NEW.intermediary_code THEN RETURN NEW; END IF;
  END IF;

  SELECT id INTO v_id FROM public.intermediaries
    WHERE intermediary_code=NEW.intermediary_code ORDER BY id LIMIT 1;
  IF v_id IS NOT NULL THEN
    NEW.source_intermediary_id := v_id;
  ELSIF TG_OP='INSERT' OR NEW.intermediary_code IS DISTINCT FROM OLD.intermediary_code THEN
    -- Do not attach a different entity on an unrecognized code.
    NEW.source_intermediary_id := NULL;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS a_set_policy_source_identity ON public.policies;
CREATE TRIGGER a_set_policy_source_identity
BEFORE INSERT OR UPDATE OF intermediary_code,source_intermediary_id
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
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
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
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.partner_code IS DISTINCT FROM OLD.partner_code
     OR NEW.display_name IS DISTINCT FROM OLD.display_name THEN
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
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
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
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
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

-- The migration is conditional on existing UUIDs, never on matching two names.
UPDATE public.policies p SET source_intermediary_id=i.id
FROM public.intermediaries i
WHERE p.source_intermediary_id IS NULL
  AND p.intermediary_code=i.intermediary_code;

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

COMMIT;
