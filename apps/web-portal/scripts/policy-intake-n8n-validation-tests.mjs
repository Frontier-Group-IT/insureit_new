import assert from "node:assert/strict";
import test from "node:test";
import { validateN8nPolicyIntakeResponse } from "../lib/policy-intake-n8n-validation.ts";
import { mapVerifiedN8nMotorPremium } from "../lib/policy-n8n-onboarding-premium.ts";
import { buildPolicyOcrOnboardingUpdate } from "../lib/policy-ocr-onboarding-apply.ts";

const ids = {intakeId:"00000000-0000-4000-8000-000000000001",documentId:"00000000-0000-4000-8000-000000000002",requestId:"00000000-0000-4000-8000-000000000003"};
const checks = Object.fromEntries([
"is_icici_3005","insured_name_present","policy_number_present","vehicle_details_present",
"dates_present","od_liability_equal_net","tp_cpa_equal_liability","net_tax_equal_gross",
"idv_present","manufacturing_year_present","basic_od_plus_addons_equals_printed_total",
"basic_tp_equals_derived_tp","exact_igst_rounds_to_tax"
].map(k=>[k,true]));
const values = {
 policy_number:"3005/123456789/00/000",insurer_name:"ICICI Lombard General Insurance",
 policy_product:"Bundled",policy_start_date:"2026-11-06",policy_end_date:"2027-11-05",
 third_party_start_date:"2026-11-06",third_party_end_date:"2031-11-05",
 insured_name:"TEST CUSTOMER",vehicle_make:"CHETAK",vehicle_model:"C3001",
 vehicle_registration_status:"unregistered",vehicle_registration_number:"NEW",
 vehicle_engine_number:"EXAMPLE123456",vehicle_chassis_number:"MD2EXAMPLECHASSIS123",
 vehicle_manufacturing_year:"2026",vehicle_rto_name:"JABALPUR",idv:"114459",
 od_premium:"1758",tp_premium:"3273",cpa_premium:"575",
};
function fresh(){
 return {
 contract_version:"1",intake_id:ids.intakeId,document_id:ids.documentId,request_id:ids.requestId,
 ok:true,parser_id:"icici_3005_n8n_native_pdf",parser_version:"bridge-v1",
 extraction_method:"native_pdf_text",review_required:true,auto_finalize_allowed:false,
 checks:structuredClone(checks),
 fields:Object.entries(values).map(([key,value])=>({key,label:key,value,confidence:null,page:1,evidence:key})),
 premium_components:{
 basic_od_premium:1758,od_addons:[],total_od_premium:1758,basic_tp_premium:3273,
 owner_driver_cpa:575,total_liability_premium:3848,net_premium:5606,
 igst_exact:1009.08,printed_total_tax:1009,gross_premium:6615
 },
 warnings:[]
 };
}
test("accepts all consistent ICICI Product 3005 premiums",()=>{
 const result=validateN8nPolicyIntakeResponse(fresh(),ids);
 assert.equal(result.ok,true);assert.equal(result.fields.length,20);
 assert.equal(result.fields.find(f=>f.key==="insured_name")?.value,"TEST CUSTOMER");
});
test("accepts 683 zero-depreciation add-on with correct independent accounting",()=>{
 const x=fresh();x.premium_components.basic_od_premium=1583;
 x.premium_components.od_addons=[{name:"Zero Depreciation (Silver)",amount:683}];
 x.premium_components.total_od_premium=2266;x.premium_components.net_premium=6114;
 x.premium_components.igst_exact=1100.52;x.premium_components.printed_total_tax=1101;
 x.premium_components.gross_premium=7215;
 x.fields.find(f=>f.key==="od_premium").value="2266";
 assert.equal(validateN8nPolicyIntakeResponse(x,ids).ok,true);
});
test("rejects mismatch in intake, document or request",()=>{
 for(const key of ["intake_id","document_id","request_id"]){
  const x=fresh();x[key]="00000000-0000-4000-8000-999999999999";
  assert.throws(()=>validateN8nPolicyIntakeResponse(x,ids),/n8n_request_identity_mismatch/);
 }
});
test("rejects policy mismatch, unknown field, duplicate field, missing critical field",()=>{
 const wrong=fresh();wrong.fields.find(f=>f.key==="policy_number").value="3004/123456789/00/000";
 assert.throws(()=>validateN8nPolicyIntakeResponse(wrong,ids),/n8n_wrong_policy_product/);
 const unknown=fresh();unknown.fields[0].key="bank_account";
 assert.throws(()=>validateN8nPolicyIntakeResponse(unknown,ids),/n8n_field_shape_invalid/);
 const duplicate=fresh();duplicate.fields[1].key=duplicate.fields[0].key;
 assert.throws(()=>validateN8nPolicyIntakeResponse(duplicate,ids),/n8n_field_shape_invalid/);
 const missing=fresh();missing.fields=missing.fields.filter(f=>f.key!=="insured_name");
 assert.throws(()=>validateN8nPolicyIntakeResponse(missing,ids),/n8n_required_field_missing/);
});
test("rejects missing, renamed, or substituted n8n safety checks",()=>{
  const missing=fresh();delete missing.checks.exact_igst_rounds_to_tax;
  assert.throws(()=>validateN8nPolicyIntakeResponse(missing,ids),/n8n_financial_validation_failed/);
  const substituted=fresh();delete substituted.checks.is_icici_3005;
  substituted.checks.unrecognized_check=true;
  assert.throws(()=>validateN8nPolicyIntakeResponse(substituted,ids),/n8n_financial_validation_failed/);
  const extra=fresh();extra.checks.unrecognized_check=true;
  assert.throws(()=>validateN8nPolicyIntakeResponse(extra,ids),/n8n_financial_validation_failed/);
});
test("rejects invalid, non-ISO, or reversed coverage dates",()=>{
  const invalid=fresh();invalid.fields.find(f=>f.key==="policy_start_date").value="2026-02-30";
  assert.throws(()=>validateN8nPolicyIntakeResponse(invalid,ids),/n8n_coverage_dates_invalid/);
  const nonIso=fresh();nonIso.fields.find(f=>f.key==="policy_end_date").value="05/11/2027";
  assert.throws(()=>validateN8nPolicyIntakeResponse(nonIso,ids),/n8n_coverage_dates_invalid/);
  const reversed=fresh();reversed.fields.find(f=>f.key==="policy_end_date").value="2025-11-05";
  assert.throws(()=>validateN8nPolicyIntakeResponse(reversed,ids),/n8n_coverage_dates_invalid/);
});
test("requires distinct Third Party dates and rejects OD-end substitution",()=>{
 const baseline=validateN8nPolicyIntakeResponse(fresh(),ids);
 assert.equal(baseline.fields.find(f=>f.key==="third_party_end_date")?.value,"2031-11-05");
 const missing=fresh();missing.fields=missing.fields.filter(f=>f.key!=="third_party_end_date");
 assert.throws(()=>validateN8nPolicyIntakeResponse(missing,ids),/n8n_required_field_missing/);
 const badTp=fresh();badTp.fields.find(f=>f.key==="third_party_end_date").value="2026-02-30";
 assert.throws(()=>validateN8nPolicyIntakeResponse(badTp,ids),/n8n_coverage_dates_invalid/);
 const mismatch=fresh();mismatch.fields.find(f=>f.key==="third_party_start_date").value="2026-10-06";
 assert.throws(()=>validateN8nPolicyIntakeResponse(mismatch,ids),/n8n_coverage_dates_invalid/);
 const premature=fresh();premature.fields.find(f=>f.key==="third_party_end_date").value="2027-10-01";
 assert.throws(()=>validateN8nPolicyIntakeResponse(premature,ids),/n8n_coverage_dates_invalid/);
});
test("rejects auto finalization and unsupported parser version",()=>{
 const x=fresh();x.auto_finalize_allowed=true;
 assert.throws(()=>validateN8nPolicyIntakeResponse(x,ids),/n8n_review_required/);
 const ver=fresh();ver.parser_version="not-reviewed";
 assert.throws(()=>validateN8nPolicyIntakeResponse(ver,ids),/n8n_review_required/);
});
test("rejects false checks and tampered premium totals even if n8n says valid",()=>{
 const x=fresh();x.checks.od_liability_equal_net=false;
 assert.throws(()=>validateN8nPolicyIntakeResponse(x,ids),/n8n_financial_validation_failed/);
 for(const tamper of [y=>y.premium_components.gross_premium+=100,y=>y.premium_components.total_od_premium+=2,
  y=>y.premium_components.printed_total_tax+=1,y=>y.premium_components.od_addons=[{name:"Zero Depreciation",amount:683}]]){
  const t=fresh();tamper(t);assert.throws(()=>validateN8nPolicyIntakeResponse(t,ids),/n8n_premium_reconciliation_failed/);
 }
 const field=fresh();field.fields.find(f=>f.key==="tp_premium").value="5000";
 assert.throws(()=>validateN8nPolicyIntakeResponse(field,ids),/n8n_premium_field_mismatch/);
});
test("rejects invalid add-on amounts, missing breakdown and oversized evidence",()=>{
 const noBreakdown=fresh();delete noBreakdown.premium_components;
 assert.throws(()=>validateN8nPolicyIntakeResponse(noBreakdown,ids),/n8n_premium_breakdown_missing/);
 const addon=fresh();addon.premium_components.od_addons=[{name:"x",amount:-1}];
 assert.throws(()=>validateN8nPolicyIntakeResponse(addon,ids),/n8n_premium_addon_invalid/);
 const field=fresh();field.fields[0].evidence="x".repeat(130);
 assert.throws(()=>validateN8nPolicyIntakeResponse(field,ids),/n8n_field_shape_invalid/);
});

