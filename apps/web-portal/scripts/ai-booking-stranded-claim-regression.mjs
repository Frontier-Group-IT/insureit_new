import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../../supabase/migrations/20261127053000_ai_booking_stranded_preconversion_recovery.sql",import.meta.url),"utf8");
const worker=readFileSync(new URL("../lib/ai-policy-auto-booking-server.ts",import.meta.url),"utf8");
const page=readFileSync(new URL("../app/development/ai-policy-onboarding/page.tsx",import.meta.url),"utf8");
const refs=["D5408F","6599F5","2FCC38","CBF2A2","7254DB","DFD3B1","4C5AA2","CFF840","0383BA"];
for(const ref of refs)assert.ok(sql.includes("PIR-261127-"+ref),"Missing incident whitelist "+ref);
for(const required of [
 "a.state='claimed' and a.finished_at is null and a.policy_id is null",
 "a.claimed_at >= timestamptz '2026-11-27 04:39:00+00'",
 "a.claimed_at < timestamptz '2026-11-27 04:45:00+00'",
 "a.document_id=q.document_id",
 "a.extraction_fingerprint=q.extraction_fingerprint",
 "q.parser_id='tata_aig_two_wheeler_bundled_n8n_native_pdf'",
 "q.checks_passed=18",
 "q.state='verified'",
 "i.final_policy_id is null",
 "i.assigned_to_profile_id is null",
 "d.is_current=true",
 "not exists (",
 "policy_intake_onboarding_drafts draft",
 "policy_intake_ai_stranded_claim_recovery past",
 "on conflict on constraint policy_intake_ai_stranded_claim_recovery_pkey do nothing",
 "r.state='claimed'",
 "p_limit <> 1",
 "current_user <> 'service_role'",
])assert.ok(sql.includes(required),"Unsafe stranded recovery gate missing: "+required);
assert.doesNotMatch(sql,/\b(?:delete|truncate)\s+from\s+public\.policy_intake_ai_auto_booking_attempts\b/i);
assert.doesNotMatch(sql,/\bupdate\s+public\.policy_intake_ai_auto_booking_attempts\b/i);
assert.ok(worker.includes('claim.stranded'));
assert.ok(worker.includes('INSUREIT_AI_STRANDED_RECOVERY_ENABLED==="true"'),"Nine Tata claims must remain opt-in");
assert.ok(worker.includes('admin.rpc("claim_ai_auto_booking_stranded_v1"'));
assert.ok(worker.includes('p_operator_profile_id:operatorId,p_limit:1'));
const ordinary=worker.indexOf("for(const claim of claims)await processClaim(claim)");
const liberty=worker.indexOf('admin.rpc("claim_ai_auto_booking_liberty_recovery_v1"');
const stranded=worker.indexOf('admin.rpc("claim_ai_auto_booking_stranded_v1"');
assert.ok(ordinary>=0&&liberty>ordinary&&stranded>liberty);
assert.ok(page.includes('policy_intake_ai_stranded_claim_recovery'));
console.log("Incident-specific nine claim recovery has strict source, time, identity, and no-repeat guards");
