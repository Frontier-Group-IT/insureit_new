import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const sql=readFileSync(new URL("../../../supabase/migrations/20261127070000_ai_booking_four_canonical_authorization_recovery.sql",import.meta.url),"utf8");
const worker=readFileSync(new URL("../lib/ai-policy-auto-booking-server.ts",import.meta.url),"utf8");
const four=[
 "ba05c92f-f318-47d8-a558-25fe704928c3",
 "fc1940fc-4dcb-47cb-a6a9-8fbedb5a2b52",
 "de17caf2-b747-4dce-97a1-d1d40e87a1b6",
 "18f8eb14-0414-48d8-899d-1939a56ddf9e",
];
for(const id of four)assert.ok(sql.includes(id), "Missing allowlisted incident ID "+id);
assert.ok(!sql.includes("tata_aig"),"No Tata AIG policy must be part of canonical recovery");
for(const needle of [
 "create table if not exists public.policy_intake_ai_canonical_recovery_attempts",
 "enable row level security",
 "revoke all on public.policy_intake_ai_canonical_recovery_attempts from public,anon,authenticated",
 "current_user <> 'service_role'",
 "a.operator_profile_id=p_operator_profile_id",
 "i.final_policy_id is null",
 "i.assigned_to_profile_id is null",
 "i.status='in_review'",
 "q.state='verified'",
 "cardinality(q.exception_codes)=0",
 "d.is_current=true",
 "d.storage_bucket=i.storage_bucket",
 "d.storage_path=i.storage_path",
 "a.document_id=q.document_id",
 "a.extraction_fingerprint=q.extraction_fingerprint",
 "a.state='review_required' and a.finished_at is not null",
 "a.policy_id is null",
 "ar.state='review_required'",
 "ar.failure_code='canonical_booking_review'",
 "ar.policy_id is null",
 "q.checks_passed=18",
 "q.checks_passed=13",
 "draft.revision >= 1",
 "policy_intake_ai_stranded_claim_recovery",
 "on conflict on constraint policy_intake_ai_canonical_recovery_attempts_pkey do nothing",
 "p_state not in ('booked','review_required','uncertain')",
 "c.state='claimed'",
 "v_intake.assigned_to_profile_id is not null",
 "a.state='claimed'",
 "c.operator_profile_id=v_actor",
 "c.state='claimed'",
 "c.recovery_reason='canonical_claim_authorization_fix'",
 "v_draft.revision<>p_expected_revision",
 "public.onboard_motor_policy_commercial_status_v2(p_payload)",
 "v_intake.final_policy_id is not null"
])assert.ok(sql.includes(needle),"Missing canonical recovery safety clause: "+needle);
assert.doesNotMatch(sql,/\b(?:delete|truncate)\s+from\s+public\.policy_intake_ai_(?:auto_booking_attempts|auto_booking_recovery_attempts|stranded_claim_recovery)\b/i);
assert.doesNotMatch(sql,/\bupdate\s+public\.policy_intake_ai_(?:auto_booking_attempts|auto_booking_recovery_attempts|stranded_claim_recovery)\b/i);
assert.ok(worker.includes('admin.rpc("claim_ai_auto_booking_canonical_recovery_v1"'));
assert.match(worker,/claim\.canonicalRecovery\s*\?\s*"finish_ai_auto_booking_canonical_recovery_v1"/);
const ordinary=worker.indexOf("for(const claim of claims)await processClaim(claim)");
const liberty=worker.indexOf('admin.rpc("claim_ai_auto_booking_liberty_recovery_v1"');
const fourStart=worker.indexOf('admin.rpc("claim_ai_auto_booking_canonical_recovery_v1"');
const tata=worker.indexOf('admin.rpc("claim_ai_auto_booking_stranded_v1"');
assert.ok(ordinary>=0 && liberty>ordinary && fourStart>liberty && tata>fourStart);
assert.ok(worker.includes('INSUREIT_AI_STRANDED_RECOVERY_ENABLED==="true"'));
console.log("Four exact non-Tata canonical recovery and SQL authorization safety assertions passed");
