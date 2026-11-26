import assert from "node:assert/strict";
import {verifiedPolicyManufacturerBrand} from "../lib/policy-trained-make-alias.ts";
import {buildPolicyOcrOnboardingUpdate} from "../lib/policy-ocr-onboarding-apply.ts";
const national={parserId:"national_gcv_package_native_pdf",checksPassed:18,warnings:[],make:"Eicher Motors Limited",model:"EICHER PRO 1110 EICHER PRO 1110"};
const mg={parserId:"tata_aig_private_car_saod_n8n_native_pdf",checksPassed:18,warnings:["tata_aig_human_review_required","tata_aig_receipt_date_as_issuance","tata_aig_printed_net_rounding"],make:"MORRIS GARAGES",model:"AS TOR / SELECT CVT"};
assert.equal(verifiedPolicyManufacturerBrand(national),"EICHER");
assert.equal(verifiedPolicyManufacturerBrand(mg),"MG");
for(const test of [{...national,checksPassed:17},{...national,model:"UNKNOWN"},{...national,make:"ROYAL ENFIELD"},{...mg,checksPassed:17},{...mg,model:"UNKNOWN"},{...mg,warnings:[...mg.warnings,"unverified_warning"]},{...mg,parserId:"tata_aig_private_car_package_n8n_native_pdf"}])
 assert.equal(verifiedPolicyManufacturerBrand(test),null,"Fail closed for unrelated PDF evidence");
const current={registrationNo:"",vehicleClass:"",make:"",model:"",fuelType:"",manufacturingYear:"",capacity:"",chassisNo:"",engineNo:"",rtoState:"",rtoName:"",policyProduct:"",idv:"",od:"",tp:"",cpa:"",policyNo:"",insurerId:"",validFrom:"",validUpto:""};
const fields=o=>[{key:"vehicle_make",label:"Make",value:o.make},{key:"vehicle_model",label:"Model",value:o.model}];
for(const [f,expected] of [[national,"Eicher"],[mg,"MG"]]){
 const build=(checks)=>buildPolicyOcrOnboardingUpdate({mode:"create",registrationMode:"registered",current,fields:fields(f),manufacturers:["Eicher","MG","Royal Enfield"],insurers:[],rcVerified:false,sourceParserId:f.parserId,sourceChecksPassed:checks,sourceWarnings:f.warnings});
 assert.equal(build(18).next.make,expected);
 assert.equal(build(17).next.make,"","Unverified PDF must not infer canonical make");
}
console.log("Source-certified MG and Eicher queue/draft alias regressions passed");
