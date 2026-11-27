import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const sql=readFileSync(new URL("../../../supabase/migrations/20261127103000_ai_icici_3005_future_verified_recovery.sql",import.meta.url),"utf8");
for(const x of [
"i.created_at >= '2026-11-27 00:00:00+00'::timestamptz",
"c.intake_id is null","current_user <> 'service_role'",
"p_operator_profile_id is null",
"d.is_current=true",
"d.storage_bucket=i.storage_bucket","d.storage_path=i.storage_path",
"a.document_id=q.document_id","a.extraction_fingerprint=q.extraction_fingerprint",
"a.operator_profile_id=p_operator_profile_id","a.state='review_required'",
"a.failure_code='canonical_booking_review'","a.finished_at is not null",
"a.policy_id is null","q.parser_id='icici_3005_n8n_native_pdf'",
"q.checks_passed=13","q.state='verified'","cardinality(q.exception_codes)=0",
"draft.revision>=1","i.status='in_review'",
"i.final_policy_id is null","i.assigned_to_profile_id is null",
"not exists (select 1 from public.policy_intake_ai_auto_booking_recovery_attempts",
"not exists (select 1 from public.policy_intake_ai_stranded_claim_recovery",
"not exists (select 1 from public.policy_intake_ai_icici_recovery_attempts past",
"on conflict on constraint policy_intake_ai_icici_recovery_attempts_pkey do nothing"
])assert.ok(sql.includes(x),"Missing future-source recovery safeguard "+x);
assert.ok(!sql.includes("conversion_outcome_unknown"));
assert.ok(!sql.includes("tata_aig"));
assert.ok(!/delete\s+from|truncate\s+table|update\s+public\.policy_intake_ai_auto_booking_attempts/i.test(sql));
console.log("Future 13/13 ICICI recovery is source-verified, immutable and exactly once");
