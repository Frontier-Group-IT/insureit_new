-- Add only the missing optional RC fields; keep existing required field validation unchanged.
-- Detailed RC response sections are stored separately from INSUREIT policy records.
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS registered_owner_name text,
  ADD COLUMN IF NOT EXISTS registered_address text,
  ADD COLUMN IF NOT EXISTS rc_insurance_company text,
  ADD COLUMN IF NOT EXISTS rc_policy_number text,
  ADD COLUMN IF NOT EXISTS rc_policy_start_date date,
  ADD COLUMN IF NOT EXISTS rc_policy_expiry_date date,
  ADD COLUMN IF NOT EXISTS rc_details_json jsonb;

COMMENT ON COLUMN public.vehicles.rc_details_json IS 'Sanitized, user-approved AuthBridge RC display snapshot, not policy register data.';
