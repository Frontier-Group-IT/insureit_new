import assert from "node:assert/strict";
import {selectVerifiedN8nInsuredDraftIdentity as select} from "../lib/policy-n8n-onboarding-insured.ts";
const profiles=[
 ["magma_private_car_package_native_pdf","Magma PDF labelled policy schedule"],
 ["national_private_car_liability_only_native_pdf","NIA bilingual source-labelled policy and vehicle schedule"],
];
for(const [parser,evidence] of profiles){
 const fields=[{key:"insured_name",value:"Policyholder Example",page:null,evidence}];
 const result=select(fields,null,parser);
 assert.deepEqual({name:result.name,source:result.source,matchedCustomerId:result.matchedCustomerId},
 {name:"Policyholder Example",source:"verified_pdf",matchedCustomerId:null});
 assert.equal(select(fields,{id:"existing",name:"Different Customer"},parser).source,"conflict");
 assert.equal(select(fields,{id:"existing",name:"Policyholder Example"},parser).matchedCustomerId,"existing");
 assert.equal(select(fields.map(f=>({...f,evidence:"Unverified text"})),null,parser).name,"");
 assert.equal(select(fields.map(f=>({...f,page:1})),null,parser).name,"");
 assert.equal(select([fields[0],fields[0]],null,parser).name,"");
 assert.equal(select(fields.map(f=>({...f,value:"UNKNOWN"})),null,parser).name,"");
 assert.equal(select(fields,null,"unrecognized_insurer").name,"");
}
console.log("Held insurer verified name evidence and strict negatives passed");