function odFixture() {
 const x=fresh();
 x.parser_id="icici_3005_od_n8n_native_pdf";
 x.parser_version="bridge-od-v1";
 x.checks=Object.fromEntries([
   "is_icici_3005_od","insured_name_present","policy_number_present",
   "vehicle_details_present","dates_present","od_subtotal_reconciled",
   "ncb_deduction_reconciled","net_tax_equal_gross","idv_present",
   "manufacturing_year_present","third_party_reference_present",
   "zero_tp_charged","exact_igst_rounds_to_tax"
 ].map(k=>[k,true]));
 const overrides={
   policy_number:"3005/O/462448679/00/000",policy_product:"Stand-Alone Own Damage",
   policy_issuance_date:"2026-11-13",policy_start_date:"2026-11-15",policy_end_date:"2027-11-14",
   third_party_start_date:"2023-10-16",third_party_end_date:"2028-10-15",
   third_party_policy_number:"32070031236260013654",third_party_insurer_name:"IRAO",
   insured_name:"TEST OD CUSTOMER",vehicle_make:"BAJAJ",vehicle_model:"CHETAK 2413 PREMIUM",
   idv:"106760",od_premium:"2351",tp_premium:"0",cpa_premium:"0"
 };
 const byKey=new Map(x.fields.map(f=>[f.key,f]));
 for(const [key,value] of Object.entries(overrides)){
   if(byKey.has(key))byKey.get(key).value=value;
   else x.fields.push({key,label:key,value,confidence:null,page:1,evidence:key});
 }
 x.premium_components={
  basic_od_premium:2222,od_addons:[{name:"Zero Depreciation (Silver)",amount:907}],
  printed_od_subtotal:3129,od_deductions:778,total_od_premium:2351,
  basic_tp_premium:0,owner_driver_cpa:0,total_liability_premium:0,
  net_premium:2351,igst_exact:423.18,printed_total_tax:423,gross_premium:2774
 };
 return x;
}
test("accepts consistent ICICI 3005/O OD policy with independent TP dates",()=>{
 const x=odFixture();const validated=validateN8nPolicyIntakeResponse(x,ids);
 assert.equal(validated.ok,true);
 assert.equal(validated.parserId,"icici_3005_od_n8n_native_pdf");
 assert.equal(validated.checksPassed,13);
 assert.equal(validated.premium.gross,2774);
});
test("rejects OD NCB mismatch, charged TP, missing TP reference, and wrong policy number",()=>{
 const mistakes=[
  x=>x.premium_components.od_deductions++,
  x=>x.premium_components.basic_tp_premium=100,
  x=>x.fields=x.fields.filter(f=>f.key!=="third_party_policy_number"),
  x=>x.fields.find(f=>f.key==="policy_number").value="3005/462448679/00/000"
 ];
 for(const bad of mistakes){
  const x=odFixture();bad(x);
  assert.throws(()=>validateN8nPolicyIntakeResponse(x,ids));
 }
});

