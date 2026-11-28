import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../../supabase/migrations/20261127122500_ai_icici_verified_uncertain_once.sql",import.meta.url),"utf8");
const worker=readFileSync(new URL("../lib/ai-policy-auto-booking-server.ts",import.meta.url),"utf8");
const ui=readFileSync(new URL("../app/development/ai-policy-onboarding/page.tsx",import.meta.url),"utf8");
for(const guard of [
 "current_user <> 'service_role'",
 "'f9aae730-76ef-4c3d-8f95-db24f2e3e9ac'::uuid",
 "i.status='ready_for_review'","i.final_policy_id is null and i.assigned_to_profile_id is null",
 "q.state='verified' and cardinality(q.exception_codes)=0",
 "q.parser_id='icici_3005_n8n_native_pdf'","q.checks_passed=13",
 "a.document_id=q.document_id","a.extraction_fingerprint=q.extraction_fingerprint",
 "d.is_current=true","d.storage_bucket=i.storage_bucket","d.storage_path=i.storage_path",
 "not exists (select 1 from public.policy_intake_onboarding_drafts d0",
 "jsonb_array_length(coalesce(i.ocr_fields::jsonb,'[]'::jsonb))>=20",
 "length(coalesce(source.policy_no,''))>=8",
 "length(coalesce(source.chassis,''))>=9",
 "a.operator_profile_id=p_operator_profile_id",
 "a.state='uncertain' and a.failure_code='conversion_outcome_unknown'",
 "a.finished_at is not null and a.policy_id is null",
 "not exists (select 1 from public.policies p",
 "not exists (select 1 from public.policy_documents pd",
 "not exists (select 1 from public.audit_logs log",
 "on conflict on constraint policy_intake_ai_icici_uncertain_recovery_attempts_pkey do nothing",
 "r.operator_profile_id=v_actor","r.state='claimed'",
 "v_intake.final_policy_id is not null",
 "public.onboard_motor_policy_commercial_status_v2(p_payload)"
])assert.ok(sql.includes(guard),"Missing isolated recovery guard: "+guard);
assert.ok(worker.includes('admin.rpc("claim_ai_auto_booking_icici_uncertain_v1"'));
assert.ok(worker.includes('claim.reconciledIciciUncertain?"finish_ai_auto_booking_icici_uncertain_v1"'));
assert.ok(ui.includes("policy_intake_ai_icici_uncertain_recovery_attempts"));
assert.ok(!sql.includes("'6e191de0-7777-4750-b4e4-4a60cb739ca9'::uuid"));
assert.doesNotMatch(sql,/update\s+public\.policy_intake_ai_auto_booking_attempts\b|truncate\s+public\.policy_intake_ai_/i);
console.log("One-time current-source ICICI 1C79A4 atomic non-commit reconciliation checks passed");
