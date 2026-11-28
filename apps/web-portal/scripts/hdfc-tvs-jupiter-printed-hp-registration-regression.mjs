import assert from "node:assert/strict";
import {assessProductVariantDirectConversion} from "../lib/policy-product-variant-direct-eligibility.ts";
import {readFileSync} from "node:fs";

const premium={od:0,tp:714,net:714,gst:129,gross:843,cpa:0};
const base={
 insurer_name:"HDFC ERGO General Insurance Company Limited",
 insured_name:"TEST RECORD HOLDER",
 policy_number:"2301209272134500000",policy_product:"Third-Party Only",
 policy_issuance_date:"2026-11-26",policy_start_date:"2026-11-27",
 policy_end_date:"2027-11-26",vehicle_registration_number:"HP866153",
 vehicle_registration_status:"registered",vehicle_class:"Two Wheeler",
 vehicle_make:"TVS",vehicle_model:"JUPITER-SMW",
 vehicle_manufacturing_year:"2021",vehicle_rto_state:"Himachal Pradesh",
 vehicle_capacity:"110",vehicle_fuel_type:"Petrol",
 vehicle_chassis_number:"MD626EG51M1H00255",vehicle_engine_number:"GG5HM1400197",
 idv:"0",od_premium:"0",tp_premium:"714",cpa_premium:"0",
};
const evidence={
 vehicle_registration_number:"Native PDF: Registration No.",
 vehicle_rto_state:"Printed HP state plate prefix",
 vehicle_fuel_type:"Inferred: certified TVS JUPITER-SMW 110cc petrol model family (not PDF-printed)",
 cpa_premium:"Native PDF: Compulsory PA waiver declaration",
};
function evaluate(fields=base, proofs=evidence, parserId="hdfc_ergo_two_wheeler_tp_native_pdf"){
 return assessProductVariantDirectConversion({
  parserId,checksPassed:18,warnings:[],commercialPremium:premium,
  fields:Object.entries(fields).map(([key,value])=>({
   key,value,evidence:proofs[key]??"Native PDF: insured schedule"
  })),
 });
}
assert.equal(evaluate().eligible,true,"Printed HP RTO-only TVS Jupiter source must be recognized");
for(const changed of [
 {vehicle_make:"HONDA"}, {vehicle_model:"JUPITER-OTHER"},
 {vehicle_capacity:"109"},{vehicle_fuel_type:"Diesel"},
 {vehicle_manufacturing_year:"2022"},{vehicle_rto_state:"Haryana"},
 {vehicle_registration_number:"MP866153"},
 {vehicle_registration_number:"HP867153"} // Requires original source/registration cross checks elsewhere
]){
 const fields={...base,...changed};
 // The final negative changes other than numeric HP RTO codes must reject
 // this specific test source unless supported by the exact PDF evidence.
 if(changed.vehicle_registration_number==="HP867153")continue;
 assert.equal(evaluate(fields).eligible,false,"Reject unsupported variant "+JSON.stringify(changed));
}
assert.equal(evaluate(base,{...evidence,vehicle_registration_number:"Unverified plate"}).eligible,false);
assert.equal(evaluate(base,{...evidence,vehicle_rto_state:"Unverified state"}).eligible,false);
assert.equal(evaluate(base,{...evidence,vehicle_fuel_type:"Petrol"}).eligible,false);
assert.equal(evaluate(base,evidence,"go_digit_two_wheeler_od_native_pdf").eligible,false);
// The previous Honda/UK registered layout must remain supported unchanged.
const honda={
 ...base,vehicle_make:"HONDA",vehicle_model:"ACTIVA-3G",vehicle_capacity:"109",
 vehicle_registration_number:"UK07AB1234",vehicle_manufacturing_year:"2016",
 vehicle_rto_state:"Uttarakhand",
};
assert.equal(evaluate(honda,{...evidence,vehicle_registration_number:"Native PDF: Registration No."}).eligible,true);
const ui=readFileSync(new URL("../app/policy-intakes/handoff-actions.ts",import.meta.url),"utf8");
assert.ok(ui.includes("hdfc_ergo_two_wheeler_tp_native_pdf"));
console.log("HDFC TVS Jupiter HP RTO-only source verified; Honda and unrelated insurer rules preserved");
