-- Recovery of deterministic, PRE-COMMIT ICICI 3005 extraction reviews.
-- Executed only by the existing service-role auto-booking worker.
-- Never resets a booking attempt, claims unknown outcomes, or bypasses
-- the normal current-PDF, customer, vehicle, date or canonical booking checks.
-- Uses the existing one-claim-per-intake ICICI recovery ledger and finisher.
CREATE OR REPLACE FUNCTION public.claim_ai_auto_booking_icici_precommit_v1(
  p_operator_profile_id uuid, p_limit integer DEFAULT 2
)
RETURNS TABLE(intake_id uuid, document_id uuid, extraction_fingerprint text)
LANGUAGE plpgsql
SET search_path TO 'public', 'pg_catalog'
AS $function$
BEGIN
  IF current_user <> 'service_role' THEN
    RAISE EXCEPTION 'service_role_required';
  END IF;
  IF p_operator_profile_id IS NULL OR p_limit IS NULL
    OR p_limit NOT BETWEEN 1 AND 2 THEN
    RAISE EXCEPTION 'invalid_claim_parameters';
  END IF;

  RETURN QUERY
  WITH eligible AS (
    SELECT i.id, q.document_id, q.extraction_fingerprint
    FROM public.policy_intake_requests AS i
    JOIN public.policy_intake_ai_processing_queue AS q ON q.intake_id=i.id
    JOIN public.policy_intake_documents AS d
      ON d.id=q.document_id AND d.intake_id=i.id AND d.is_current=true
     AND d.storage_bucket=i.storage_bucket AND d.storage_path=i.storage_path
    JOIN public.policy_intake_ai_auto_booking_attempts AS a
      ON a.intake_id=i.id AND a.document_id=q.document_id
     AND a.extraction_fingerprint=q.extraction_fingerprint
    LEFT JOIN public.policy_intake_onboarding_drafts AS draft ON draft.intake_id=i.id
    CROSS JOIN LATERAL (
      SELECT
        max(x->>'value') FILTER (WHERE x->>'key'='policy_number') AS policy_number,
        max(x->>'value') FILTER (WHERE x->>'key'='vehicle_chassis_number') AS chassis,
        max(x->>'value') FILTER (WHERE x->>'key'='insured_name') AS insured,
        max(x->>'value') FILTER (WHERE x->>'key'='policy_issuance_date') AS issuance
      FROM jsonb_array_elements(coalesce(i.ocr_fields,'[]'::jsonb)) AS x
    ) source
    WHERE i.created_at >= '2026-11-28 00:00:00+00'::timestamptz
      AND i.policy_type='motor'
      AND i.status IN ('ready_for_review','in_review')
      AND i.ocr_status='completed'
      AND i.ocr_parser_id='icici_3005_n8n_native_pdf'
      AND i.final_policy_id IS NULL AND i.assigned_to_profile_id IS NULL
      AND draft.intake_id IS NULL
      AND q.state='verified'
      AND q.parser_id='icici_3005_n8n_native_pdf'
      AND q.checks_passed=13 AND cardinality(q.exception_codes)=0
      AND q.extraction_fingerprint ~ '^[a-fA-F0-9]{64}$'
      AND a.operator_profile_id=p_operator_profile_id
      AND a.state='review_required' AND a.failure_code='extraction_review'
      AND a.policy_id IS NULL AND a.finished_at IS NOT NULL
      AND length(trim(coalesce(source.insured,'')))>=4
      AND upper(trim(source.insured)) NOT IN ('DETAILS','CUSTOMER DETAILS','NAME OF INSURED')
      AND source.policy_number ~ '^[0-9]{4}/[0-9]{9}/[0-9]{2}/[0-9]{3}$'
      AND source.chassis ~ '^[A-Za-z0-9]{12,25}$'
      AND source.issuance ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      AND NOT EXISTS (
        SELECT 1 FROM public.policies AS p
        WHERE regexp_replace(upper(coalesce(p.policy_no,'')),'[^A-Z0-9]','','g')
          =regexp_replace(upper(source.policy_number),'[^A-Z0-9]','','g')
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.vehicles AS v
        WHERE upper(coalesce(v.chassis_no,''))=upper(source.chassis)
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.policy_intake_requests AS other
        WHERE other.id<>i.id
          AND other.status IN ('completed','in_review','ready_for_review','processing')
          AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(coalesce(other.ocr_fields,'[]'::jsonb)) AS f
            WHERE f->>'key'='policy_number'
              AND regexp_replace(upper(coalesce(f->>'value','')),'[^A-Z0-9]','','g')
                =regexp_replace(upper(source.policy_number),'[^A-Z0-9]','','g')
          )
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.policy_intake_ai_icici_recovery_attempts AS old
        WHERE old.intake_id=i.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.policy_intake_ai_auto_booking_recovery_attempts AS old
        WHERE old.intake_id=i.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM public.policy_intake_ai_stranded_claim_recovery AS old
        WHERE old.intake_id=i.id
      )
      ORDER BY i.created_at,i.id
      LIMIT p_limit
      FOR UPDATE OF a SKIP LOCKED
  ),
  inserted AS (
    INSERT INTO public.policy_intake_ai_icici_recovery_attempts AS ir
      (intake_id,operator_profile_id,document_id,extraction_fingerprint)
    SELECT e.id,p_operator_profile_id,e.document_id,e.extraction_fingerprint
    FROM eligible AS e
    ON CONFLICT ON CONSTRAINT policy_intake_ai_icici_recovery_attempts_pkey DO NOTHING
    RETURNING ir.intake_id,ir.document_id,ir.extraction_fingerprint
  )
  SELECT inserted.intake_id,inserted.document_id,inserted.extraction_fingerprint
  FROM inserted;
END;
$function$;

REVOKE ALL ON FUNCTION public.claim_ai_auto_booking_icici_precommit_v1(uuid,integer)
  FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.claim_ai_auto_booking_icici_precommit_v1(uuid,integer)
  TO service_role;
