import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  assessNiaNamedAuthorityUnregisteredConversion,
  assessStandardCommercialDirectConversion,
} from "../lib/policy-commercial-direct-eligibility.ts";
import {
  mapVerifiedNiaCommercialPremium,
  verifiedCpaSelectionMatches,
} from "../lib/policy-n8n-onboarding-premium.ts";

const printed={od:15184,tp:35738,net:50922,gst:4576,gross:55498};
const cpaEvidence="NIA PDF page 2 Owner Driver PA; TP and 18%/5% IGST bases independently reconciled";
const fields=Object.entries({
  insurer_name:"The New India Assurance Company Limited",
  policy_product:"Commercial Vehicle Package Policy Enhanced Covers",
  insured_name:"SANITIZED CUSTOMER",policy_number:"11111111111111111111",
  policy_issuance_date:"2026-11-20",
  policy_start_date:"2026-11-20",policy_end_date:"2027-11-19",
  third_party_start_date:"2026-11-20",third_party_end_date:"2027-11-19",
  vehicle_registration_status:"unregistered",vehicle_class:"Commercial Vehicle - Goods Carrying",
  vehicle_make:"TATA MOTOR",vehicle_model:"1918 AZURA",vehicle_fuel_type:"Diesel",
  vehicle_manufacturing_year:"2026",vehicle_capacity:"18500",
  vehicle_rto_state:"Madhya Pradesh",vehicle_rto_name:"Mandla",
  vehicle_chassis_number:"SANITIZEDCHASSIS1234",vehicle_engine_number:"SANITIZEDENGINE1234",
  idv:"2978298",cpa_premium:"275",od_premium:"15184",tp_premium:"35738",
}).map(([key,value])=>({
  key,value,
  evidence:key==="vehicle_rto_name"
    ?"NIA PDF Name of registration authority: Mandla - MP 51; matches MP-51"
    :key==="cpa_premium"?cpaEvidence
    :key==="vehicle_registration_status"?"NIA PDF partial registration prefix MP-51; no full plate"
    :"Native PDF policy schedule",
}));
const input={parserId:"new_india_cv_native_pdf",checksPassed:16,warnings:[],
  fields,commercialPremium:printed};
const check=(overrides={})=>assessNiaNamedAuthorityUnregisteredConversion({...input,...overrides});
const replace=(key,value,evidence)=>{
  const next=fields.map(f=>({...f}));
  const index=next.findIndex(f=>f.key===key);
  if(index>=0){
    if(value===null)next.splice(index,1);
    else next[index]={...next[index],value,...(evidence===undefined?{}:{evidence})};
  }
  return next;
};
assert.equal(check().eligible,true,"Source-certified unregistered NIA layout qualifies for one-click preflight");
assert.equal(check({fields:replace("policy_product","Commercial Vehicle Package Policy")}).eligible,true,
  "The live NIA standard printed Package label qualifies for the same certified GCV family");
assert.equal(check({fields:replace("policy_product","Commercial Vehicle Standalone Own Damage")}).eligible,false,
  "Different NIA product layouts are not certified by this change");
assert.equal(assessStandardCommercialDirectConversion(input).eligible,false,
  "Previously registered/zero-CPA-only route must remain unchanged");
const premium=mapVerifiedNiaCommercialPremium(printed,275);
assert.deepEqual(premium,{od:"15184",addOnPremium:"0",tp:"35463",cpa:"275",cpaOpted:"Yes"});
assert.equal(Number(premium.od)+Number(premium.tp)+Number(premium.cpa),printed.net);
assert.equal(verifiedCpaSelectionMatches(premium.cpaOpted,275),true);
assert.equal(verifiedCpaSelectionMatches("No",275),false);

