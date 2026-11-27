import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
const actions=readFileSync(new URL("../app/development/ai-policy-onboarding/actions.ts",import.meta.url),"utf8");
const worker=readFileSync(new URL("../lib/ai-policy-auto-booking-server.ts",import.meta.url),"utf8");
assert.ok(actions.includes("try { await holdFailedAiConversion(id,result.issues); }"));
assert.ok(actions.includes('catch { console.error("[ai-policy] classified booking hold could not be persisted");'));
assert.ok(actions.includes("return result;"),"Preserve the actual classified preflight failure");
for(const [field,code] of [
 ["Product variant evidence","product_variant_review"],
 ["Missing verified PDF field","missing_verified_field"],
 ["Go Digit NEW JCB evidence","source_pdf_review"],
 ["PDF reconciliation","draft_conflict"],
 ["Owner-driver CPA","cpa_evidence_review"],
 ["Canonical Intake handoff","canonical_handoff_review"],
 ["Vehicle history","vehicle_history_review"],
 ["Saved issuance date","draft_conflict"],
 ["Product variant premium","premium_review"],
 ["United India GCV CPA","cpa_evidence_review"],
]){
 assert.ok(worker.includes('["'+field+'","'+code+'"]'),"Missing deterministic code: "+field);
}
assert.ok(worker.includes('return candidate?{state:"review_required",code:candidate}:{state:"uncertain",code:"conversion_outcome_unknown"}'));
assert.ok(worker.includes('await finish(claim,"uncertain","conversion_outcome_unknown",null)'));
assert.ok(worker.includes('const operatorToken=await verifiedOperatorToken()'));
assert.ok(!worker.includes('state:"pending",attempts:0'),"No automatic retry/reset of uncertain attempt");
console.log("Green verified preflight failures retain deterministic review codes; unknown booking remains no-retry");
