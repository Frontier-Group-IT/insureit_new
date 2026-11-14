import assert from "node:assert/strict";
import test from "node:test";
import { validateN8nPolicyIntakeResponse } from "../lib/policy-intake-n8n-validation.ts";

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
 assert.equal(result.ok,true);assert.equal(result.fields.length,18);
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
