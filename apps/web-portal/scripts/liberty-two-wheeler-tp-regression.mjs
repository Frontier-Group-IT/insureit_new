import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessProductVariantDirectConversion,mapVerifiedProductVariantPremium} from "../lib/policy-product-variant-direct-eligibility.ts";
import {classifyKnownUntrainedPolicyLayout} from "../lib/policy-known-layout-classification.ts";
const field=(key,value,evidence="Liberty original two-wheeler policy PDF")=>({key,value:String(value),evidence});
const fixture=(make,model,cc,cpa)=>{
 const printed={od:0,tp:714,cpa,net:714+cpa,gst:cpa===0?128.52:196.02,gross:cpa===0?843:1285};
 const fields=[
  field("policy_number","TESTLIBERTY123456"),
  field("insurer_name","Liberty General Insurance Limited"),field("insured_name","TEST HOLDER"),
  field("policy_product","Third-Party Only"),field("policy_issuance_date","2026-11-25"),
  field("policy_start_date","2026-11-26"),field("policy_end_date","2027-11-25"),
  field("third_party_start_date","2026-11-26"),field("third_party_end_date","2027-11-25"),
  field("vehicle_registration_number","UK12F0204"),field("vehicle_registration_status","registered"),
  field("vehicle_class","Two Wheeler"),field("vehicle_make",make),field("vehicle_model",model),
  field("vehicle_fuel_type","Petrol","Manufacturer model-family petrol specification; not printed in policy"),
  field("vehicle_manufacturing_year","2018"),field("vehicle_capacity",cc),
  field("vehicle_engine_number","TESTENGINE123"),field("vehicle_chassis_number","TESTCHASSIS1234567"),
  field("idv","0"),field("od_premium","0"),field("tp_premium","714"),
  field("cpa_premium",cpa,cpa===0?"Printed CSI NA and no PA charge":"Printed PA owner driver"),
 ];
 return{parserId:"liberty_two_wheeler_tp_native_pdf",checksPassed:18,warnings:[],fields,commercialPremium:printed};
};
const cases=[["Bajaj","PLATINA 100 ES","99",0],["Bajaj","DISCOVER 125 T DRUM","125",0],["TVS","JUPITER ZX","110",375]];
for(const options of cases){
 const a=fixture(...options);
 assert.equal(assessProductVariantDirectConversion(a).eligible,true,"exact source");
 const mapped=mapVerifiedProductVariantPremium(a.commercialPremium,a.parserId);
 assert.deepEqual(mapped,{od:"0",tp:"714",addOnPremium:"0",cpa:String(options[3]),cpaOpted:options[3]?"Yes":"No"});
 assert.equal(assessProductVariantDirectConversion({...a,fields:a.fields.filter(x=>!["vehicle_rto_state","vehicle_rto_name"].includes(x.key))}).eligible,true,"RTO optional");
 for(const mutate of [
  x=>x.commercialPremium.cpa+=50,
  x=>x.commercialPremium.net+=1,
  x=>x.commercialPremium.gross+=2,
  x=>x.fields.find(z=>z.key==="vehicle_model").value="UNKNOWN",
  x=>x.fields.find(z=>z.key==="vehicle_fuel_type").evidence="Unverified",
  x=>x.fields.find(z=>z.key==="cpa_premium").value="999",
  x=>x.fields.push({...x.fields[0]}),
  x=>x.warnings.push("unverified"),
  x=>x.checksPassed=17,
 ]){const test=structuredClone(a);mutate(test);assert.equal(assessProductVariantDirectConversion(test).eligible,false,"bad identity/CPA/source must fail");}
}
const liberty="LIBERTY GENERAL INSURANCE LIMITED\nINSURED MOTOR VEHICLE DETAILS AND PREMIUM COMPUTATION\nTWO WHEELER LIABILITY ONLY POLICY ( 1 YEAR TP ONLY )";
const oriental="THE ORIENTAL INSURANCE COMPANY LIMITED\nMOTORISED-TWO WHEELERS PACKAGE POLICY - ZONE B\nMOTOR INSURANCE CERTIFICATE CUM POLICY SCHEDULE";
assert.equal(classifyKnownUntrainedPolicyLayout(liberty),"n8n_layout_untrained_liberty_two_wheeler_tp");
assert.equal(classifyKnownUntrainedPolicyLayout(oriental),"n8n_layout_untrained_oriental_two_wheeler_package");
assert.equal(classifyKnownUntrainedPolicyLayout("THE ORIENTAL INSURANCE COMPANY LIMITED GCCV PUBLIC CARRIER"),null);
const bridge=readFileSync(new URL("../lib/policy-nontata-commercial-n8n.ts",import.meta.url),"utf8");
const profile=readFileSync(new URL("../lib/ai-policy-onboarding-eligibility.ts",import.meta.url),"utf8");
assert.ok(bridge.includes('matches.push("liberty_two_wheeler_tp_native_pdf")'));
assert.ok(bridge.includes('const liberty=insurer==="liberty_two_wheeler_tp_native_pdf"'));
assert.ok(profile.includes('"liberty_two_wheeler_tp_native_pdf"'));
assert.ok(bridge.includes('n8n_extension_liberty_cpa_missing_or_mismatch'));
const worker=readFileSync(new URL("../lib/ai-policy-onboarding-queue-server.ts",import.meta.url),"utf8");
assert.match(worker,/NON_TATA_COMMERCIAL_N8N_IDS/);
assert.match(worker,/registryFingerprint=createHash/);
assert.match(worker,/layoutNeedsTraining=untrained/);
assert.match(worker,/state:layoutNeedsTraining\?"unsupported"/);
const upload=readFileSync(new URL("../app/policy-intakes/handoff-actions.ts",import.meta.url),"utf8");
assert.ok(upload.includes('"liberty_two_wheeler_tp_native_pdf"].includes(parsed.preview.parserId)'));
console.log("Liberty TW TP zero/positive CPA, source identity, no RTO requirement, and wrong-product routing passed");
