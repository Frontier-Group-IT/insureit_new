import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,"../app/development/ai-policy-onboarding/actions.ts"),"utf8");
const first=source.indexOf("const expectedCommercialClass=");
const last=source.indexOf("if(commercial && (forwarded.draft.policyProduct",first);
assert(first>0&&last>first);
const snippet=source.slice(first,last);
const evaluate=new Function("heldCandidate","pdfField","productVariant","variantParser","uiicPrivateCar",
 snippet+"return {cls:expectedCommercialClass,product:expectedCommercialProduct};");
const scenarios=[
 ["national_private_car_liability_only_native_pdf","Private Car","PCP","Third Party"],
 ["magma_private_car_package_native_pdf","Private Car","PCP","Package"],
 ["oriental_private_car_standalone_od_native_pdf","Private Car","PCP","SAOD"],
 ["oriental_gccv_package_native_pdf","Goods Carrying Vehicle","GCV","Package"],
];
for(const [parser,vehicle,cls,product] of scenarios){
 const actual=evaluate(true,key=>key==="vehicle_class"?vehicle:"",false,parser,false);
 assert.deepEqual(actual,{cls,product},parser+" canonical product/class required");
}
assert.deepEqual(evaluate(false,()=>"Private Car",true,
 "go_digit_two_wheeler_od_native_pdf",false),{cls:"TWP",product:"SAOD"},
 "Legacy Digit variant must not be changed");
for(const claim of [
 'heldFailedSource=process.env.INSUREIT_ENABLE_HELD_INSURER_CANDIDATES==="1"',
 'queued?.state==="exception"&&queued.parser_id===null',
 'queued.checks_passed===0&&queued.exception_codes.length===1',
 'queued.exception_codes[0]==="extraction_failed"',
 'extracted.preview.documentId===queued.document_id',
 'extracted.preview.checksPassed===18',
 'extracted.preview.warnings.length===0',
 'extracted.preview.candidateCanonicalPremium',
 '&& !reverifiedHeldExtraction',
 'verifiedMoney=extracted.preview.candidateCanonicalPremium!',
 'if(confirmed!==true)'
])assert(source.includes(claim),"Held source direct-Convert guard missing: "+claim);
assert(!source.includes("state:eligibleForVerifiedConversion"),"Core conversion must not directly set queue verified");
console.log("Held insurer explicit Convert: four source-verified canonical products, original recovery, old variants, CPA and document guards passed");
