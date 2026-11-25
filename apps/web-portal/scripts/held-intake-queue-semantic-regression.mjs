import assert from "node:assert/strict";
import {verifiedPolicyManufacturerBrand} from "../lib/policy-trained-make-alias.ts";
import {assessAiPolicyIntake} from "../lib/ai-policy-onboarding-eligibility.ts";
const brand=(parserId,make,model,checksPassed=18,warnings=[])=>
 verifiedPolicyManufacturerBrand({parserId,make,model,checksPassed,warnings});
assert.equal(brand("united_india_gcv_punjab_split_gst_native_pdf",
 "Daimler India Commercial Vehicles Pvt. Ltd.","BHARATBENZ 2828C 6X4 BSVI"),"BHARATBENZ");
assert.equal(brand("magma_private_car_package_native_pdf",
 "KIA INDIA PRIVATE LIMITED","KIA INDIA PRIVATE LIMITED SELTOS G1.5 IMT HTK PLUS"),"KIA");
assert.equal(brand("oriental_private_car_standalone_od_native_pdf",
 "Tata Motors","PUNCH PUR 1.2P MT"),"TATA");
assert.equal(brand("united_india_gcv_native_pdf",
 "Tata Motors","ACE GOLD"),"TATA");
for(const mismatch of [
 ["united_india_gcv_punjab_split_gst_native_pdf","Daimler India Commercial Vehicles Pvt. Ltd.","OTHER TRUCK",18,[]],
 ["magma_private_car_package_native_pdf","KIA INDIA PRIVATE LIMITED","UNKNOWN",18,[]],
 ["magma_private_car_package_native_pdf","KIA INDIA PRIVATE LIMITED","KIA INDIA PRIVATE LIMITED SELTOS G1.5 IMT HTK PLUS",17,[]],
 ["magma_private_car_package_native_pdf","KIA INDIA PRIVATE LIMITED","KIA INDIA PRIVATE LIMITED SELTOS G1.5 IMT HTK PLUS",18,["Review required"]],
 ["untrained_parser","Tata Motors","PUNCH PUR 1.2P MT",18,[]],
 ])assert.equal(brand(...mismatch),null,"Unverified source must not receive a brand alias");
const f=(key,value)=>({key,value});
const fields=[
 f("insured_name","TEST INSURED"),f("policy_number","TEST-00001"),f("insurer_name","The Oriental Insurance Company Limited"),
 f("vehicle_class","Private Car"),f("vehicle_make","Tata Motors"),f("vehicle_model","PUNCH PUR 1.2P MT"),
 f("vehicle_fuel_type","PETROL"),f("vehicle_manufacturing_year","2025"),
 f("vehicle_chassis_number","SAMPLECHASSIS12345"),f("vehicle_engine_number","SAMPLEENGINE12345"),
 f("policy_product","Standalone Own Damage - Private Car"),
 f("policy_start_date","2026-11-19"),f("policy_end_date","2027-11-18"),
 f("idv","530091"),f("od_premium","6074"),f("tp_premium","0"),
 f("vehicle_capacity","1199"),f("vehicle_registration_status","registered"),
 f("vehicle_registration_number","PB25K4404"),
];
const common={
 policyType:"motor",intakeStatus:"processing",isDuplicate:false,
 hasCurrentDocument:true,documentStillCurrent:true,
 parserId:"oriental_private_car_standalone_od_native_pdf",
 parserChecksPassed:18,extractionState:"success",extractionWarnings:[],
 fields,premiumReconciled:true,matchedManufacturer:true,
 customerMatch:"unique_exact",sharedPhoneHasDistinctNames:false,
 existingCustomerSameIdentity:true,reviewerAssignedToAnother:false,
 vehicleOwnerConflict:false,coverageConflict:false,
 savedDraftConflictsWithPdf:false,issuanceDateVerified:true,
 needsDateApproval:false,bundledPeriodsVerified:true,canonicalPreflightPassed:false,
};
const saod=assessAiPolicyIntake(common);
assert.equal(saod.exceptions.some(x=>x.code==="missing_field"),false,
 "Standalone OD cannot require a third-party end date or optional RTO");
assert.equal(saod.exceptions.some(x=>x.code==="unverified_parser"),false);
const packageWithoutTp=assessAiPolicyIntake({...common,
 parserId:"magma_private_car_package_native_pdf",
 fields:fields.map(x=>x.key==="policy_product"?f("policy_product","Private Car Package"):x)});
assert.equal(packageWithoutTp.exceptions.some(x=>x.code==="missing_field"),true,
 "True TP-issuing Package must still require TP expiry");
const unknownMake=assessAiPolicyIntake({...common,matchedManufacturer:false});
assert.equal(unknownMake.exceptions.some(x=>x.code==="manufacturer_unmatched"),true,
 "Missing trusted master-brand match must remain review-required");
console.log("Held-intake queue: legal OEM aliases scoped, Oriental SAOD TP date optional, true package and unknown make negatives passed");
