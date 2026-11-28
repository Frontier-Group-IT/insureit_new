import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const sql=readFileSync(new URL("../../../infra/sql/claim_ai_auto_booking_icici_precommit_v1.sql",import.meta.url),"utf8");
const worker=readFileSync(new URL("../lib/ai-policy-auto-booking-server.ts",import.meta.url),"utf8");
const guards=[
 "current_user <> 'service_role'",
 "i.created_at >= '2026-11-28",
 "i.policy_type='motor'",
 "i.status IN ('ready_for_review','in_review')",
 "i.ocr_status='completed'",
 "i.ocr_parser_id='icici_3005_n8n_native_pdf'",
 "q.state='verified'",
 "q.parser_id='icici_3005_n8n_native_pdf'",
 "q.checks_passed=13",
 "cardinality(q.exception_codes)=0",
 "q.extraction_fingerprint ~",
 "a.state='review_required'",
 "a.failure_code='extraction_review'",
 "a.policy_id IS NULL",
 "a.finished_at IS NOT NULL",
 "a.operator_profile_id=p_operator_profile_id",
 "draft.intake_id IS NULL",
 "i.final_policy_id IS NULL",
 "i.assigned_to_profile_id IS NULL",
 "d.is_current=true",
 "d.storage_bucket=i.storage_bucket",
 "d.storage_path=i.storage_path",
 "other.status IN",
 "public.policy_intake_ai_icici_recovery_attempts AS old",
 "public.policy_intake_ai_auto_booking_recovery_attempts AS old",
 "public.policy_intake_ai_stranded_claim_recovery AS old",
 "public.vehicles AS v",
 "public.policies AS p",
 "FOR UPDATE OF a SKIP LOCKED",
 "ON CONFLICT ON CONSTRAINT policy_intake_ai_icici_recovery_attempts_pkey DO NOTHING",
 "REVOKE ALL ON FUNCTION",
 "TO service_role",
];
for(const guard of guards)assert.ok(sql.includes(guard),"Required precommit proof missing: "+guard);
assert.ok(!sql.includes("UPDATE public.policy_intake_ai_auto_booking_attempts"),
 "Original terminal booking ledger must remain immutable");
assert.ok(!sql.includes("DELETE FROM"));
assert.ok(worker.includes('admin.rpc("claim_ai_auto_booking_icici_precommit_v1"'));
assert.ok(worker.includes('const claim={...item,iciciRecovery:true}'));
assert.ok(worker.includes('claim.iciciRecovery?"finish_ai_auto_booking_icici_recovery_v1"'));
assert.ok(worker.includes('if(result.ok&&result.policyId&&UUID.test(result.policyId))'));
assert.ok(worker.includes('await processClaim(claim)'));
assert.ok(worker.includes('["PGRST202","42883"]'));
console.log("ICICI 13/13 pre-commit recovery is exactly-once, original-ledger immutable, with canonical transaction still required");
