import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { useN8nForAllPolicyReads, segregatePolicyIntakeLanes, incomingPolicyIntakeLane } from "../lib/policy-ocr-routing-mode.ts";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const oldProvider=process.env.INSUREIT_POLICY_OCR_PROVIDER;
const oldLane=process.env.INSUREIT_POLICY_LANE_SPLIT;
try {
 process.env.INSUREIT_POLICY_OCR_PROVIDER="n8n";
 process.env.INSUREIT_POLICY_LANE_SPLIT="true";
 assert.equal(useN8nForAllPolicyReads(),true);
 assert.equal(segregatePolicyIntakeLanes(),true);
 assert.equal(incomingPolicyIntakeLane("motor",true),"automation");
 assert.equal(incomingPolicyIntakeLane("motor",false),"manual");
 assert.equal(incomingPolicyIntakeLane("life",true),"manual");
 assert.equal(incomingPolicyIntakeLane("non_motor",true),"manual");
 process.env.INSUREIT_POLICY_OCR_PROVIDER="google";
 process.env.INSUREIT_POLICY_LANE_SPLIT="false";
 assert.equal(useN8nForAllPolicyReads(),false);
 assert.equal(segregatePolicyIntakeLanes(),false);
 assert.equal(incomingPolicyIntakeLane("motor",true),"manual");
} finally {
 if(oldProvider===undefined)delete process.env.INSUREIT_POLICY_OCR_PROVIDER;else process.env.INSUREIT_POLICY_OCR_PROVIDER=oldProvider;
 if(oldLane===undefined)delete process.env.INSUREIT_POLICY_LANE_SPLIT;else process.env.INSUREIT_POLICY_LANE_SPLIT=oldLane;
}
const readAction=read("app/policies/policy-ocr-actions.ts");
const panel=read("components/policy-ocr-import-panel.tsx");
const intakeOcr=read("lib/policy-intake-ocr-service.ts");
const router=read("lib/policy-intake-n8n-router.ts");
const intakeActions=read("app/policy-intakes/actions.ts");
const worker=read("lib/ai-policy-onboarding-queue-server.ts");
const manual=read("app/policy-intakes/page.tsx");
const auto=read("app/development/ai-policy-onboarding/page.tsx");
const detail=read("app/policy-intakes/[id]/page.tsx");
const handoff=read("app/policy-intakes/handoff-actions.ts");
const retry=read("app/policy-intakes/retry-actions.ts");
const migration=read("../../supabase/migrations/20261119131500_policy_intake_processing_lanes.sql");
assert(readAction.includes('if (useN8nForAllPolicyReads())')
 && readAction.includes('requestN8nPolicyIntakeExtraction({')
 && readAction.includes('legacy_google_training_disabled')
 && !readAction.includes('auto_finalize_allowed:true'),
 "Onboarding Read and disabled Google training must use verified no-booking n8n");
assert(panel.includes('n8nVerified=result.extractionMethod==="native_pdf_text"')
 && panel.includes('protectedKeys.has(field.key)')
 && panel.includes('verified local n8n PDF'),"Read must surface human-reviewed n8n fields without overriding protected entries");
assert(intakeOcr.includes('if (useN8nForAllPolicyReads())')
 && router.includes('if (useN8nForAllPolicyReads())')
 && router.includes('return extractPolicyIntakeWithN8nOnly(intakeId,storagePath,true);'),
 "Old Intake Google OCR path must fail closed to local n8n under feature gate");
assert(intakeActions.includes('incomingPolicyIntakeLane(input.policyType,aiQueueEnabled())')
 && intakeActions.includes('processing_lane:lane')
 && intakeActions.includes('manualSplit')
 && intakeActions.includes('segregatePolicyIntakeLanes()'),
 "Upload must persist lane once without enrolling manual Intakes");
assert(worker.includes('claim_policy_intake_ai_queue_v3')
 && auto.includes('.eq("processing_lane","automation")')
 && manual.includes('.eq("processing_lane","manual")')
 && detail.includes('!automated && !duplicateBlocked')
 && handoff.includes('data?.processing_lane==="automation"')
 && retry.includes('intake.processing_lane==="automation"'),
 "Manual vs automation register and server actions must be separated");
for(const guard of [
 "i.processing_lane='automation'",
 "i.final_policy_id is null",
 "current_user <> 'service_role'",
 "grant execute on function public.claim_policy_intake_ai_queue_v3",
 "q.state <> 'duplicate'",
 "i.file_name ~ '^3005[_-][0-9]'"
])assert(migration.includes(guard),"Missing guarded v3 migration rule: "+guard);
assert(!migration.includes("delete from") && !migration.includes("truncate ")
 && !migration.includes("update public.policies"),"Lane migration must not write registered policies");
console.log("n8n-only Policy Read and manual/automation lane regression: OK");
