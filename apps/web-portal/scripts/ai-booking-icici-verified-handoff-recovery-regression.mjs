import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../../supabase/migrations/20261127080000_ai_booking_icici_3005_verified_handoff_recovery.sql",import.meta.url),"utf8");
const handoff=readFileSync(new URL("../app/policy-intakes/handoff-actions.ts",import.meta.url),"utf8");
const worker=readFileSync(new URL("../lib/ai-policy-auto-booking-server.ts",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/development/ai-policy-onboarding/page.tsx",import.meta.url),"utf8");
for(const id of ["0e14ab20-85da-4327-950f-231fdd2fe7cf","99f5ec77-0937-4d5a-beca-3caae2e033f3","18f8eb14-0414-48d8-899d-1939a56ddf9e"])
 assert.ok(sql.includes(id),"Missing approved ICICI intake "+id);
assert.ok(!/tata_aig/i.test(sql));
assert.ok(handoff.includes('const verifiedIcici3005=verified.parserId==="icici_3005_n8n_native_pdf"'));
assert.ok(handoff.includes('hasVerifiedN8nParserEvidence(verified.parserId,verified.checksPassed,verified.warnings)'));
assert.ok(handoff.includes('Boolean(verified.premium)'));
assert.ok(handoff.includes('policyDateDecision(verified.fields.find(field=>'));
assert.ok(handoff.includes('const eligibleForVerifiedConversion=verifiedIcici3005||'));
for(const part of [
 "enable row level security","revoke all on public.policy_intake_ai_icici_recovery_attempts from public,anon,authenticated",
 "current_user <> 'service_role'","q.parser_id='icici_3005_n8n_native_pdf'",
 "q.checks_passed=13","q.state='verified'","cardinality(q.exception_codes)=0",
 "d.is_current=true","d.storage_bucket=i.storage_bucket","d.storage_path=i.storage_path",
 "i.final_policy_id is null","i.assigned_to_profile_id is null","i.status='in_review'",
 "a.operator_profile_id=p_operator_profile_id","a.state='review_required'",
 "a.failure_code='canonical_booking_review'","a.policy_id is null",
 "c.state='review_required'","c.failure_code='canonical_booking_review'",
 "c.policy_id is null","c.operator_profile_id=p_operator_profile_id",
 "not exists (select 1 from public.policy_intake_ai_icici_recovery_attempts past",
 "on conflict on constraint policy_intake_ai_icici_recovery_attempts_pkey do nothing",
 "ir.state='claimed'","ir.operator_profile_id=v_actor",
 "ir.recovery_reason='icici_3005_verified_handoff_fix'",
 "v_intake.final_policy_id is not null","v_draft.revision<>p_expected_revision",
 "public.onboard_motor_policy_commercial_status_v2(p_payload)"
]) assert.ok(sql.includes(part),"Missing recovery guard "+part);
assert.doesNotMatch(sql,/\\b(?:delete|truncate)\\s+from\\s+public\\.policy_intake_ai_(?:auto_booking_attempts|auto_booking_recovery_attempts|canonical_recovery_attempts|stranded_claim_recovery)\\b/i);
assert.ok(worker.includes('admin.rpc("claim_ai_auto_booking_icici_recovery_v1"'));
assert.ok(worker.includes('claim.iciciRecovery?"finish_ai_auto_booking_icici_recovery_v1"'));
assert.ok(worker.includes('INSUREIT_AI_STRANDED_RECOVERY_ENABLED==="true"'));
assert.ok(page.includes('policy_intake_ai_icici_recovery_attempts'));
const ordinary=worker.indexOf("for(const claim of claims)await processClaim(claim)");
const icici=worker.indexOf('admin.rpc("claim_ai_auto_booking_icici_recovery_v1"');
const tata=worker.indexOf('admin.rpc("claim_ai_auto_booking_stranded_v1"');
assert.ok(ordinary>=0&&icici>ordinary&&tata>icici);
console.log("ICICI 3005 preserved verified handoff and exact-once non-Tata recovery guards passed");