const rejects=[
  ["untrained parser",{parserId:"united_india_gcv_native_pdf"}],
  ["missing CPA",{fields:replace("cpa_premium",null)}],
  ["ambiguous CPA",{fields:[...fields,fields.find(f=>f.key==="cpa_premium")]}],
  ["zero CPA",{fields:replace("cpa_premium","0")}],
  ["missing CPA provenance",{fields:replace("cpa_premium","275","Native PDF policy schedule")}],
  ["wrong GST provenance",{fields:replace("cpa_premium","275",
    "NIA PDF page 2 Owner Driver PA; TP and 18% GST reconciled")}],
  ["issuing-office city not authority",{fields:replace("vehicle_rto_name","Gurgaon",
    "NIA issuing office city; provisional, NOT registration authority")}],
  ["mismatched authority code",{fields:replace("vehicle_rto_name","Mandla",
    "NIA PDF Name of registration authority: Mandla - MP 52; matches MP-52")}],
  ["mismatched printed registration prefix",{fields:replace("vehicle_registration_status","unregistered","NIA PDF partial registration prefix MP-52; no full plate")}],
  ["registered plate guessed",{fields:replace("vehicle_registration_status","registered")}],
  ["fake plate inserted",{fields:[...fields,{key:"vehicle_registration_number",value:"MP51AB1234",evidence:"guessed"}]}],
  ["untrained model",{fields:replace("vehicle_model","UNKNOWN")}],
  ["incorrect vehicle class",{fields:replace("vehicle_class","Commercial Vehicle - Miscellaneous Class D")}],
  ["unverified issue date",{fields:replace("policy_issuance_date",null)}],
  ["invalid coverage",{fields:replace("policy_end_date","2026-11-19")}],
  ["wrong printed TP",{commercialPremium:{...printed,tp:35000}}],
  ["wrong printed tax",{commercialPremium:{...printed,gst:4000}}],
  ["missing warnings policy",{warnings:["uncertain source"]}],
];
for(const [label,override] of rejects)
  assert.equal(check(override).eligible,false,"Reject "+label);
assert.throws(()=>mapVerifiedNiaCommercialPremium(printed,35739),/nia_printed_cpa_split_unreconciled/);
assert.throws(()=>mapVerifiedNiaCommercialPremium({...printed,gst:1111},275),/nia_printed_cpa_split_unreconciled/);

const read=p=>readFileSync(new URL("../"+p,import.meta.url),"utf8");
const action=read("app/development/ai-policy-onboarding/actions.ts");
const handoff=read("app/policy-intakes/handoff-actions.ts");
const queue=read("lib/ai-policy-onboarding-queue-server.ts");
const signed=read("lib/policy-nontata-commercial-n8n.ts");
const client=read("components/development/semi-auto-policy-workspace.tsx");
assert.match(action,/reverifiedNiaLegacyHold/);
assert.match(action,/queued\.last_error_code==="missing_verified_vehicle_registration_number"/);
assert.match(action,/extracted\.preview\.documentId===queued\.document_id/);
assert.match(action,/assessNiaNamedAuthorityUnregisteredConversion\(/);
assert.match(action,/mapVerifiedNiaCommercialPremium\(commercial/);
assert.match(action,/prepareVerifiedN8nIntakeHandoff\\(id,queued\\.document_id,\\s*extracted\\.preview\\.fingerprint,true,true\\)/,
  "Certified NIA must enable fillEmptyFields for legacy TP/CPA CAS repair without requesting draft replacement");
assert.doesNotMatch(action,/extracted\\.preview\\.fingerprint,true,!nia/,
  "The fifth handoff argument is fillEmptyFields, not preserveExistingDraft");
assert.match(action,/const expectedCommercialClass=\/Goods Carrying\/i/);
assert.match(handoff,/oldNiaMoney/);
assert.match(handoff,/original\.remarks\.includes\("independently validated commercial-motor PDF \(new_india_cv_native_pdf\)"\)/);
assert.match(handoff,/supplemented\.cpaOpted="Yes"/);
assert.match(handoff,/niaCertified\?tpExpiry/);
assert.match(queue,/recognizedNiaTata/);
assert.match(queue,/niaReview\.eligible/);
assert.match(queue,/codes\.push\("booking_review_required"\)/);
assert.match(signed,/isNewIndiaUnregistered/);
assert.match(signed,/isNewIndiaUnregistered \|\| isUnitedNewVehicle/);
assert.match(client,/canRetryReviewHeldPolicy/);
assert.match(client,/Verify & Convert/);
console.log("NIA named RTO / owner-driver CPA / legacy review-hold direct-convert regressions passed");
