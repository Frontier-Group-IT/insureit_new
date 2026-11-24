import assert from "node:assert/strict";
import fs from "node:fs";
import { extractTataAigSigningDateProposal } from "../lib/policy-issuance-signature-evidence.ts";
import { validateTataAigN8nResponse } from "../lib/policy-intake-n8n-validation.ts";

const read=relative=>fs.readFileSync(new URL(relative,import.meta.url),"utf8");
function buildSignedPdf(time="D:20261119111104+00'00'", signer="TATA AIG", fullySigned=true, duplicate=false) {
  const content="<3080"+"0".repeat(2048)+">";
  const suffix="\\n/ByteRange [0 "+("0".repeat(10))+" "+("0".repeat(10))+" "+("0".repeat(10))+"]\\n%%EOF";
  const prelude="%PDF-1.7\\n/Type /Sig\\n/SubFilter /adbe.pkcs7.detached\\n/Name ("+signer+")\\n/M ("+time+")\\n/Contents ";
  const beforeBytes=Buffer.byteLength(prelude);
  const secondBegin=beforeBytes+Buffer.byteLength(content);
  const suffixLength=Buffer.byteLength(suffix);
  const ranged="\\n/ByteRange [0 "+String(beforeBytes).padStart(10,"0")+" "+String(secondBegin).padStart(10,"0")+" "+String(suffixLength).padStart(10,"0")+"]\\n%%EOF";
  const pdf=Buffer.from(prelude+content+ranged);
  assert.equal(pdf.byteLength,secondBegin+Buffer.byteLength(ranged));
  if(!fullySigned) {
    // Appending an unsigned revision changes the total PDF length, so the
    // signed ByteRange no longer covers the complete current document.
    return Buffer.concat([pdf,Buffer.from("UNSIGNED_TRAILING_BYTES")]);
  }
  return duplicate ? Buffer.concat([pdf,Buffer.from("\\n/ByteRange [0 1 3 4]\\n")]):pdf;
}
const twoW=buildSignedPdf();
const first=extractTataAigSigningDateProposal(twoW,"2026-11-19");
assert(first);
assert.equal(first.proposedDate,"2026-11-19");
assert.equal(first.source,"embedded_pdf_signature_timestamp");
assert.equal(first.verification,"signature_metadata_receipt_match");
assert.equal(first.requiresReviewerConfirmation,true);
assert.match(first.documentSha256,/^[a-f0-9]{64}$/);
assert.equal(extractTataAigSigningDateProposal(twoW,"2026-11-17"),null);
assert.equal(extractTataAigSigningDateProposal(buildSignedPdf(undefined,"OTHER"),"2026-11-19"),null);
assert.equal(extractTataAigSigningDateProposal(buildSignedPdf(undefined,"TATA AIG",false),"2026-11-19"),null);
assert.equal(extractTataAigSigningDateProposal(buildSignedPdf(undefined,"TATA AIG",true,true),"2026-11-19"),null);
assert.equal(extractTataAigSigningDateProposal(buildSignedPdf("D:20261319111104+00'00'"),"2026-11-19"),null);
assert.equal(extractTataAigSigningDateProposal(buildSignedPdf("D:20261117125401+00'00'"),"2026-11-17")?.proposedDate,"2026-11-17");
assert.equal(extractTataAigSigningDateProposal(new Uint8Array(0),"2026-11-17"),null);

const parse=new Function("$input",read("../../../infra/n8n-local/workflows/tata-aig-real-pdf-parser-v2.js"));
const normalize=new Function("$input","$",read("../../../infra/n8n-local/workflows/tata-aig-real-pdf-return-v2.js"));
const fixtures=JSON.parse(read("./fixtures/tata-aig-real-layout-anonymized.json"));
const ids={intake_id:"00000000-0000-4000-8000-000000000001",document_id:"00000000-0000-4000-8000-000000000002",request_id:"00000000-0000-4000-8000-000000000003"};
for(const fixture of fixtures) {
  const p=parse({all:()=>[{json:{text:fixture.text}}]})[0].json;
  assert.equal(p.ok,true,fixture.name);
  const response=normalize({first:()=>({json:p})},()=>({first:()=>({json:ids})}))[0].json;
  const validated=validateTataAigN8nResponse(response,{intakeId:ids.intake_id,documentId:ids.document_id,requestId:ids.request_id});
  assert.equal(validated.checksPassed,18);
  assert.match(validated.receiptDate,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(validated.fields.find(f=>f.key==="policy_issuance_date")?.value,validated.receiptDate,"Current PDF printed Receipt Date is accepted only under the Tata-specific 18-check rule");
  assert(validated.warnings.includes("tata_aig_receipt_date_as_issuance"));
  assert.notEqual(first.verification,"detached_signature_integrity_verified","Signature metadata proposal remains distinct from the approved printed receipt business rule");
}
const handoff=read("../app/policy-intakes/handoff-actions.ts");
const bridge=read("../lib/policy-intake-n8n-bridge.ts");
const studio=read("../components/development/semi-auto-policy-workspace.tsx");
assert(handoff.includes("reviewerConfirmedSigningDate"),"date requires explicit reviewer consent");
assert(handoff.includes("expectedDraftRevision"),"existing draft change must be guarded");
assert(handoff.includes("documentSha256"),"proposal must refer to the reviewed document");
assert(handoff.includes('policyDateDecision(reviewerConfirmedSigningDate.date)'),"policy date approval rules cannot be bypassed");
assert(bridge.includes("readEvidencePdf(signed)"),"signed-current-document download remains server-side");
assert(bridge.includes('SIGNED_OBJECT_PREFIX + input.intakeId'),"URL must be restricted to this intake");
assert(studio.includes("checked={approveSigningDate}"),"date approval must be affirmative");
assert(studio.includes("savedDraftIssueDate"),"display saved/manual date alongside proposed date");
console.log("Tata AIG issuance-date proposal: 6 anonymized layouts, strict PDF metadata, evidence and approval controls passed");
