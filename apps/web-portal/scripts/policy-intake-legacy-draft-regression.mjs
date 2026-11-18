import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const read=path=>readFileSync(new URL("../"+path,import.meta.url),"utf8");
const projector=read("lib/policy-intake-verified-draft-reconcile.ts");
const actions=read("app/development/ai-policy-onboarding/verified-draft-actions.ts");
const ui=read("components/development/semi-auto-policy-workspace.tsx");
const queue=read("lib/ai-policy-onboarding-queue-server.ts");
const page=read("app/development/ai-policy-onboarding/page.tsx");

for(const required of ["issuanceDate","policyNo","validFrom","validUpto",
  "tpValidUpto","insurerId","od","addOnPremium","tp","cpa",
  "vehicleClass","fuelType","capacity"]){
  assert(projector.includes('  "'+required+'"')||projector.includes('"'+required+'"'),
    "Missing approved field "+required);
}
const whitelist=projector.split("export const RECONCILABLE_FIELDS = [")[1]?.split("] as const")[0]??"";
for(const forbidden of ["insuredName","phoneNo","rmName","leadSource",
  "intermediaryCode","payoutBasis","remarks","registrationNo","matchedCustomerId"]){
  assert(!whitelist.includes('"'+forbidden+'"'),"Disallowed identity or financial field leaked: "+forbidden);
}
for(const guard of [
 'requireCapability("manage_system","approve")',
 'requirePolicyCreator()',
 'requirePolicyIntakeReviewer(id)',
 'requirePolicyIntakeFinalizer(id)',
 'parsed.preview.documentId!==q.document_id',
 'parsed.preview.fingerprint!==q.extraction_fingerprint',
 'parsed.preview.checksPassed!==13',
 'duplicate.matches.has(id)',
 'normalized(stored.draft_payload.insuredName',
 'keys.some(k=>!diffByKey.has',
 '.eq("revision",expectedRevision)',
 'updated_by_profile_id:current.operatorId',
 'revalidatePath("/development/ai-policy-onboarding")',
]){
  assert(actions.includes(guard),"Missing safe legacy-draft guard "+guard);
}
assert(actions.includes('policyDateDecision(rawDate)')&&
       actions.includes('return {error:"The current PDF does not provide a valid issued-on date.'),
  "Never infer an issue date or silently bypass date checks");
assert(actions.includes('remarks=(current.draft.remarks||"")')&&
       !actions.includes('.from("policies").insert('),
  "Reconciliation must be an audited draft-only update");
assert(ui.includes("Compare saved draft with PDF")&&
       ui.includes("legacyReview.differences.map")&&
       ui.includes("legacySelected.includes(diff.key)")&&
       ui.includes("inspected.differences.filter(d=>d.wasBlank)")&&
       ui.includes("Existing value — explicitly review before replacing it."),
  "UI must show explicit consent for every existing saved value");
assert(queue.includes('field_keys:Array.isArray(r.field_keys)')&&
       page.includes("ai_field_keys: queue.get(row.id)?.field_keys")&&
       ui.includes("Missing from last n8n extraction:"),
  "Exception UI must show actual absent extracted field keys");
console.log("Verified ICICI draft reconciliation authorization, CAS, consent and diagnostics guards PASS");
