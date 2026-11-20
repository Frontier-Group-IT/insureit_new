import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const signed=file("../lib/policy-nontata-commercial-n8n.ts");
const preview=file("../lib/policy-intake-semi-auto-n8n.ts");
const queue=file("../lib/ai-policy-onboarding-queue-server.ts");
const eligibility=file("../lib/ai-policy-onboarding-eligibility.ts");
const component=file("../components/development/semi-auto-policy-workspace.tsx");
const actions=file("../app/development/ai-policy-onboarding/actions.ts");
const oldBridge=file("../lib/policy-intake-n8n-bridge.ts");
const handoff=file("../app/policy-intakes/handoff-actions.ts");
// An NIA RTO prefix is an unregistered vehicle, never a blocking incomplete
// registered plate. The source prefix must not fill registrationNo.
assert.match(signed,/isNewIndiaUnregistered/);
assert.match(signed,/fields\.filter\(\(f\) => f\.key !== "vehicle_registration_number"\)/);
assert.match(signed,/vehicle_registration_status"\) === "unregistered"/);
assert.match(handoff,/field\.key==="vehicle_registration_status"&&field\.value==="unregistered"/);
for (const id of ["go_digit_cv_native_pdf","new_india_cv_native_pdf","iffco_tokio_cv_native_pdf"]) {
  assert.ok(eligibility.includes(id), "AI queue must recognize trained parser "+id);
  assert.ok(signed.includes(id), "The signed-source path must retain exact parser identity "+id);
}
assert.match(preview,/tryReadNonTataCommercialSignedPolicy/);
assert.ok(preview.indexOf("tryReadNonTataCommercialSignedPolicy") <
          preview.indexOf("requestN8nPolicyIntakeBySignedSource({"),
 "The trained non-Tata candidate must be tried before the ICICI/Tata parser");
assert.match(signed,/TRUSTED_STORAGE_ORIGIN|ilzhsfqqjyppzzvfscmh\.supabase\.co/);
assert.match(signed,/content-length/);
assert.match(signed,/MAX_BYTES/);
assert.match(signed,/redirect: "error"/);
assert.match(signed,/checksPassed: expected\.filter/);
assert.match(signed,/Math\.abs\(cents\(od \+ tp\) - cents\(net\)\)/);
assert.match(signed,/Math\.abs\(cents\(net \+ gst\) - cents\(gross\)\)/);
assert.match(preview,/commercialPremium = commercial\.premium/);
assert.match(preview,/premium: null/);
assert.match(preview,/!commercialPremium &&/);
assert.match(component,/Verified printed commercial premium/);
assert.match(component,/n8nResult\.preview\.commercialPremium\.gross/);
assert.match(eligibility,/profile\.family==="commercial"/);
assert.match(queue,/ICICI_N8N_IDS\.has\(extraction\.preview\.parserId\)/);
assert.match(actions,/extracted\.preview\.premium \|\| extracted\.preview\.commercialPremium/);
assert.match(actions,/extracted\.preview\.checksPassed!==13/);
assert.match(oldBridge,/insureit-policy-intake-icici-v1/);
assert.doesNotMatch(signed,/supabaseAdmin|\.from\("policies"\)/);
assert.doesNotMatch(preview,/auto_finalize_allowed:\s*true/);
console.log("PASS: signed-source non-Tata AI queue routing, printed premiums, and ICICI/Tata/booking guards.");
