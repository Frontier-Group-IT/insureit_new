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
// SAOD policies have no newly issued TP coverage. The canonical queue must
// not label a fully verified OD-only schedule "Mandatory field missing".
const standalone=JSON.parse(read("./fixtures/tata-aig-n8n-saod-synthetic.json"));
// The synthetic SAOD fixture includes a reference to an earlier TP policy.
// Remove it to exercise an equally valid standalone OD-only document.
standalone.fields=standalone.fields.filter(f=>f.key!=="third_party_end_date");
assert(!codes(evaluate(standalone)).includes("missing_field"),
 "Tata standalone OD does not require third-party_end_date");
assert.deepEqual(codes(evaluate(standalone,{issuanceDateVerified:true})),
 ["preflight_pending"],"SAOD accepted extraction still undergoes canonical booking preflight");
const packageWithoutTp=JSON.parse(read("./fixtures/tata-aig-n8n-package-synthetic.json"));
packageWithoutTp.fields=packageWithoutTp.fields.filter(f=>f.key!=="third_party_end_date");
assert(codes(evaluate(packageWithoutTp)).includes("missing_field"),
 "Tata Package still requires third-party expiry");

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
assert(worker.includes("sync_verified_ai_intake_tata_tp_ocr_v1"),
 "strict Tata AIG TP OCR must use dedicated guarded RPC");
assert(worker.includes('const tata18 = [')
  &&worker.includes('sync_verified_ai_intake_tata_18_ocr_v1')
  &&worker.includes('|| tataTpOnly || tata18'),
  "All 18-check Tata AIG source-verified PDFs must persist OCR, not remain Processing");
const tata18Migration=read("../../../supabase/migrations/20261124190000_tata_aig_18check_verified_ocr_sync.sql");
assert(tata18Migration.includes("current_user <> 'service_role'")
  &&tata18Migration.includes("p_checks_passed <> 18")
  &&tata18Migration.includes("p_parser_version <> 'tata-aig-layout-v1'")
  &&tata18Migration.includes("q.leased_until>now()")
  &&tata18Migration.includes("d.is_current=true")
  &&tata18Migration.includes("i.final_policy_id is null")
  &&tata18Migration.includes("not exists (")
  &&tata18Migration.includes("policy_intake_onboarding_drafts")
  &&tata18Migration.includes("status='ready_for_review'")
  &&tata18Migration.includes("ocr_status='completed'")
  &&!tata18Migration.includes("insert into public.policies")
  &&!tata18Migration.includes("insert into public.customers"),
  "Tata AIG OCR sync must be current-PDF, lease, revision and no-booking guarded");
assert.deepEqual(codes(evaluate(standalone,{issuanceDateVerified:false})).filter(x=>x==="issuance_date_unverified"),["issuance_date_unverified"],
  "Missing verified issuance remains review-controlled even after OCR sync");
assert(worker.includes("sync_verified_ai_intake_ocr_v2"),
 "existing guarded ICICI OCR sync remains unchanged");
assert(worker.includes("p_checks_passed:extraction.preview.checksPassed,"),
 "OCR sync must pass only the checks count verified for its parser family");
// Client and server must use the SAME verified parser profile. Tata warnings
// requiring manual issuance review must not hide the safe editable-draft handoff.
const workspace=read("../components/development/semi-auto-policy-workspace.tsx");
assert(workspace.includes('import { hasVerifiedN8nParserEvidence }'));
assert(workspace.includes('!hasVerifiedN8nParserEvidence(\n        fresh.preview.parserId,'));
assert(workspace.includes('!n8nResult?.ok || !hasVerifiedN8nParserEvidence('));
assert(workspace.includes('&& hasVerifiedN8nParserEvidence(\n                    n8nResult.preview.parserId,'));
assert(!workspace.includes('fresh.preview.warnings.length || fresh.preview.checksPassed !== 13'));
assert(!workspace.includes('n8nResult.preview.warnings.length === 0 ? ('));
assert(workspace.includes('continueVerifiedN8nIntakeToOnboarding('));
const backend=read("../app/policy-intakes/handoff-actions.ts");
assert(backend.includes('const blockingWarnings = parsed.preview.warnings.filter('));
assert(backend.includes('informationalTataWarnings.has(warning)'));
// A successful Tata AIG 18-check reparse must not be reset to the generic
// bulk_conversion_review_required hold solely because it is not TP-only.
// Date, canonical premium, and source evidence remain mandatory.
assert(backend.includes("const tata18Ready=[")
  &&backend.includes("hasVerifiedN8nParserEvidence(verified.parserId,verified.checksPassed,verified.warnings)")
  &&backend.includes("verified.autoAcceptedIssuanceDate?.date")
  &&backend.includes('verified.fields.find(field=>field.key==="policy_issuance_date")?.value')
  &&backend.includes("const eligibleForVerifiedConversion=tata18Ready||verifiedTataTp"),
  "Tata 18-check Package/SAOD/Bundled must reach verified Convert when date and premium are certified");
