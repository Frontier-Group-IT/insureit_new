import assert from "node:assert/strict";
import {verifiedPolicyManufacturerBrand} from "../lib/policy-trained-make-alias.mjs";
const national={parserId:"national_gcv_package_native_pdf",checksPassed:18,warnings:[],make:"Eicher Motors Limited",model:"EICHER PRO 1110 EICHER PRO 1110"};
const mg={parserId:"tata_aig_private_car_saod_n8n_native_pdf",checksPassed:18,warnings:["tata_aig_human_review_required","tata_aig_receipt_date_as_issuance","tata_aig_printed_net_rounding"],make:"MORRIS GARAGES",model:"AS TOR / SELECT CVT"};
assert.equal(verifiedPolicyManufacturerBrand(national),"EICHER");
assert.equal(verifiedPolicyManufacturerBrand(mg),"MG");
for(const test of [{...national,checksPassed:17},{...national,model:"UNKNOWN"},{...national,make:"ROYAL ENFIELD"},{...mg,checksPassed:17},{...mg,model:"UNKNOWN"},{...mg,warnings:[...mg.warnings,"unverified_warning"]},{...mg,parserId:"tata_aig_private_car_package_n8n_native_pdf"}])
 assert.equal(verifiedPolicyManufacturerBrand(test),null,"Fail closed for unrelated PDF evidence");
// The Next/TypeScript draft module uses bundler resolution; Node 22 native
// strip-types does not resolve its extensionless imports. Inspect the exact
// handoff wiring here and let the full TypeScript/build gate compile it.
const {readFileSync}=await import("node:fs");
const {fileURLToPath}=await import("node:url");
const mapper=readFileSync(fileURLToPath(new URL("../lib/policy-ocr-onboarding-apply.ts",import.meta.url)),"utf8");
const handoff=readFileSync(fileURLToPath(new URL("../app/policy-intakes/handoff-actions.ts",import.meta.url)),"utf8");
assert.match(mapper,/verifiedPolicyManufacturerBrand\(\{/);
assert.match(mapper,/parserId:input\.sourceParserId/);
assert.match(mapper,/if\(sourceBrand\)/);
assert.match(handoff,/sourceParserId:verified\?\.parserId/);
assert.match(handoff,/sourceChecksPassed:verified\?\.checksPassed/);
// The queue must keep National owner-driver CPA unverified after the Eicher
// alias resolves; a green manufacturer is NOT an unattended booking grant.
const queue=readFileSync(fileURLToPath(new URL("../lib/ai-policy-onboarding-queue-server.ts",import.meta.url)),"utf8");
assert.match(queue,/const nationalCpaReview=extraction\.preview\.parserId==="national_gcv_package_native_pdf"/);
assert.match(queue,/if\(nationalCpaReview&&!isDuplicate&&!codes\.includes\("booking_review_required"\)\)/);
assert.match(queue,/national_gcv_owner_driver_cpa_unverified/);
console.log("Source-certified MG and Eicher queue/draft alias regressions passed");
