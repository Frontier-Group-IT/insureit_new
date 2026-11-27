import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assessProductVariantDirectConversion,mapVerifiedProductVariantPremium} from "../lib/policy-product-variant-direct-eligibility.ts";
const parserId="united_india_tractor_tp_native_pdf";
const values={
 policy_number:"2230003126P113410094",insurer_name:"United India Insurance Company Limited",
 insured_name:"SOURCE VERIFIED INSURED",policy_product:"Third-Party Only",
 policy_issuance_date:"2026-11-26",policy_start_date:"2026-11-27",policy_end_date:"2027-11-26",
 third_party_end_date:"2027-11-26",vehicle_registration_number:"HR30N6274",
 vehicle_registration_status:"registered",vehicle_class:"Agricultural Tractor",
 vehicle_make:"Escorts Kubota",vehicle_model:"POWERTRAC 445",vehicle_fuel_type:"Diesel",
 vehicle_capacity:"45",vehicle_manufacturing_year:"2014",
 vehicle_chassis_number:"T053257080",vehicle_engine_number:"3284872",
 vehicle_rto_state:"Haryana",idv:"0",od_premium:"0",tp_premium:"7317",cpa_premium:"0"
};
const fields=Object.entries(values).map(([key,value])=>({key,value,evidence:
 key==="vehicle_capacity"?"Native PDF: Tractor HP 45 / seating 1, source vehicle details":
 key==="cpa_premium"?"Native PDF: Owner-driver CPA cover removed":"Native PDF policy schedule"}));
const commercialPremium={od:0,tp:7317,net:7317,gst:1318,gross:8635};
const input={parserId,checksPassed:18,warnings:[],fields,commercialPremium};
assert.equal(assessProductVariantDirectConversion(input).eligible,true,"Original source-certified HR Powertrac 445 must pass");
assert.deepEqual(mapVerifiedProductVariantPremium(commercialPremium,parserId),{
 od:"0",tp:"7317",addOnPremium:"0",cpa:"0",cpaOpted:"No"
});
for(const [key,value] of [
 ["vehicle_make","MAHINDRA"],["vehicle_model","POWERTRAC 455"],
 ["vehicle_capacity","2760"],["vehicle_registration_number","MP20AB1234"],
 ["vehicle_rto_state","Madhya Pradesh"],["cpa_premium","275"]]){
 const variant={...input,fields:fields.map(f=>f.key===key?{...f,value}:f)};
 assert.equal(assessProductVariantDirectConversion(variant).eligible,false,"Must hold mismatched "+key);
}
assert.equal(assessProductVariantDirectConversion({...input,fields:fields.map(f=>f.key==="cpa_premium"?{...f,evidence:"Native PDF policy schedule"}:f)}).eligible,false);
assert.equal(assessProductVariantDirectConversion({...input,checksPassed:17}).eligible,false);
const sql=readFileSync(new URL("../../../supabase/migrations/20261127120000_ai_uiic_tractor_atomic_reconciliation.sql",import.meta.url),"utf8");
const worker=readFileSync(new URL("../lib/ai-policy-auto-booking-server.ts",import.meta.url),"utf8");
for(const gate of [
 "current_user <> 'service_role'",
 "'e86df069-22f5-48ec-a34f-a8cb94c2141b'::uuid",
 "a.state='uncertain'","a.failure_code='conversion_outcome_unknown'",
 "q.state='exception' and q.exception_codes=array['booking_review_required']::text[]",
 "q.parser_id='united_india_tractor_tp_native_pdf'",
 "q.checks_passed=18","q.last_error_code='united_tractor_tp_variant_unverified'",
 "a.document_id=q.document_id","a.extraction_fingerprint=q.extraction_fingerprint",
 "d.is_current=true","d.storage_bucket=i.storage_bucket","d.storage_path=i.storage_path",
 "draft.revision=1","i.final_policy_id is null and i.assigned_to_profile_id is null",
 "not exists (select 1 from public.policies p",
 "not exists (select 1 from public.policy_documents pd",
 "not exists (select 1 from public.audit_logs log",
 "on conflict on constraint policy_intake_ai_uiic_tractor_recovery_attempts_pkey do nothing",
 "policy_intake_ai_uiic_tractor_recovery_attempts r",
 "r.operator_profile_id=v_actor","r.state='claimed'",
 "v_intake.final_policy_id is not null",
 "public.onboard_motor_policy_commercial_status_v2(p_payload)"
])assert.ok(sql.includes(gate),"Missing UIIC safety gate: "+gate);
assert.ok(worker.includes('admin.rpc("claim_ai_auto_booking_uiic_tractor_v1"'));
assert.ok(worker.includes('claim.reconciledUiicTractor?"finish_ai_auto_booking_uiic_tractor_v1"'));
assert.ok(worker.includes('["Product variant evidence","product_variant_review"]'));
assert.ok(!sql.includes("'6e191de0-7777-4750-b4e4-4a60cb739ca9'::uuid"));
assert.doesNotMatch(sql,/update\s+public\.policy_intake_ai_auto_booking_attempts\b|truncate\s+public\.policy_intake_ai_/i);
console.log("UIIC 18/18 Powertrac TP source, premium and exactly-once reconciliation passed");