assert(!backend.includes('policyDateDecision(verified.autoAcceptedIssuanceDate?.date??"")==="valid"'),
  "Do not invent a policy-date decision; use the canonical allowed/OTP gate");
assert(backend.includes('trainedN8nParserProfile(parsed.preview.parserId)?.checks'),
 "handoff must use insurer-specific 16/18/13 check profiles");
assert.equal(trainedN8nParserProfile("tata_aig_private_car_liability_only_n8n_native_pdf")?.checks,16);
assert.equal(trainedN8nParserProfile("tata_aig_private_car_three_year_tp_n8n_native_pdf")?.checks,16);
assert(hasVerifiedN8nParserEvidence("tata_aig_private_car_three_year_tp_n8n_native_pdf",16,
 ["tata_aig_issuance_date_requires_verified_pdf_signature","tata_aig_human_review_required"]));

const tataParser=read("../../../infra/n8n-local/workflows/tata-aig-real-pdf-parser-v2.js");
const tataReturn=read("../../../infra/n8n-local/workflows/tata-aig-real-pdf-return-v2.js");
assert(tataParser.includes("printedPolicyIssueDate(text)")
  &&tataParser.includes("printed_receipt_business_rule")
  &&tataParser.includes("printed_issue_date_ambiguous:printedIssue.ambiguous"),
 "Explicit issue date wins, with source-labelled receipt fallback and conflict hold");
assert(tataReturn.includes("Tata AIG printed Receipt Date (approved issuance rule)")
  &&tataReturn.includes("tata_aig_receipt_date_as_issuance"),
 "Receipt-derived issue date must retain transparent source evidence");
const sourceValidation=read("../lib/policy-intake-n8n-validation.ts");
assert(sourceValidation.includes("approvedReceiptIssue")
  &&sourceValidation.includes("issueField.value===receiptDate")
  &&sourceValidation.includes("checks.receipt_date_document_consistent===true"),
 "Tata receipt issue date must be PDF-labelled, 18-check verified and consistent");
const conversion=read("../app/development/ai-policy-onboarding/actions.ts");
assert(conversion.includes("!hasVerifiedN8nParserEvidence(extracted.preview.parserId,"),
 "Bulk conversion must accept only the trained insurer's exact strict check profile");
assert(conversion.includes("extracted.preview.acceptedIssuanceDate"),
 "Tata conversion must use PDF-verified signature/receipt date, not inferred cover start");
assert(conversion.includes("mapVerifiedN8nMotorPremium(extracted.preview.premium)"),
 "Tata canonical premium mapping must remain independently reconciled");
assert(conversion.includes("reverifiedTataFailedSource")
  &&conversion.includes("reverifiedTataPrintedDateHold"),
  "Old failed Tata source and stale fingerprint need explicit exact-PDF recovery");
assert(conversion.includes("const booked=await onboardPolicy(payload)"),
 "Tata conversion must use canonical booking transaction and its conflict gates");
assert(conversion.includes("if(confirmed!==true)"),
 "Unconfirmed or unattended registration must remain blocked");
assert(!conversion.includes("extracted.preview.checksPassed!==13||extracted.preview.warnings.length"),
 "Old ICICI-only 13-check gate must not reject independently verified Tata");
console.log("AI Studio Tata AIG queue eligibility, strict canonical bulk conversion and negative controls passed");
