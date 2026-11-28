import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessUiicGcvDirectConversion} from "../lib/policy-commercial-direct-eligibility.ts";
const values={
 insurer_name:"United India Insurance Company Limited",insured_name:"TEST POLICY HOLDER",
 policy_number:"2230003126P113437733",policy_product:"Goods Carrying Vehicle Package",
 policy_issuance_date:"2026-11-26",policy_start_date:"2026-11-28",
 policy_end_date:"2027-11-27",third_party_start_date:"2026-11-28",
 third_party_end_date:"2027-11-27",
 vehicle_class:"Goods Carrying Vehicle",vehicle_make:"Mahindra",
 vehicle_model:"BOL MAXX PUP CITY 1.3 LXD",vehicle_fuel_type:"Diesel",
 vehicle_manufacturing_year:"2024",vehicle_capacity:"2523",
 vehicle_chassis_number:"MA1RV2TUKR1L89526",vehicle_engine_number:"TUR1L78716",
 vehicle_rto_name:"FARIDABAD",vehicle_rto_state:"Haryana",
 vehicle_registration_status:"registered",vehicle_registration_number:"HR38AH7805",
 idv:"630000",od_premium:"3853",tp_premium:"16474",cpa_premium:"325",
};
const evidence={
 vehicle_make:"UIIC PDF MAHINDRA & MAHINDRA LIMITED canonical manufacturer",
 vehicle_rto_name:"UIIC PDF vehicle Registration Authority: HR38 FARIDABAD INDIA",
 vehicle_rto_state:"UIIC PDF current HR registered plate prefix",
 cpa_premium:"UIIC PDF Compulsory PA for Owner Driver: 325.00 included in Gross TP(B)",
};
const premium={od:3853,tp:16474,net:20327,gst:1572,gross:21899};
const parserId="united_india_gcv_haryana_mahindra_split_gst_native_pdf";
function assess(v=values,e=evidence,p=premium,id=parserId){
 return assessUiicGcvDirectConversion({
  parserId:id,checksPassed:18,warnings:[],fields:Object.entries(v).map(([key,value])=>({
   key,value,evidence:e[key]||"Native PDF policy schedule"
  })),commercialPremium:p,
 });
}
assert.deepEqual(assess(),{eligible:true,reason:""});
for(const changes of [
 {vehicle_make:"Tata Motors"},{vehicle_model:"BOL MAXX OTHER"},{vehicle_fuel_type:"Petrol"},
 {vehicle_rto_name:"GURGAON"},{vehicle_rto_state:"Punjab"},
 {vehicle_registration_number:"MP38AH7805"},{vehicle_engine_number:"OTHER123"},
 {vehicle_chassis_number:"MAT466429GHF09650"},{vehicle_manufacturing_year:"2035"},
 {cpa_premium:"0"},
])assert.equal(assess({...values,...changes}).eligible,false,"Reject "+JSON.stringify(changes));
for(const changed of [
 {...evidence,vehicle_make:"Unverified manufacturer"},
 {...evidence,vehicle_rto_name:"UIIC PDF vehicle Registration Authority: HR38 GURGAON INDIA"},
 {...evidence,vehicle_rto_state:"guessed state"},
 {...evidence,cpa_premium:"unverified owner driver premium"},
])assert.equal(assess(values,changed).eligible,false);
for(const changed of [
 {...premium,od:3852},{...premium,gst:1571},{...premium,gross:21900}
])assert.equal(assess(values,evidence,changed).eligible,false);
assert.equal(assess(values,evidence,premium,"united_india_gcv_native_pdf").eligible,false);
const handoff=readFileSync(new URL("../app/policy-intakes/handoff-actions.ts",import.meta.url),"utf8");
const allowed=readFileSync(new URL("../lib/ai-policy-onboarding-eligibility.ts",import.meta.url),"utf8");
const adapter=readFileSync(new URL("../lib/policy-nontata-commercial-n8n.ts",import.meta.url),"utf8");
assert.ok(handoff.includes(parserId)&&allowed.includes(parserId)&&adapter.includes(parserId));
assert.ok(adapter.includes('return "united_india_gcv_haryana_mahindra_split_gst_native_pdf"'));
const source=readFileSync(new URL("../../../infra/n8n-local/variants/united-india-haryana-mahindra-gcv.js",import.meta.url),"utf8");
for(const proof of [
 "split_cgst_sgst_components_printed","positive_cpa_and_paid_driver_itemized",
 "od_components_reconciled","printed_split_taxable_bases","vehicle_chassis_number",
 "vehicle_engine_number","vehicle_rto_name","cgstBasicTp","sgstBasicTp"
])assert.ok(source.includes(proof));
console.log("United India Haryana Mahindra GCV source identity, 4-tax premiums and cross-layer eligibility passed");
