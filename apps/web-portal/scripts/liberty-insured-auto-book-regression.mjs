import assert from "node:assert/strict";
import {selectVerifiedN8nInsuredDraftIdentity} from "../lib/policy-n8n-onboarding-insured.ts";
const exact=(name,evidence="Liberty Insured row",page=null)=>
 [{key:"insured_name",value:name,evidence,page}];
for(const name of ["NARENDRA SINGH RAWAT","JAYDEEP KUMAR","CHANDRA PRAKASH"]){
 const verified=selectVerifiedN8nInsuredDraftIdentity(
   exact(name),null,"liberty_two_wheeler_tp_native_pdf");
 assert.equal(verified.name,name);
 assert.equal(verified.source,"verified_pdf");
 assert.equal(verified.matchedCustomerId,null,"Do not infer/link a customer from PDF only");
 const conflict=selectVerifiedN8nInsuredDraftIdentity(
   exact(name),{id:"linked-customer",name:"DIFFERENT CUSTOMER"},"liberty_two_wheeler_tp_native_pdf");
 assert.equal(conflict.name,name,"PDF name is authoritative for editable draft");
 assert.equal(conflict.source,"conflict");
 assert.equal(conflict.matchedCustomerId,null);
 const matched=selectVerifiedN8nInsuredDraftIdentity(
   exact(name),{id:"linked-customer",name}, "liberty_two_wheeler_tp_native_pdf");
 assert.equal(matched.matchedCustomerId,"linked-customer");
 assert.equal(matched.source,"linked_master");
}
for(const bad of [
 {fields:exact("JAYDEEP KUMAR","Unverified lead source"),parser:"liberty_two_wheeler_tp_native_pdf"},
 {fields:exact("JAYDEEP KUMAR","Liberty Insured row",1),parser:"liberty_two_wheeler_tp_native_pdf"},
 {fields:exact("JAYDEEP KUMAR"),parser:"untrained_liberty_variant"},
 {fields:exact("UNKNOWN"),parser:"liberty_two_wheeler_tp_native_pdf"},
 {fields:[...exact("JAYDEEP KUMAR"),...exact("JAYDEEP KUMAR")],parser:"liberty_two_wheeler_tp_native_pdf"},
 ]){
 const z=selectVerifiedN8nInsuredDraftIdentity(bad.fields,null,bad.parser);
 assert.equal(z.matchedCustomerId,null);
 assert.equal(z.name,"","Unverified or ambiguous identity cannot auto-populate booking draft");
 assert.equal(z.needsManualReview,true);
}
console.log("Liberty verified insured-name mapping and identity-conflict tests passed");
