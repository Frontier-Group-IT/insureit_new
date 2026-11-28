import assert from "node:assert/strict";
import {
  assessNiaNamedAuthorityUnregisteredConversion
} from "../lib/policy-commercial-direct-eligibility.ts";
import {
  mapVerifiedNiaCommercialPremium
} from "../lib/policy-n8n-onboarding-premium.ts";

// Fully synthetic, de-identified contract record matching the source's
// printed numeric totals. No policyholder identity or policy number reused.
const evidence="NIA PDF page 2 Owner Driver PA nominee none; no CPA charged; TP and 18%/5% IGST independently reconciled";
const values={
  insurer_name:"The New India Assurance Company Limited",
  policy_number:"SYNTHETICPOLICY12345",insured_name:"SOURCE TEST CUSTOMER",
  policy_product:"Commercial Vehicle Package Policy Enhanced Covers",
  policy_issuance_date:"2026-11-26",policy_start_date:"2026-11-26",
  policy_end_date:"2027-11-25",third_party_start_date:"2026-11-26",
  third_party_end_date:"2027-11-25",
  vehicle_registration_number:"",vehicle_registration_status:"unregistered",
  vehicle_make:"TATA MOTOR",vehicle_model:"TATA INTRA V30 TRUCK",
  vehicle_class:"Commercial Vehicle - Goods Carrying",
  vehicle_fuel_type:"Diesel",vehicle_manufacturing_year:"2026",
  vehicle_capacity:"2910",vehicle_chassis_number:"SYNTHETICCHASSIS01",
  vehicle_engine_number:"TESTENGINE0001",idv:"844998",
  cpa_premium:"0",od_premium:"6365",tp_premium:"16149",
};
const fields=Object.entries(values).filter(([,value])=>value!=="")
 .map(([key,value])=>({key,value,evidence:
   key==="cpa_premium"?evidence:key==="vehicle_registration_status"
   ?"NIA PDF partial registration prefix MP-21; no full plate"
   :"Native PDF policy schedule"}));
const printed={od:6365,tp:16149,net:22514,gst:1966,gross:24480};
const original={parserId:"new_india_cv_native_pdf",checksPassed:16,warnings:[],fields,commercialPremium:printed};
assert.deepEqual(assessNiaNamedAuthorityUnregisteredConversion(original),{eligible:true,reason:""});
assert.deepEqual(mapVerifiedNiaCommercialPremium(printed,0),{
  od:"6365",tp:"16149",addOnPremium:"0",cpa:"0",cpaOpted:"No",
});
const set=(key,value,evidenceOverride)=>({...original,fields:fields.map(f=>
  f.key===key?{...f,value,evidence:evidenceOverride??f.evidence}:f)});
for(const [key,value] of [
 ["vehicle_model","TATA INTRA V40 LX"],
 ["vehicle_make","OTHER MAKE"],["vehicle_capacity","15000"],
 ["vehicle_fuel_type","Petrol"],["vehicle_registration_status","registered"],
 ["cpa_premium","375"],["od_premium","6364"],
])assert.equal(assessNiaNamedAuthorityUnregisteredConversion(set(key,value)).eligible,false,
  "Must hold altered "+key);
assert.equal(assessNiaNamedAuthorityUnregisteredConversion(
 set("cpa_premium","0","Native PDF policy schedule")).eligible,false,
 "A bare zero is not an accepted no-charge source declaration");
assert.equal(assessNiaNamedAuthorityUnregisteredConversion({...original,checksPassed:15}).eligible,false);
assert.equal(assessNiaNamedAuthorityUnregisteredConversion({...original,commercialPremium:{...printed,gst:1965}}).eligible,false);
assert.throws(()=>mapVerifiedNiaCommercialPremium({...printed,net:22513},0));
console.log("NIA Intra no-charge CPA remains source/evidence bound with strict mixed-tax totals and identity");
