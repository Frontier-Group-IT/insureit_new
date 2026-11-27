import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../../supabase/migrations/20261127113000_ai_digit_7a_atomic_reconciliation.sql",import.meta.url),"utf8");
const worker=readFileSync(new URL("../lib/ai-policy-auto-booking-server.ts",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/development/ai-policy-onboarding/page.tsx",import.meta.url),"utf8");
for(const required of [
  "current_user <> 'service_role'",
  "'c46c563f-b7e0-44c4-866a-cd8b484a109c'::uuid",
  "a.state='uncertain'","a.failure_code='conversion_outcome_unknown'",
  "a.finished_at is not null and a.policy_id is null",
  "q.state='verified'","cardinality(q.exception_codes)=0",
  "q.parser_id='go_digit_jcb_new_unregistered_native_pdf'",
  "q.checks_passed=18","q.document_id",
  "a.document_id=q.document_id",
  "a.extraction_fingerprint=q.extraction_fingerprint",
  "d.is_current=true","d.storage_bucket=i.storage_bucket",
  "d.storage_path=i.storage_path","draft.revision=1",
  "i.final_policy_id is null and i.assigned_to_profile_id is null",
  "not exists (select 1 from public.policies p",
  "regexp_replace(upper(draft.draft_payload->>'policyNo')",
  "regexp_replace(upper(draft.draft_payload->>'chassisNo')",
  "not exists (select 1 from public.policy_documents pd",
  "not exists (select 1 from public.audit_logs log",
  "not exists (select 1 from public.policy_intake_ai_reconciled_recovery_attempts prev",
  "on conflict on constraint policy_intake_ai_reconciled_recovery_attempts_pkey do nothing",
  "policy_intake_ai_reconciled_recovery_attempts r",
  "r.state='claimed'","r.operator_profile_id=v_actor",
  "v_intake.final_policy_id is not null",
  "v_draft.revision<>p_expected_revision",
  "public.onboard_motor_policy_commercial_status_v2(p_payload)",
])assert.ok(sql.includes(required),"Reconciliation source/transaction guard missing "+required);
assert.ok(!sql.includes("'6e191de0-7777-4750-b4e4-4a60cb739ca9'::uuid"),"E99B5C has no verified draft and is never auto retried");
assert.doesNotMatch(sql,/\bdelete\s+from\s+public\.policy_intake_ai_(?:auto_booking_attempts|canonical_recovery_attempts|icici_recovery_attempts|stranded_claim_recovery)\b|\btruncate\s+table\s+public\.policy_intake_ai_|\bupdate\s+public\.policy_intake_ai_auto_booking_attempts\b/i);
assert.ok(worker.includes('admin.rpc("claim_ai_auto_booking_reconciled_digit_v1"'));
assert.ok(worker.includes('claim.reconciledDigit?"finish_ai_auto_booking_reconciled_digit_v1"'));
assert.ok(worker.includes('INSUREIT_AI_STRANDED_RECOVERY_ENABLED==="true"'));
assert.ok(page.includes("policy_intake_ai_reconciled_recovery_attempts"));
assert.ok(page.includes("autoUncertainCount=Math.max(0,autoUncertainCount-n.reduce"));
console.log("Exactly one original Go Digit outcome may be reconciled against the canonical transaction");
