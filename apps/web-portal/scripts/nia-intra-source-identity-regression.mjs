import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {niaIntraModelVariantConflict} from "../lib/policy-nia-intra-source-conflict.ts";

// Fully synthetic, non-PII source schedule labels: mimic the exact first-page
// two-column flow without preserving policyholder identity or policy numbers.
const source=(model,variant)=>[
 "THE NEW INDIA ASSURANCE CO. LTD.",
 "Commercial Vehicle Package Policy Enhanced Covers",
 "VEHICLE DETAILS",
 "Make/Model:              TATA MOTOR/TATA INTRA "+model+" TRUCK         Registration no.     MP-21",
 "Seating capacity including Driver: 2                            Variant:       INTRA "+variant+" LX",
].join("\n");
assert.equal(niaIntraModelVariantConflict(source("V30","V40")),true,
  "Contradictory insurer-printed V30/V40 must not be auto-bookable");
assert.equal(niaIntraModelVariantConflict(source("V30","V30")),false);
assert.equal(niaIntraModelVariantConflict(source("V40","V40")),false);
assert.equal(niaIntraModelVariantConflict(source("V40","V30")),true);
assert.equal(niaIntraModelVariantConflict(source("V30","V40").replace("TATA MOTOR","EICHER")),false,
  "Do not apply the New India Tata Intra rule to other makes");
assert.equal(niaIntraModelVariantConflict("Make/Model: TATA MOTOR/TATA INTRA V30 TRUCK"),false,
  "Missing variant falls back to existing field checks, not guessed identity");
assert.equal(niaIntraModelVariantConflict("Variant: INTRA V40 LX"),false);
assert.equal(niaIntraModelVariantConflict("Vehicle MAKE/MODEL: TATA MOTOR / TATA INTRA V30 TRUCK"),false);
const adapter=readFileSync(new URL("../lib/policy-nontata-commercial-n8n.ts",import.meta.url),"utf8");
assert.ok(adapter.includes('if(initial==="new_india_cv_native_pdf" && niaIntraModelVariantConflict(text))'));
assert.ok(adapter.includes('throw new Error("n8n_nia_intra_source_model_variant_conflict")'));
assert.ok(adapter.includes('return initial;'),"Do not override unrelated insurer recognition");
const bridge=readFileSync(new URL("../lib/policy-intake-semi-auto-n8n.ts",import.meta.url),"utf8");
assert.ok(bridge.includes('"n8n_nia_intra_source_model_variant_conflict"'));
assert.ok(bridge.includes('reason: "untrained_or_unverified"'));
assert.ok(bridge.includes('not an n8n webhook') || bridge.includes('never retry as an unavailable n8n'));
const queue=readFileSync(new URL("../lib/ai-policy-onboarding-queue-server.ts",import.meta.url),"utf8");
assert.ok(queue.includes('const validationFailed=untrained&&!layoutNeedsTraining'));
assert.ok(queue.includes('state:layoutNeedsTraining?"unsupported":validationFailed||retryExhausted?"exception"'));
console.log("NIA source-contradictory vehicle model vs variant holds only the mismatched family");