test("ICICI 3005/O: preserve printed NCB and reconcile exactly to canonical net OD", () => {
 const premium=validateN8nPolicyIntakeResponse(odFixture(),ids).premium;
 assert.equal(premium.odSubtotal,3129);
 assert.equal(premium.odDeductions,778);
 const fields=mapVerifiedN8nMotorPremium(premium);
 assert.deepEqual(fields,{od:"1444",addOnPremium:"907",tp:"0",cpa:"0",cpaOpted:"No"});
 assert.equal(Number(fields.od)+Number(fields.addOnPremium),2351);
 const bundled=mapVerifiedN8nMotorPremium(validateN8nPolicyIntakeResponse(fresh(),ids).premium);
 assert.equal(bundled.od,"1758");
 assert.equal(bundled.tp,"3273");
 assert.equal(bundled.cpa,"575");
});
test("OD safely refuses a booking representation when addons exceed total OD", () => {
 const premium=validateN8nPolicyIntakeResponse(odFixture(),ids).premium;
 const impossible={...premium,basicOd:100,odSubtotal:1007,odDeductions:999,totalOd:8,net:8,
   odAddons:[{name:"Zero Depreciation",amount:907}]};
 assert.throws(()=>mapVerifiedN8nMotorPremium(impossible),/n8n_motor_premium_handoff_unreconciled/);
});
test("ICICI 3005/O amendment B00 remains validated by all 13 checks",()=>{
 const x=odFixture();
 x.fields.find(f=>f.key==="policy_number").value="3005/O/123450002/00/B00";
 assert.equal(validateN8nPolicyIntakeResponse(x,ids).checksPassed,13);
});
test("CHETAK model variants map to Bajaj only with verified EV motor evidence",()=>{
 const current=Object.fromEntries([
  "registrationNo","vehicleClass","make","model","fuelType","manufacturingYear","capacity",
  "chassisNo","engineNo","rtoState","rtoName","policyProduct","idv","od","tp","cpa",
  "policyNo","insurerId","validFrom","validUpto"].map(k=>[k,""]));
 const fields=[
  ["vehicle_class","Two Wheeler"],["vehicle_make","CHETAK"],["vehicle_model","BLUE 2903"],
  ["vehicle_fuel_type","Electric"],["vehicle_motor_power_kw","2.8"]
 ].map(([key,value])=>({key,value,label:key}));
 const opts={mode:"create",registrationMode:"registered",current,fields,
   manufacturers:["Bajaj","Hero"],insurers:[],rcVerified:false};
 const good=buildPolicyOcrOnboardingUpdate(opts);
 assert.equal(good.next.make,"Bajaj");
 assert.equal(good.next.model,"BLUE 2903");
 assert.equal(good.next.fuelType,"Electric");
 assert.equal(good.next.capacity,"2.8");
 const premium2413=buildPolicyOcrOnboardingUpdate({...opts,fields:fields.map(f=>
   f.key==="vehicle_model"?{...f,value:"CHETAK 2413 PREMIUM"}:{...f})});
 assert.equal(premium2413.next.make,"Bajaj");
 const noEvidence=buildPolicyOcrOnboardingUpdate({...opts,
  fields:fields.filter(f=>f.key!=="vehicle_fuel_type")});
 assert.notEqual(noEvidence.next.make,"Bajaj");
});


