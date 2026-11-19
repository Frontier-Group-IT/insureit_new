import assert from "node:assert/strict";
import fs from "node:fs";
import {
  assessAiPolicyIntake, trainedN8nParserProfile, hasVerifiedN8nParserEvidence,
} from "../lib/ai-policy-onboarding-eligibility.ts";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const parser=new Function("$input",read("../../../infra/n8n-local/workflows/tata-aig-real-pdf-parser-v2.js"));
const normalizer=new Function("$input","$",read("../../../infra/n8n-local/workflows/tata-aig-real-pdf-return-v2.js"));
const fixtures=JSON.parse(read("./fixtures/tata-aig-real-layout-anonymized.json"));
const ids={
 intake_id:"00000000-0000-4000-8000-000000000001",
 document_id:"00000000-0000-4000-8000-000000000002",
 request_id:"00000000-0000-4000-8000-000000000003",
};
const codes=assessment=>assessment.exceptions.map(e=>e.code);
const evaluate=(preview,extra={})=>assessAiPolicyIntake({
 policyType:"motor",intakeStatus:"processing",isDuplicate:false,
 hasCurrentDocument:true,documentStillCurrent:true,
 parserId:preview.parser_id,parserChecksPassed:18,extractionState:"success",
 extractionWarnings:preview.warnings,
 fields:preview.fields.map(field=>({key:field.key,value:field.value})),
 premiumReconciled:true,matchedManufacturer:true,customerMatch:"none",
 sharedPhoneHasDistinctNames:false,existingCustomerSameIdentity:false,
 reviewerAssignedToAnother:false,vehicleOwnerConflict:false,
 coverageConflict:false,savedDraftConflictsWithPdf:false,
 issuanceDateVerified:false,needsDateApproval:false,
 bundledPeriodsVerified:true,canonicalPreflightPassed:false,...extra,
});
assert.equal(fixtures.length,6);
for(const [i,fixture] of fixtures.entries()){
 const p=parser({all:()=>[{json:{text:fixture.text}}]})[0].json;
 assert.equal(p.ok,true,fixture.name);
 assert.equal(p.checks_passed,18);
 const x=normalizer({first:()=>({json:p})},()=>({first:()=>({json:ids})}))[0].json;
 assert.equal(x.ok,true);
 assert.equal(trainedN8nParserProfile(x.parser_id)?.checks,18);
 assert.equal(hasVerifiedN8nParserEvidence(x.parser_id,18,x.warnings),true);
 assert.deepEqual(codes(evaluate(x)),["issuance_date_unverified"],
  fixture.name+" reviewed extraction must not be classified as unsupported/unverified");
 assert.deepEqual(codes(evaluate(x,{savedDraftConflictsWithPdf:true})),
  ["issuance_date_unverified","draft_conflict"],"pre-existing manual draft differences require review");
 assert.deepEqual(codes(evaluate(x,{matchedManufacturer:false})),
  ["manufacturer_unmatched","issuance_date_unverified"]);
 assert.deepEqual(codes(evaluate(x,{issuanceDateVerified:true})),
  ["preflight_pending"],"verified extraction still needs canonical booking preflight");
 assert(codes(evaluate(x,{parserChecksPassed:17})).includes("unverified_parser"));
 assert(codes(evaluate(x,{extractionWarnings:[...x.warnings,"unexpected_extractor_warning"]}))
   .includes("unverified_parser"));
 assert(codes(evaluate(x,{policyType:"health"})).includes("unsupported_layout"));
 assert(codes(evaluate(x,{parserId:"unknown_parser"})).includes("unsupported_layout"));
 const tw=i<4;
 const missingFields=x.fields.filter(f=>f.key!=="vehicle_motor_power_kw");
 assert.equal(codes(evaluate(x,{fields:missingFields})).includes("missing_field"),tw,
  "kW mandatory for electric two-wheeler, not for petrol/diesel private car");
 const registration=x.fields.filter(f=>f.key!=="vehicle_registration_number");
 if(!tw)assert(codes(evaluate(x,{fields:registration})).includes("missing_field"));
 assert(!codes(evaluate(x,{sharedPhoneHasDistinctNames:true})).includes("customer_identity"),
  "phone with differing insured names must use existing new-customer onboarding path");
}
assert.deepEqual(trainedN8nParserProfile("icici_3005_n8n_native_pdf"),
 {checks:13,family:"icici"});
assert.deepEqual(trainedN8nParserProfile("icici_3005_od_n8n_native_pdf"),
 {checks:13,family:"icici"});
assert(hasVerifiedN8nParserEvidence("icici_3005_n8n_native_pdf",13,[]));
assert(!hasVerifiedN8nParserEvidence("icici_3005_n8n_native_pdf",13,
 ["tata_aig_human_review_required"]));
assert(!hasVerifiedN8nParserEvidence("tata_aig_two_wheeler_bundled_n8n_native_pdf",13,[]));

const worker=read("../lib/ai-policy-onboarding-queue-server.ts");
assert(worker.includes("premiumReconciled:verifiedParserEvidence"));
assert(worker.includes("const bundledPeriodsVerified=!bundled||("));
assert(worker.includes("&& hasVerifiedN8nParserEvidence(extraction.preview.parserId,"));
assert(worker.includes('ICICI_N8N_IDS.has(extraction.preview.parserId)'),
 "only warning-free ICICI may use canonical OCR-sync RPC");
assert(worker.includes('p_checks_passed:13,'),
 "do not change live guarded 13-check ICICI OCR sync RPC contract");
console.log("AI Studio Tata AIG queue eligibility: 6 layouts, ICICI regression and negative controls passed");
