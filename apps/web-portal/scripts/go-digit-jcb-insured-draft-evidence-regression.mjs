import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {selectVerifiedN8nInsuredDraftIdentity} from "../lib/policy-n8n-onboarding-insured.ts";

const source=[
 {key:"insured_name",value:"SYNTHETIC CUSTOMER",page:null,evidence:"Native PDF policy schedule"},
];
const verified=selectVerifiedN8nInsuredDraftIdentity(
 source,null,"go_digit_jcb_new_unregistered_native_pdf");
assert.deepEqual(verified,{
 name:"SYNTHETIC CUSTOMER",matchedCustomerId:null,needsManualReview:true,
 source:"verified_pdf",
},"Go Digit JCB original PDF may fill an EDITABLE draft identity, never link master");
const matching=selectVerifiedN8nInsuredDraftIdentity(
 source,{id:"synthetic-master",name:"SYNTHETIC CUSTOMER"},
 "go_digit_jcb_new_unregistered_native_pdf");
assert.equal(matching.source,"linked_master");
assert.equal(matching.matchedCustomerId,"synthetic-master");
const conflict=selectVerifiedN8nInsuredDraftIdentity(
 source,{id:"synthetic-master",name:"OTHER CUSTOMER"},
 "go_digit_jcb_new_unregistered_native_pdf");
assert.equal(conflict.source,"conflict");
assert.equal(conflict.matchedCustomerId,null);
assert.equal(conflict.needsManualReview,true);
for(const untrusted of [
 [{key:"insured_name",value:"SYNTHETIC CUSTOMER",page:1,evidence:"Native PDF policy schedule"}],
 [{key:"insured_name",value:"SYNTHETIC CUSTOMER",page:null,evidence:"Unverified user input"}],
 [{key:"insured_name",value:"UNKNOWN",page:null,evidence:"Native PDF policy schedule"}],
 [...source,...source],
]) {
 const result=selectVerifiedN8nInsuredDraftIdentity(
  untrusted,null,"go_digit_jcb_new_unregistered_native_pdf");
 assert.equal(result.source,"missing");
 assert.equal(result.name,"");
 assert.equal(result.matchedCustomerId,null);
}
assert.equal(selectVerifiedN8nInsuredDraftIdentity(
 source,null,"unsupported_arbitrary_parser").name,"");
const importer=readFileSync(new URL("../lib/policy-n8n-onboarding-insured.ts",import.meta.url),"utf8");
assert.ok(importer.includes('"go_digit_jcb_new_unregistered_native_pdf"'));
assert.ok(importer.includes('field.page === null && field.evidence === "Native PDF policy schedule"'));
const worker=readFileSync(new URL("../lib/ai-policy-auto-booking-server.ts",import.meta.url),"utf8");
assert.ok(worker.includes("convertVerifiedAiIntake"),"Draft evidence never bypasses canonical conversion checks");
console.log("Go Digit JCB source-backed editable insured name preserves master conflict and manual review");
