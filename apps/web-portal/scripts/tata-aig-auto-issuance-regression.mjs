import assert from "node:assert/strict";
import fs from "node:fs";
import { acceptedTataAigIssuanceDate, assessAiPolicyIntake, hasVerifiedN8nParserEvidence } from "../lib/ai-policy-onboarding-eligibility.ts";
import { policyDateDecision } from "../lib/policy-date-rule.ts";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const parser=new Function("$input",read("../../../infra/n8n-local/workflows/tata-aig-real-pdf-parser-v2.js"));
const normalizer=new Function("$input","$",read("../../../infra/n8n-local/workflows/tata-aig-real-pdf-return-v2.js"));
const fixtures=JSON.parse(read("./fixtures/tata-aig-real-layout-anonymized.json"));
const ids={intake_id:"00000000-0000-4000-8000-000000000001",document_id:"00000000-0000-4000-8000-000000000002",request_id:"00000000-0000-4000-8000-000000000003"};
const codes=x=>x.exceptions.map(e=>e.code);
function evidence(date,receiptDate=date) {
  return {proposedDate:date,receiptDate,
    source:"embedded_pdf_signature_timestamp",
    verification:"detached_signature_integrity_verified",
    documentSha256:"a".repeat(64),requiresReviewerConfirmation:false};
}
function eligible(preview,issuanceDateVerified) {
  return assessAiPolicyIntake({
    policyType:"motor",intakeStatus:"processing",isDuplicate:false,
    hasCurrentDocument:true,documentStillCurrent:true,
    parserId:preview.parser_id,parserChecksPassed:18,extractionState:"success",
    extractionWarnings:preview.warnings,
    fields:preview.fields.map(f=>({key:f.key,value:f.value})),
    premiumReconciled:true,matchedManufacturer:true,customerMatch:"none",
    sharedPhoneHasDistinctNames:false,existingCustomerSameIdentity:false,
    reviewerAssignedToAnother:false,vehicleOwnerConflict:false,coverageConflict:false,
    savedDraftConflictsWithPdf:false,issuanceDateVerified,needsDateApproval:false,
    bundledPeriodsVerified:true,canonicalPreflightPassed:false,
  });
}
assert.equal(fixtures.length,6);
for(const fixture of fixtures) {
  const parsed=parser({all:()=>[{json:{text:fixture.text}}]})[0].json;
  assert.equal(parsed.ok,true,fixture.name);
  const preview=normalizer({first:()=>({json:parsed})},
    ()=>({first:()=>({json:ids})}))[0].json;
  const receipt=parsed.premium_components.receipt_date;
  assert.match(receipt,/^\d{4}-\d{2}-\d{2}$/);
  const v={parserId:preview.parser_id,checksPassed:18,warnings:preview.warnings,
    fields:preview.fields,issuanceEvidence:evidence(receipt)};
  assert.equal(acceptedTataAigIssuanceDate(v),receipt,fixture.name);
  assert.equal(acceptedTataAigIssuanceDate({...v,issuanceEvidence:{...v.issuanceEvidence,verification:"signature_metadata_receipt_match"}}),null,
    "An unverified /M and ByteRange cannot become an accepted issuance date");
  assert.deepEqual(codes(eligible(preview,true)),["preflight_pending"],
    "Matching signing/receipt date must clear issuance exception without bypassing canonical preflight");
  assert.equal(acceptedTataAigIssuanceDate({...v,issuanceEvidence:evidence("2026-10-20",receipt)}),null);
  assert.equal(acceptedTataAigIssuanceDate({...v,issuanceEvidence:undefined}),null);
  const futureDate=new Date(Date.now()+3*86_400_000).toISOString().slice(0,10);
  assert.equal(acceptedTataAigIssuanceDate({...v,issuanceEvidence:evidence(futureDate)}),null,
    "Never infer future issuance, even if it falls later in the current month");
  assert.equal(acceptedTataAigIssuanceDate({...v,checksPassed:17}),null);
  assert.equal(acceptedTataAigIssuanceDate({...v,warnings:[...v.warnings,"untrusted_new_warning"]}),null);
  assert.equal(acceptedTataAigIssuanceDate({...v,parserId:"icici_3005_n8n_native_pdf"}),null);
  assert.equal(acceptedTataAigIssuanceDate({...v,parserId:"unknown_parser"}),null);
  assert.equal(acceptedTataAigIssuanceDate({...v,issuanceEvidence:{...v.issuanceEvidence,documentSha256:"bad"}}),null);
  assert.equal(acceptedTataAigIssuanceDate({...v,issuanceEvidence:{...v.issuanceEvidence,proposedDate:"2026-02-30",receiptDate:"2026-02-30"}}),null);
  assert(codes(eligible(preview,false)).includes("issuance_date_unverified"));
  assert(hasVerifiedN8nParserEvidence(v.parserId,18,v.warnings));
}
assert.equal(policyDateDecision("2026-10-01","2026-11-20"),"otp_required",
  "Backdated issuance still needs existing OTP; auto-acceptance does not override it");
assert.equal(policyDateDecision("2026-12-01","2026-11-20"),"future");

const worker=read("../lib/ai-policy-onboarding-queue-server.ts");
const handoff=read("../app/policy-intakes/handoff-actions.ts");
const preview=read("../lib/policy-intake-semi-auto-n8n.ts");
const ui=read("../components/development/semi-auto-policy-workspace.tsx");
const actions=read("../app/development/ai-policy-onboarding/actions.ts");
assert(worker.includes("acceptedTataAigIssuanceDate({"));
assert(worker.includes('+"-issue-date-v3"'),"old exception rows must be eligible for bounded reassessment");
assert(worker.includes('needsDateApproval:issuanceDecision==="otp_required"'),
 "Backdate/OTP approvals remain separate from issuance validation");
assert(worker.includes('state:"verified"')||worker.includes('"verified"'));
assert(preview.includes('acceptedIssuanceDate=acceptedTataAigIssuanceDate({'));
assert(preview.includes('warning!=="tata_aig_issuance_date_unverified"'),
 "Do not show a stale date-unverified warning for accepted dates");
assert(preview.includes('documentSha256:issuanceEvidence.documentSha256'),
 "Bind queue/review fingerprint to exact signed PDF bytes");
assert(handoff.includes('const autoDate=parsed.preview.acceptedIssuanceDate'));
assert(handoff.includes('autoAcceptedIssuanceDate?.date'));
assert(handoff.includes('AUTO_TATA_ISSUANCE_DATE:'),
 "Preserve old issue date and hash in draft audit notes");
assert(handoff.includes('.eq("intake_id",id).eq("revision",existingDraft.revision)'),
 "Existing draft correction must use optimistic revision control");
assert(ui.includes('Issuance date automatically accepted: '));
assert(ui.includes('!n8nResult.preview.acceptedIssuanceDate ? ('),
 "Do not demand manual date confirmation for accepted dates");
assert(actions.includes('extracted.preview.checksPassed!==13'),
 "Never turn Tata automated date eligibility into unreviewed full auto-booking");
assert(handoff.includes('issuanceDate:verified?(verifiedIssuanceDate||approvedSigningDate):""'),
 "Never prefill a new onboarding draft with today's date when issuance evidence is absent");
console.log("Tata signing/receipt auto issuance: six policy variants, negative controls, audit and booking gates passed");
