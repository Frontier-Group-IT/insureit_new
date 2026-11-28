import assert from "node:assert/strict";
import {readFileSync} from "node:fs";

const worker=readFileSync(new URL("../lib/ai-policy-onboarding-queue-server.ts",import.meta.url),"utf8");
const sql=readFileSync(new URL("../../../supabase/migrations/20261127090000_ai_queue_transient_n8n_recovery_v4.sql",import.meta.url),"utf8");
const nia=readFileSync(new URL("../lib/policy-commercial-direct-eligibility.ts",import.meta.url),"utf8");
const extension=readFileSync(new URL("../lib/policy-nontata-commercial-n8n.ts",import.meta.url),"utf8");

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
for(const gate of [
 "create table if not exists public.policy_intake_ai_source_rule_replays",
 "enable row level security",
 "revoke all on public.policy_intake_ai_source_rule_replays from public,anon,authenticated",
 "current_user <> 'service_role'",
 "q.parser_id='new_india_cv_native_pdf'",
 "q.checks_passed=16",
 "q.last_error_code='nia_nia_untrained_vehicle_or_product_variant'",
 "d.is_current=true",
 "d.storage_bucket=i.storage_bucket",
 "d.storage_path=i.storage_path",
 "i.assigned_to_profile_id is null and i.final_policy_id is null",
 "not exists (",
 "policy_intake_ai_auto_booking_attempts",
 "policy_intake_ai_canonical_recovery_attempts",
 "on conflict on constraint policy_intake_ai_source_rule_replays_pkey do nothing",
 "for update of q skip locked",
])assert.ok(sql.includes(gate),"Missing isolated NIA re-evaluation guard: "+gate);
assert.ok(worker.includes('admin.rpc("requeue_ai_nia_intra_after_rule_v1"'));
assert.ok(worker.includes('if(!preferredIntakeId){'));
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
assert.ok(nia.includes('(positiveCpa && Number(get("cpa_premium"))<=0)'));
assert.ok(nia.includes('const zeroChargeCpa=get("vehicle_model")==="TATA INTRA V30 TRUCK"'));
assert.ok(nia.includes('get("cpa_premium")==="0"'));
assert.ok(nia.includes('if(!positiveCpa&&!zeroChargeCpa)'));
assert.ok(nia.includes('const positiveCpa=cpaEvidence==="NIA PDF page 2 Owner Driver PA; TP and 18%/5% IGST bases independently reconciled"'));
assert.ok(nia.includes('Owner Driver PA nominee none; no CPA charged; TP and 18%/5% IGST independently reconciled'));
assert.doesNotMatch(sql,/delete from public|truncate /i);
for(const x of [
 'payload.ok===false',
 'payload.validation_passed===false',
 'payload.intake_id===ids.intake_id',
 'payload.document_id===ids.document_id',
 'payload.request_id===ids.request_id',
 'const allowed=NEW_VARIANT_CHECKS[insurer],checkSet=payload.checks',
 'Object.keys(checkSet).length===allowed.length',
 'allowed.every(key=>typeof checkSet[key]==="boolean")',
 'new Error("n8n_failed_checks__"+failed.slice(0,6).join("__"))',
])assert.ok(extension.includes(x),"Source-validation errors must not masquerade as n8n outages: "+x);
const hardened=readFileSync(new URL("../../../supabase/migrations/20261127094500_ai_queue_new_intake_transport_retry_guard.sql",import.meta.url),"utf8");
assert.ok(hardened.includes("q.state='failed' and q.last_error_code='n8n_unavailable' and q.attempts<12"));
assert.ok(hardened.includes("i.created_at >= '2026-11-27 00:00:00+00'::timestamptz"),
 "Historical exhausted intakes including nine excluded Tata AIG must not be reopened");
assert.ok(hardened.includes("not exists (select 1 from public.policy_intake_ai_auto_booking_attempts a where a.intake_id=q.intake_id)"),
 "Existing booking attempts are immutable and excluded");
assert.ok(hardened.includes("i.final_policy_id is null"));
assert.ok(hardened.includes("q.document_id is distinct from excluded.document_id"));
assert.ok(hardened.includes("q.state <> 'duplicate'"));
console.log("NIA exact-source variant and transient n8n recovery safety passed");
