import assert from "node:assert/strict";
import { validateN8nPolicyIntakeResponse } from "../lib/policy-intake-n8n-validation.ts";

const ids={intakeId:"00000000-0000-4000-8000-000000000001",
 documentId:"00000000-0000-4000-8000-000000000002",
 requestId:"00000000-0000-4000-8000-000000000003"};
const keys=["insurer","product","policy","insured","registration","vehicle","specs","rto",
 "tp_period","pa_period","liability","net","tax","header_total","receipt_date","no_od_cover"];
const field=(key,value)=>({key,value:String(value),label:key,page:1,confidence:null,evidence:"Tata AIG current policy schedule"});
const build=(longTerm)=>{
 const start=longTerm?"2026-11-21":"2026-12-04";
 const end=longTerm?"2029-11-20":"2027-12-03";
 const fields=[
  field("policy_number",longTerm?"6206975976 00 00":"6205531395 01 00"),
  field("insurer_name","TATA AIG GENERAL INSURANCE COMPANY LIMITED"),
  field("policy_product","Third-Party Only"),
  field("insured_name",longTerm?"M/S EXAMPLE PRIVATE LIMITED":"Mr EXAMPLE INSURED"),
  field("vehicle_registration_status",longTerm?"Unregistered":"Registered"),
  ...(!longTerm?[field("vehicle_registration_number","MH02AU8015")]:[]),
  field("vehicle_class","PCP"),field("vehicle_make","HONDA"),
  field("vehicle_model",longTerm?"ELEVATE / ZX":"CITY / ZX EXI"),
  field("vehicle_fuel_type","PETROL"),field("vehicle_manufacturing_year",longTerm?"2026":"2006"),
  field("vehicle_capacity",longTerm?"1498":"1497"),
  field("vehicle_chassis_number","MAKDG587KT4300436"),
  field("vehicle_engine_number","L15ZD3402565"),field("vehicle_rto_name",longTerm?"BADSHAPUR":"MUMBAI"),
  field("vehicle_rto_state",longTerm?"HARYANA":"MAHARASHTRA"),
  field("policy_start_date",start),field("policy_end_date",end),
  field("third_party_start_date",start),field("third_party_end_date",end),
  ...(!longTerm?[field("cpa_start_date",start),field("cpa_end_date",end)]:[]),
  field("od_premium",0),field("add_on_premium",0),
  field("tp_premium",longTerm?10640:3466),field("cpa_premium",longTerm?0:375),
  field("cpa_opted",longTerm?"No":"Yes"),
 ];
 return {
  contract_version:"1",intake_id:ids.intakeId,document_id:ids.documentId,request_id:ids.requestId,
  ok:true,review_required:true,auto_finalize_allowed:false,extraction_method:"native_pdf_text",
  parser_id:longTerm?"tata_aig_private_car_three_year_tp_n8n_native_pdf":"tata_aig_private_car_liability_only_n8n_native_pdf",
  parser_version:longTerm?"tata-aig-3y-tp-v1":"tata-aig-tp-v1",
  fields,checks:Object.fromEntries(keys.map(k=>[k,true])),checks_passed:16,failed_checks:[],
  warnings:["tata_aig_issuance_date_requires_verified_pdf_signature","tata_aig_human_review_required"],
  premium_components:{basic_od_premium:0,od_addons:[],addon_subtotal:0,
   basic_tp_premium:longTerm?10640:3416,owner_driver_cpa:longTerm?0:375,
   paid_driver_liability:longTerm?0:50,total_liability_premium:longTerm?10640:3841,
   printed_net_premium:longTerm?10640:3841,printed_total_tax:longTerm?1915:691,
   gross_premium:longTerm?12555:4532,receipt_date:"2026-11-20"},
 };
};
for(const longTerm of [false,true]){
 const response=build(longTerm);
 const validated=validateN8nPolicyIntakeResponse(response,ids);
 assert.equal(validated.checksPassed,16);
 assert.equal(validated.receiptDate,"2026-11-20");
 assert.equal(validated.premium.gross,longTerm?12555:4532);
 const bad=(edit)=>{
  const clone=structuredClone(response);edit(clone);
  assert.throws(()=>validateN8nPolicyIntakeResponse(clone,ids));
 };
 bad(x=>{x.document_id="00000000-0000-4000-8000-ffffffffffff";});
 bad(x=>{x.checks.tax=false;});
 bad(x=>{x.checks_passed=15;});
 bad(x=>{x.warnings=["unverified"]});
 bad(x=>{x.premium_components.gross_premium+=100});
 bad(x=>{x.fields.find(f=>f.key==="policy_number").value="0000000000 00 00";x.policy_number="fake";x.insurer_name="fake";});
 bad(x=>{x.fields.find(f=>f.key==="policy_product").value="Package";});
 if(longTerm){
  bad(x=>{x.fields.push(field("vehicle_registration_number","MH02AU8015"));});
  bad(x=>{x.fields.push(field("cpa_start_date","2026-11-21"));});
 }else{
  bad(x=>{x.fields=x.fields.filter(f=>f.key!=="vehicle_registration_number")});
  bad(x=>{x.fields.find(f=>f.key==="cpa_opted").value="No";});
 }
}
console.log("Tata AIG TP-only 16-check bridge acceptance and negative controls passed");
