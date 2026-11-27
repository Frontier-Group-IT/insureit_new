import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const worker=readFileSync(new URL("../lib/ai-policy-onboarding-queue-server.ts",import.meta.url),"utf8");
const sql=readFileSync(new URL("../../../supabase/migrations/20261127090000_ai_queue_transient_n8n_recovery_v4.sql",import.meta.url),"utf8");
const nia=readFileSync(new URL("../lib/policy-commercial-direct-eligibility.ts",import.meta.url),"utf8");

for(const x of [
 "create or replace function public.claim_policy_intake_ai_queue_v3",
 "q.state='failed' and q.last_error_code='n8n_unavailable' and q.attempts<12",
 "q.state <> 'duplicate'",
 "i.final_policy_id is null",
 "for update of q skip locked",
 "q.document_id is distinct from excluded.document_id",
 "q.parser_revision is distinct from excluded.parser_revision",
 "q.retry_after<=now()",
])assert.ok(sql.toLowerCase().includes(x.toLowerCase()),"Missing retry safety: "+x);
assert.ok(sql.includes("q.attempts<5"),"Normal failures keep original five-attempt budget");
for(const x of [
 'const retryExhausted=!untrained && attemptCount>=12',
 'Math.min(360,5*Math.pow(2,Math.max(0,attemptCount-1)))',
 '"n8n_unavailable_retry_exhausted":"n8n_unavailable"',
 'state:layoutNeedsTraining?"unsupported":validationFailed||retryExhausted?"exception"',
 'eq("lease_id",item.lease_id)',
])assert.ok(worker.includes(x),"Missing bounded transient handling: "+x);
assert.ok(worker.includes('const recognizedNiaTata=niaModelCertified'));
assert.ok(worker.includes('["1918 AZURA","TATA INTRA V30 TRUCK"].includes(model)'));
assert.ok(nia.includes('["1918 AZURA","TATA INTRA V30 TRUCK"].includes(get("vehicle_model"))'));
assert.ok(nia.includes('get("vehicle_model")==="1918 AZURA"'));
assert.ok(nia.includes('||Number(get("cpa_premium"))<=0'));
assert.ok(nia.includes('cpaEvidence!=="NIA PDF page 2 Owner Driver PA; TP and 18%/5% IGST bases independently reconciled"'));
assert.doesNotMatch(sql,/policy_intake_ai_auto_booking|delete from public|truncate /i);
console.log("NIA exact-source variant and transient n8n recovery safety passed");
