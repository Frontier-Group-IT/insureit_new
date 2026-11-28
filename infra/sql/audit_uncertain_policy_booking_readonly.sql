-- INSUREIT / already-issued-policy record keeping.
-- READ-ONLY evidence report. NEVER use the absence of a record to infer a
-- definitely uncommitted transaction or to authorize another booking.
-- Run with the Operations Portal service-role / trusted DBA session.
-- No INSERT/UPDATE/DELETE, no original booking ledger mutation.
WITH uncertain AS (
 SELECT i.id,i.intake_number,i.status,i.final_policy_id,
        i.ocr_parser_id,i.ocr_status,i.ocr_fields,
        q.document_id,q.extraction_fingerprint,q.state queue_state,
        q.parser_id,q.checks_passed,q.exception_codes,
        a.state original_state,a.failure_code original_failure,
        a.claimed_at original_claimed_at,a.finished_at original_finished_at,
        d.revision draft_revision,d.draft_payload
 FROM public.policy_intake_requests i
 JOIN public.policy_intake_ai_auto_booking_attempts a ON a.intake_id=i.id
 LEFT JOIN public.policy_intake_ai_processing_queue q ON q.intake_id=i.id
 LEFT JOIN public.policy_intake_onboarding_drafts d ON d.intake_id=i.id
 WHERE a.state='uncertain' AND a.failure_code='conversion_outcome_unknown'
),
source AS (
 SELECT t.*,
        coalesce(nullif(t.draft_payload->>'policyNo',''),
          (SELECT f->>'value' FROM jsonb_array_elements(coalesce(t.ocr_fields,'[]'::jsonb)) f
           WHERE f->>'key'='policy_number' LIMIT 1)) source_policy,
        coalesce(nullif(t.draft_payload->>'chassisNo',''),
          (SELECT f->>'value' FROM jsonb_array_elements(coalesce(t.ocr_fields,'[]'::jsonb)) f
           WHERE f->>'key'='vehicle_chassis_number' LIMIT 1)) source_chassis,
        (SELECT count(*) FROM public.policy_intake_documents doc
         WHERE doc.intake_id=t.id AND doc.id=t.document_id AND doc.is_current=true)
         current_document_count
 FROM uncertain t
),
normalized AS (
 SELECT s.*,
        regexp_replace(upper(coalesce(s.source_policy,'')),'[^A-Z0-9]','','g') policy_key,
        regexp_replace(upper(coalesce(s.source_chassis,'')),'[^A-Z0-9]','','g') chassis_key
 FROM source s
)
SELECT n.intake_number,n.original_state,n.original_failure,
       n.queue_state,n.parser_id,n.checks_passed,n.ocr_status,
       n.draft_revision,n.source_policy,n.source_chassis,
       n.current_document_count,
       (SELECT count(*) FROM public.policies p
        WHERE length(n.policy_key)>=8
          AND regexp_replace(upper(coalesce(p.policy_no,'')),'[^A-Z0-9]','','g')=n.policy_key) policy_number_matches,
       (SELECT count(*) FROM public.vehicles v
        WHERE length(n.chassis_key)>=8
          AND regexp_replace(upper(coalesce(v.chassis_no,'')),'[^A-Z0-9]','','g')=n.chassis_key) chassis_matches,
       (SELECT count(*) FROM public.policy_documents pdoc
        WHERE pdoc.source_intake_id=n.id OR pdoc.source_intake_document_id=n.document_id) source_document_links,
       (SELECT count(*) FROM public.audit_logs log WHERE log.record_id=n.id) intake_audit_entries,
       (SELECT count(*) FROM public.policy_intake_ai_reconciled_recovery_attempts rec
        WHERE rec.intake_id=n.id) digit_recovery_count,
       (SELECT count(*) FROM public.policy_intake_ai_uiic_tractor_recovery_attempts rec
        WHERE rec.intake_id=n.id) uiic_recovery_count,
       (SELECT jsonb_agg(jsonb_build_object('kind',r.kind,'state',r.state,'failure',r.failure_code)
                         ORDER BY r.kind)
        FROM (
          SELECT 'go_digit' kind,state,failure_code
          FROM public.policy_intake_ai_reconciled_recovery_attempts WHERE intake_id=n.id
          UNION ALL
          SELECT 'united_india' kind,state,failure_code
          FROM public.policy_intake_ai_uiic_tractor_recovery_attempts WHERE intake_id=n.id
        ) r) recovery_history,
       CASE
         WHEN n.final_policy_id IS NOT NULL THEN 'already_linked_never_retry'
         WHEN EXISTS (
           SELECT 1 FROM public.policy_intake_ai_reconciled_recovery_attempts r
           WHERE r.intake_id=n.id AND r.state='uncertain'
         ) THEN 'second_uncertain_no_more_booking'
         WHEN EXISTS (
           SELECT 1 FROM public.policy_intake_ai_uiic_tractor_recovery_attempts r
           WHERE r.intake_id=n.id AND r.state='uncertain'
         ) THEN 'second_uncertain_no_more_booking'
         WHEN EXISTS (
           SELECT 1 FROM public.policy_intake_ai_uiic_tractor_recovery_attempts r
           WHERE r.intake_id=n.id AND r.state='review_required'
         ) THEN 'canonical_review_no_automatic_retry'
         WHEN n.draft_revision IS NULL OR length(n.policy_key)<8
           OR length(n.chassis_key)<8 THEN 'source_draft_missing_reconcile_without_booking'
         WHEN EXISTS (
           SELECT 1 FROM public.policies p
           WHERE regexp_replace(upper(coalesce(p.policy_no,'')),'[^A-Z0-9]','','g')=n.policy_key
         ) THEN 'existing_policy_match_manual_link_review'
         ELSE 'uncertain_write_requires_manual_reconciliation'
       END disposition,
       true AS booking_mutations_prohibited
FROM normalized n
ORDER BY n.intake_number;
