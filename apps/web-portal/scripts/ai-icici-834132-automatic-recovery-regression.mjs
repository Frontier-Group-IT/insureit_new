import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../../supabase/migrations/20261127100000_ai_icici_3005_verified_834132_recovery.sql",import.meta.url),"utf8");
const ui=readFileSync(new URL("../components/development/semi-auto-policy-workspace.tsx",import.meta.url),"utf8");
assert.ok(sql.includes("'b7e66412-fea7-4526-883a-9c8987fc2181'::uuid"));
assert.ok(sql.includes("'18f8eb14-0414-48d8-899d-1939a56ddf9e'::uuid"));
for(const guard of [
 "current_user <> 'service_role'","d.is_current=true",
 "d.storage_bucket=i.storage_bucket","d.storage_path=i.storage_path",
 "a.document_id=q.document_id","a.extraction_fingerprint=q.extraction_fingerprint",
 "draft.revision>=1","q.parser_id='icici_3005_n8n_native_pdf'",
 "q.checks_passed=13","q.state='verified'","cardinality(q.exception_codes)=0",
 "a.operator_profile_id=p_operator_profile_id","a.state='review_required'",
 "a.failure_code='canonical_booking_review'","a.finished_at is not null",
 "a.policy_id is null","i.assigned_to_profile_id is null","i.final_policy_id is null",
 "c.intake_id is null",
 "not exists (select 1 from public.policy_intake_ai_icici_recovery_attempts past",
 "on conflict on constraint policy_intake_ai_icici_recovery_attempts_pkey do nothing"
])assert.ok(sql.includes(guard),"Missing source-certified recovery guard "+guard);
assert.doesNotMatch(sql,/\\b(?:delete|truncate|update public.policy_intake_ai_auto_booking_attempts)\\b/i);
assert.doesNotMatch(sql,/tata_aig|conversion_outcome_unknown/);
assert.ok(ui.includes("Automatic onboarding needs resolution"));
assert.ok(ui.includes("Booking reconciliation required · automatic retry paused"));
assert.ok(ui.includes("Reconciliation required (no retry)"));
assert.ok(!ui.includes("Booking outcome uncertain · do not retry"));
console.log("ICICI 834132 exact-once recovery and clear reconciliation states passed");