// Anonymized financial / layout fixtures derived from three manually
// reviewed ICICI Product 3005 PDF schedules. The real policyholders' PDF
// bytes, contact data and IDs must NEVER be committed to this repository.
test("3005/O ordinary BAJAJ Chetak: no NCB and one zero-depreciation add-on",()=>{
 const x=odFixture();
 const update={
   policy_number:"3005/O/123450001/00/000",
   policy_issuance_date:"2026-11-10",
   policy_start_date:"2026-11-12",policy_end_date:"2027-11-11",
   third_party_start_date:"2025-11-12",third_party_end_date:"2030-11-11",
   vehicle_make:"BAJAJ",vehicle_model:"CHETAK 3503",
   vehicle_class:"Two Wheeler",vehicle_fuel_type:"Electric",
   vehicle_motor_power_kw:"4.2",idv:"98505",od_premium:"2696",
 };
 for(const [key,value] of Object.entries(update)){
   const found=x.fields.find(field=>field.key===key);
   if(found)found.value=value;
   else x.fields.push({key,label:key,value,confidence:null,page:3,evidence:key});
 }
 x.premium_components={
   basic_od_premium:2056,od_addons:[{name:"Zero Depreciation (Silver)",amount:640}],
   printed_od_subtotal:2696,od_deductions:0,total_od_premium:2696,
   basic_tp_premium:0,owner_driver_cpa:0,total_liability_premium:0,
   net_premium:2696,igst_exact:485.28,printed_total_tax:485,gross_premium:3181
 };
 const checked=validateN8nPolicyIntakeResponse(x,ids);
 assert.equal(checked.checksPassed,13);
 assert.equal(checked.premium.gross,3181);
 assert.equal(mapVerifiedN8nMotorPremium(checked.premium).od,"2056");
});
test("3005/O B00 endorsement: two add-ons, printed NCB deduction, independent TP dates",()=>{
 const x=odFixture();
 const update={
   policy_number:"3005/O/123450002/00/B00",
   policy_issuance_date:"2026-11-10",
   policy_start_date:"2026-11-10",policy_end_date:"2027-11-09",
   third_party_start_date:"2024-09-10",third_party_end_date:"2029-09-09",
   vehicle_make:"CHETAK",vehicle_model:"BLUE 2903",
   vehicle_class:"Two Wheeler",vehicle_fuel_type:"Electric",
   vehicle_motor_power_kw:"2.8",idv:"84500",od_premium:"2063",
 };
 for(const [key,value] of Object.entries(update)){
   const found=x.fields.find(field=>field.key===key);
   if(found)found.value=value;
   else x.fields.push({key,label:key,value,confidence:null,page:3,evidence:key});
 }
 x.premium_components={
   basic_od_premium:1774,od_addons:[
     {name:"Zero Depreciation (Silver)",amount:634},
     {name:"IL Smart Assist",amount:99}],
   printed_od_subtotal:2507,od_deductions:444,total_od_premium:2063,
   basic_tp_premium:0,owner_driver_cpa:0,total_liability_premium:0,
   net_premium:2063,igst_exact:371.34,printed_total_tax:371,gross_premium:2434
 };
 const checked=validateN8nPolicyIntakeResponse(x,ids);
 assert.equal(checked.checksPassed,13);
 assert.deepEqual(mapVerifiedN8nMotorPremium(checked.premium),
   {od:"1330",addOnPremium:"733",tp:"0",cpa:"0",cpaOpted:"No"});
});
test("3005 Bundled non-individual: three OD addons and zero owner-driver CPA",()=>{
 const x=fresh();
 const update={
   policy_number:"3005/123450003/00/000",
   policy_issuance_date:"2026-11-16",
   policy_start_date:"2026-11-16",policy_end_date:"2027-11-15",
   third_party_start_date:"2026-11-16",third_party_end_date:"2031-11-15",
   vehicle_make:"CHETAK",vehicle_model:"CHETAK 3503",
   vehicle_class:"Two Wheeler",vehicle_fuel_type:"Electric",
   vehicle_motor_power_kw:"4.2",vehicle_registration_number:"NEW",
   vehicle_manufacturing_year:"2026",idv:"124163",
   od_premium:"2839",tp_premium:"3273",cpa_premium:"0",
 };
 for(const [key,value] of Object.entries(update)){
   const found=x.fields.find(field=>field.key===key);
   if(found)found.value=value;
   else x.fields.push({key,label:key,value,confidence:null,page:2,evidence:key});
 }
 x.premium_components={
   basic_od_premium:1598,od_addons:[
     {name:"Zero Depreciation (Silver)",amount:683},
     {name:"Return to Invoice",amount:248},
     {name:"Battery Protect Premium",amount:310}],
   total_od_premium:2839,basic_tp_premium:3273,owner_driver_cpa:0,
   total_liability_premium:3273,net_premium:6112,
   igst_exact:1100.16,printed_total_tax:1100,gross_premium:7212,
 };
 const checked=validateN8nPolicyIntakeResponse(x,ids);
 assert.equal(checked.checksPassed,13);
 assert.deepEqual(mapVerifiedN8nMotorPremium(checked.premium),
   {od:"1598",addOnPremium:"1241",tp:"3273",cpa:"0",cpaOpted:"No"});
});
