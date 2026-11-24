import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { incomingPolicyIntakeLane } from "../lib/policy-ocr-routing-mode.ts";

const read=(path)=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
for(const type of ["motor","non_motor","life","health","unknown"]) {
  assert.equal(incomingPolicyIntakeLane(type,true,true),"automation");
  assert.equal(incomingPolicyIntakeLane(type,false,false),"automation");
}
const upload=read("app/policy-intakes/actions.ts");
const partner=read("app/api/partner/policy-intakes/route.ts");
const worker=read("lib/ai-policy-onboarding-queue-server.ts");
const ai=read("app/development/ai-policy-onboarding/actions.ts");
const bridge=read("lib/policy-intake-semi-auto-n8n.ts");
const handoff=read("app/policy-intakes/handoff-actions.ts");
const register=read("app/policy-intakes/page.tsx");
const studio=read("app/development/ai-policy-onboarding/page.tsx");
const workspace=read("components/development/semi-auto-policy-workspace.tsx");
const retry=read("app/policy-intakes/retry-actions.ts");
const migration=read("../../supabase/migrations/20261124183000_unified_policy_intake_automation.sql");

assert(upload.includes('processing_lane:"automation"')
  && partner.includes('processing_lane:"automation"'),
  "All upload sources must write the unified automation marker.");
assert(upload.includes("processAiQueueBatch({preferredIntakeId:input.id})")
  && partner.includes("processAiQueueBatch({preferredIntakeId:input.id})"),
  "New uploads must trigger the same durable queue.");
assert(worker.includes('admin.rpc("claim_policy_intake_ai_queue_v3"'),
  "Worker must use the unified queue claim RPC.");
assert(!ai.includes("APPROVED_VARIANT_LEGACY_INTAKES")
  && !ai.includes("transferFailedAiIntakeToManual")
  && !bridge.includes("allowManualLane"),
  "No per-ID/manual-lane conversion bypass may remain.");
assert(handoff.includes("Manual policy onboarding is retired")
  && !workspace.includes("Move to Manual Onboarding")
  && !workspace.includes("transferFailedAiIntakeToManual"),
  "Old direct manual handoff and transfer dialog must be disabled.");
assert(!register.includes('.eq("processing_lane","manual")')
  && !studio.includes('.eq("processing_lane","automation")'),
  "Both registers must list all authorized Intakes without lane filters.");
assert(retry.includes("old manual OCR retry is retired"),
  "Legacy OCR retry cannot bypass n8n.");
assert(migration.includes("set processing_lane='automation'")
  && migration.includes("set default 'automation'")
  && migration.includes("check (processing_lane = 'automation')")
  && !migration.includes("where i.processing_lane='automation'")
  && migration.includes("drop function if exists public.move_policy_intake_automation_to_manual_v1")
  && migration.includes("i.final_policy_id is null")
  && migration.includes("current_user <> 'service_role'"),
  "DB migration must unify queue routing without weakening booking protection.");
assert(!migration.includes("delete from")&&!migration.includes("truncate ")
  &&!migration.includes("update public.policies"),
  "No policies or current queue states are deleted or reset.");
console.log("Unified AI Policy Intake automation regression: OK");
