import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf8");
const bridge = read("../lib/policy-nontata-commercial-n8n.ts");
const actions = read("../app/policies/policy-ocr-actions.ts");
const service = read("../lib/policy-intake-ocr-service.ts");
const router = read("../lib/policy-intake-n8n-router.ts");
const review = read("../components/policy-ocr-import-panel.tsx");
const apply = read("../lib/policy-ocr-onboarding-apply.ts");
const existingBridge = read("../lib/policy-intake-n8n-bridge.ts");

for (const parser of ["new_india_cv_native_pdf","iffco_tokio_cv_native_pdf","go_digit_cv_native_pdf"]) {
  assert.ok(bridge.includes(parser), "Only the three trained non-Tata layouts may be routed");
  assert.ok(review.includes(parser), "The reviewer must be allowed to select non-Tata confidence-null fields");
}
assert.match(bridge, /n8n\.nishant\.uk/);
assert.match(bridge, /\/webhook\/insureit-policy-intake-icici-v1/);
assert.match(bridge, /INSUREIT_N8N_OCR_WEBHOOK_URL/);
assert.match(bridge, /INSUREIT_N8N_OCR_ENDPOINT_MODE/);
assert.doesNotMatch(bridge, /\/webhook\/insureit-nontata-motor-pdf-candidate-v1/,
  "All trained insurers must use the original shared n8n workflow");
assert.match(bridge, /review_required !== true/);
assert.match(bridge, /auto_finalize_allowed !== false/);
assert.match(bridge, /payload\.intake_id !== ids\.intake_id/);
assert.match(bridge, /payload\.document_id !== ids\.document_id/);
assert.match(bridge, /payload\.request_id !== ids\.request_id/);
assert.match(bridge, /registration_complete/);
assert.match(bridge, /isNewIndiaUnregistered/);
assert.match(bridge, /rtoPrefix\(printedPlate\)/);
assert.match(bridge, /vehicle_registration_status"\) === "unregistered"/);
assert.match(bridge, /rtoPrefix\(printedPlate\)/);
assert.match(bridge, /vehicle_registration_status/);
assert.match(bridge, /fields\.filter\(\(f\) => f\.key !== "vehicle_registration_number"\)/);
assert.match(bridge, /if \(!response\.ok\) throw/);
assert.match(bridge, /gst_independently_evidenced/);
assert.match(bridge, /gross_net_tax_reconciled/);
assert.match(bridge, /invoice_gross_matches/);
// Real native PDF extraction can split the Go Digit issuer and commercial
// product across multiple lines and pages. Whitespace normalization must
// use the regex whitespace token, not a literal backslash followed by s.
assert.ok(bridge.includes(String.raw`head.replace(/\s+/g, " ")`),
  "Commercial recognition must normalize native-PDF line breaks");
assert.ok(!bridge.includes(String.raw`head.replace(/\\s+/g, " ")`),
  "A double-escaped literal regex silently misses whitespace");
assert.ok(bridge.includes("pages.slice(0, 3)"),
  "Allow the first three pages to identify the printed commercial layout");


for (const src of [actions,service,router]) {
  assert.match(src, /tryReadNonTataCommercialPolicy/);
}
assert.ok(actions.indexOf("tryReadNonTataCommercialPolicy") < actions.indexOf("if (isN8nPolicyReadEnabled())"),
  "Trained non-Tata PDFs must work even when the legacy global n8n provider switch is off");
assert.match(apply, /registrationMode = "unregistered"/);
assert.match(apply, /next\.registrationNo = ""/);
assert.match(apply, /registrationMode === "unregistered"\) skip\("vehicle_registration_number"\)/);
assert.match(existingBridge, /insureit-policy-intake-icici-v1/);
assert.doesNotMatch(bridge, /tata_aig_/);
assert.doesNotMatch(bridge, /supabaseAdmin|insert\(|update\(|delete\(/);
console.log("Non-Tata commercial normal Read registration and guard regression passed.");
