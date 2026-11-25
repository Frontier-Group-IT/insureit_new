import assert from "node:assert/strict";
import {enrichVerifiedN8nOnboardingFields} from "../lib/policy-n8n-onboarding-enrichment.ts";
const source=[
 {key:"vehicle_make",label:"PDF legal manufacturer",value:"Daimler India Commercial Vehicles Pvt. Ltd."},
 {key:"vehicle_model",label:"PDF vehicle model",value:"BHARATBENZ 2828C 6X4 BSVI"},
 {key:"vehicle_rto_name",label:"Optional authority",value:"LUDHIANA"},
];
const before=JSON.stringify(source);
const mapped=enrichVerifiedN8nOnboardingFields(source,
 "united_india_gcv_punjab_split_gst_native_pdf");
assert.equal(mapped.find(f=>f.key==="vehicle_make")?.value,"BharatBenz");
assert.equal(mapped.find(f=>f.key==="vehicle_model")?.value,"BHARATBENZ 2828C 6X4 BSVI");
assert.equal(mapped.some(f=>f.key==="vehicle_rto_state"),false,
 "No inference of RTO state from plate, branch or city");
assert.equal(JSON.stringify(source),before,"Original PDF evidence must remain unchanged");
for(const parserId of ["united_india_gcv_native_pdf","oriental_gccv_package_native_pdf",
 "magma_private_car_package_native_pdf"]){
 const unrelated=enrichVerifiedN8nOnboardingFields(source,parserId);
 assert.equal(unrelated.find(f=>f.key==="vehicle_make")?.value,source[0].value,
 "Legal-make alias cannot affect unrelated insurer routes");
}
const other=enrichVerifiedN8nOnboardingFields(
 source.map(f=>f.key==="vehicle_model"?{...f,value:"OTHER VEHICLE"}:f),
 "united_india_gcv_punjab_split_gst_native_pdf");
assert.equal(other.find(f=>f.key==="vehicle_make")?.value,source[0].value,
 "Unknown models must not receive a brand guess");
console.log("UIIC Punjab: current master BharatBenz brand derived only from exact PDF marque and model");
