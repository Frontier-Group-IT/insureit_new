-- Read-only canonical effective classification shared by the Portal and Partner App.
-- Existing policy_intake_requests.status values are NOT changed.
-- Mirrors loadPolicyIntakeDuplicateMatches: completed intakes cannot be duplicates;
-- an existing registered policy or an earlier intake with the same normalized
-- OCR policy number takes precedence over the stored status.
CREATE VIEW public.policy_intake_effective_list
WITH (security_invoker = true)
AS
WITH normalized AS (
  SELECT r.id, r.created_at,
    regexp_replace(
      upper(btrim(coalesce(
        (SELECT field->>'value'
         FROM jsonb_array_elements(coalesce(r.ocr_fields, '[]'::jsonb)) AS field
         WHERE field->>'key' = 'policy_number'
         LIMIT 1), ''
      ))),
      '[^A-Z0-9]', '', 'g'
    ) AS policy_number
  FROM public.policy_intake_requests r
),
first_intakes AS (
  SELECT DISTINCT ON (policy_number) policy_number, id AS first_id
  FROM normalized
  WHERE policy_number <> ''
  ORDER BY policy_number, created_at ASC, id ASC
)
SELECT r.*,
  CASE
    WHEN r.status <> 'completed'
      AND n.policy_number <> ''
      AND (
        EXISTS (
          SELECT 1 FROM public.policies p
          WHERE p.policy_no_normalized = n.policy_number
        )
        OR first_intakes.first_id IS DISTINCT FROM r.id
      )
    THEN 'duplicate'
    ELSE r.status
  END AS effective_status,
  public.policy_intake_search_text(r) AS search_text
FROM public.policy_intake_requests r
JOIN normalized n ON n.id = r.id
LEFT JOIN first_intakes ON first_intakes.policy_number = n.policy_number;

-- The service-role-backed Portal API applies the current user's effective
-- scope to every query; never expose the privileged view to browser clients.
REVOKE ALL ON public.policy_intake_effective_list FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.policy_intake_effective_list TO service_role;

COMMENT ON VIEW public.policy_intake_effective_list IS
  'Read-only Policy Intake status and OCR search projection for same-scope Portal and Partner App count parity.';
