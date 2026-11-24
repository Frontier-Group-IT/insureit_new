// RTO name and state are independently optional across extractor → preflight
// → canonical booking. Never remove registration, identity, date or money checks.
// Run: node --experimental-strip-types scripts/rto-optional-policy-regression.mjs
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {fileURLToPath} from "node:url";
import {dirname,resolve} from "node:path";
import {assessStandardCommercialDirectConversion,assessUiicGcvDirectConversion,
 assessUiicPrivateCarDirectConversion} from "../lib/policy-commercial-direct-eligibility.ts";
import {assessIffcoAutoOnboarding} from "../lib/policy-iffco-auto-eligibility.ts";
import {assessProductVariantDirectConversion} from "../lib/policy-product-variant-direct-eligibility.ts";
const root=resolve(dirname(fileURLToPath(import.meta.url)),"../../..");
const file=p=>readFileSync(resolve(root,p),"utf8");
const f=(key,value,evidence="Native PDF policy schedule")=>({key,value:String(value),evidence});
const common=[
 f("insured_name","TEST INSURED"),f("policy_number","EXAMPLEPOLICY01"),
 f("insurer_name","United India Insurance Company Limited"),
 f("policy_issuance_date","2026-11-19"),
 f("policy_start_date","2026-11-20"),f("policy_end_date","2027-11-19"),
 f("third_party_start_date","2026-11-20"),f("third_party_end_date","2027-11-19"),
 f("vehicle_class","Goods Carrying Vehicle"),f("vehicle_make","Tata Motors"),
 f("vehicle_model","ACE GOLD"),f("vehicle_fuel_type","Diesel"),
 f("vehicle_manufacturing_year","2025"),f("vehicle_capacity","1200"),
 f("vehicle_registration_number","MP20AB1234"),f("vehicle_registration_status","registered"),
 f("vehicle_chassis_number","EXAMPLECHASSIS12345"),
 f("vehicle_engine_number","EXAMPLEENGINE1234"),
 f("policy_product","Goods Carrying Vehicle Package"),
 f("idv","500000"),f("cpa_premium","0","UIIC PDF Compulsory Personal Accident (CPA) cover is removed"),
 f("od_premium","100"),f("tp_premium","300"),
];
const premium={od:100,tp:300,net:400,gst:72,gross:472};
const standard=assessStandardCommercialDirectConversion({
 parserId:"united_india_gcv_native_pdf",checksPassed:18,warnings:[],
 fields:common,commercialPremium:premium,
});
assert.equal(standard.eligible,true,standard.reason);
const uiic=assessUiicGcvDirectConversion({
 parserId:"united_india_gcv_native_pdf",checksPassed:18,warnings:[],
 fields:common,commercialPremium:premium,
});
assert.equal(uiic.eligible,true,uiic.reason);
const withCity=common.concat(f("vehicle_rto_name","Jabalpur"));
const withState=common.concat(f("vehicle_rto_state","Madhya Pradesh"));
for(const fields of [withCity,withState,withCity.concat(f("vehicle_rto_state","Madhya Pradesh"))]){
 assert.equal(assessUiicGcvDirectConversion({
  parserId:"united_india_gcv_native_pdf",checksPassed:18,warnings:[],
  fields,commercialPremium:premium,
 }).eligible,true,"One or both RTO fields should be accepted");
}
const forgedPremium=assessUiicGcvDirectConversion({
 parserId:"united_india_gcv_native_pdf",checksPassed:18,warnings:[],
 fields:common,commercialPremium:{...premium,net:450},
});
assert.equal(forgedPremium.eligible,false,"Premium reconciliation remains a hard block");
const invalidPlate=assessUiicGcvDirectConversion({
 parserId:"united_india_gcv_native_pdf",checksPassed:18,warnings:[],
 fields:common.map(x=>x.key==="vehicle_registration_number"?{...x,value:"INVALID"}:x),
 commercialPremium:premium,
});
assert.equal(invalidPlate.eligible,false,"Registered vehicle proof remains a hard block");
const privateFields=common.map(x=>({
 ...x,
 value:x.key==="vehicle_class"?"Private Car"
 :x.key==="vehicle_make"?"MARUTI SUZUKI"
 :x.key==="vehicle_model"?"SWIFT(2011 - ) ZDI"
 :x.key==="vehicle_manufacturing_year"?"2018"
 :x.key==="vehicle_capacity"?"1248"
 :x.key==="policy_product"?"Package":x.value,
 evidence:x.key==="policy_issuance_date"?"UIIC Private Car printed Date of Issue: 2026-11-19":x.evidence,
}));
const privateResult=assessUiicPrivateCarDirectConversion({
 parserId:"united_india_private_car_package_native_pdf",
 checksPassed:18,warnings:[],fields:privateFields,commercialPremium:premium,
});
assert.equal(privateResult.eligible,true,privateResult.reason);
const iffcoFields=common.map(x=>({
 ...x,
 value:x.key==="policy_product"?"Commercial Vehicle Package"
 :x.key==="vehicle_class"?"Commercial Vehicle - Miscellaneous Class D"
 :x.key==="vehicle_make"?"JCB"
 :x.key==="vehicle_model"?"JCB 3DX PLUS 2WD BACKHOE LOADER"
 :x.key==="vehicle_registration_number"?"MP/NEW/1234"
 :x.key==="vehicle_registration_status"?"registration_pending":x.value,
 evidence:x.key==="vehicle_capacity"?"IFFCO PDF page 1: CC"
 :x.key==="vehicle_fuel_type"?"Manufacturer-model Diesel specification":x.evidence,
}));
const iffco=assessIffcoAutoOnboarding({
 parserId:"iffco_tokio_cv_native_pdf",checksPassed:18,warnings:[],
 fields:iffcoFields,commercialPremium:premium,
});
assert.equal(iffco.eligible,true,iffco.reason);
const variant=assessProductVariantDirectConversion({
 parserId:"sbi_general_private_car_package_native_pdf",checksPassed:20,
 warnings:[],fields:common,commercialPremium:premium,
});
assert.doesNotMatch(variant.reason,/(?:missing_vehicle_rto|rto_or_plate)/);
const engine=file("apps/web-portal/lib/policy-onboarding-engine.ts");
assert.doesNotMatch(engine,/if\s*\(vehicleClass\s*!==\s*"CPM"\s*&&\s*\(!rtoState\s*\|\|\s*!rtoName\)\)/);
assert.match(engine,/RTO city\/state are optional/);
const eligibility=file("apps/web-portal/lib/ai-policy-onboarding-eligibility.ts");
const required=eligibility.slice(eligibility.indexOf("const requiredFields = ["),eligibility.indexOf("export function assessAiPolicyIntake"));
assert.doesNotMatch(required,/vehicle_rto_name|vehicle_rto_state/);
const handoff=file("apps/web-portal/app/policy-intakes/handoff-actions.ts");
assert.match(handoff,/const niaHoldCode=null/);
assert.doesNotMatch(handoff,/"vehicle_capacity","vehicle_rto_name","vehicle_rto_state"/);
const convert=file("apps/web-portal/app/development/ai-policy-onboarding/actions.ts");
assert.match(convert,/pdfField\("vehicle_rto_name"\) && forwarded.draft.rtoName/);
assert.match(convert,/pdfField\("vehicle_rto_state"\) && forwarded.draft.rtoState/);
console.log("RTO optional: absent, city-only, state-only, both, premium/plate hard negatives, canonical preflight and review-hold contracts passed");
