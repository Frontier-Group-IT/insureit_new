import assert from "node:assert/strict";
import {acceptGoDigitNewJcbExtraction} from "../lib/policy-digit-new-jcb-extraction.ts";
import {assessGoDigitNewJcbDirectConversion} from "../lib/policy-digit-new-jcb-direct-eligibility.ts";
const ids={intake_id:"00000000-0000-4000-8000-000000000001",
 document_id:"00000000-0000-4000-8000-000000000002",
 request_id:"00000000-0000-4000-8000-000000000003"};
const keyset=[
"insurer_verified","policy_identity_verified","insured_name_verified",
"policy_start_end_verified","issuance_date_evidenced",
"vehicle_identification_verified","vehicle_make_model_verified",
"vehicle_class_verified","vehicle_registration_printed","vehicle_idv_verified",
"od_tp_components_printed","net_od_tp_reconciled",
"gst_independently_evidenced","gross_net_tax_reconciled",
"digit_layout","unregistered_new_printed","od_basic_ncb","tp_itemization"];
const field=(key,value,evidence="Native PDF policy schedule")=>
 ({key,label:key,value:String(value),confidence:null,page:null,evidence});
const fields=[
 field("insurer_name","Go Digit General Insurance Limited"),
 field("policy_number","D123456789"),
 field("insured_name","TEST NEW JCB OWNER"),
 field("policy_product","Digit Commercial Vehicle Insurance"),
 field("policy_start_date","2026-11-25"),
 field("policy_end_date","2027-11-24"),
 field("policy_issuance_date","2026-11-25"),
 field("third_party_start_date","2026-11-25"),
 field("third_party_end_date","2027-11-24"),
 field("vehicle_registration_number","NEW","Digit PDF vehicle schedule: printed NEW registration"),
 field("vehicle_registration_status","registration_pending","Digit PDF vehicle schedule: printed NEW registration"),
 field("vehicle_make","JCB"),field("vehicle_model","3 DX PLUS CEV V / BACKHOE LOADER"),
 field("vehicle_class","Commercial Vehicle - Miscellaneous Class D"),
 field("vehicle_fuel_type","Diesel"),field("vehicle_manufacturing_year","2026"),
 field("vehicle_capacity","4765"),field("vehicle_chassis_number","RAJ3DXTEST123456789"),
 field("vehicle_engine_number","H12345678"),
 field("idv","3581500"),field("od_premium","5019.02"),
 field("tp_premium","7647"),
 field("cpa_premium","330","Digit PDF PA cover for Owner-Driver (printed)")];
const payload={...ids,contract_version:"1",parser_id:"go_digit_jcb_new_unregistered_native_pdf",
 parser_version:"non-tata-cv-v2",extraction_method:"native_pdf_text",
 review_required:true,auto_finalize_allowed:false,ok:true,validation_passed:true,
 checks:Object.fromEntries(keyset.map(k=>[k,true])),warnings:[],fields,
 premium_components:{od:5019.02,tp:7647,net:12666.02,gst:2279.88,gross:14945.90,
  ownerDriverCpa:330,basicThirdPartyLiability:7267,paidDriverLiability:50}};
const clone=x=>structuredClone(x);
const admit=(p)=>acceptGoDigitNewJcbExtraction(p,ids);
const x=admit(payload);
assert.equal(x.candidateCanonicalPremium.tp,"7317");
assert.equal(x.candidateCanonicalPremium.cpa,"330");
assert.equal(x.candidateCanonicalPremium.cpaOpted,"Yes");
assert.equal(assessGoDigitNewJcbDirectConversion({
 parserId:x.parserId,checksPassed:x.checksPassed,warnings:[],fields:x.fields,
 commercialPremium:x.premium,candidateCanonicalPremium:x.candidateCanonicalPremium,
}).eligible,true);
for(const change of [
 p=>p.premium_components.ownerDriverCpa=0,
 p=>p.premium_components.basicThirdPartyLiability=7297,
 p=>p.premium_components.paidDriverLiability=45,
 p=>p.fields.find(f=>f.key==="cpa_premium").value="0",
 p=>p.fields.find(f=>f.key==="cpa_premium").evidence="Unverified screenshot",
 p=>p.fields=p.fields.filter(f=>f.key!=="cpa_premium"),
 p=>p.fields.find(f=>f.key==="vehicle_registration_number").value="MP20AB1234",
 p=>p.fields.find(f=>f.key==="vehicle_capacity").value="",
 p=>p.fields.find(f=>f.key==="vehicle_manufacturing_year").value="",
 p=>p.fields.push({...p.fields[0]}),
 p=>p.checks.tp_itemization=false,
 p=>p.premium_components.net=12667.03,
 p=>p.auto_finalize_allowed=true,
 ]){const bad=clone(payload);change(bad);assert.throws(()=>admit(bad),"Tampered source evidence must fail closed");}
// Source replay of the other original Go Digit NEW backhoe product family:
// 3 DX ECO XPERT, independent insurer printed premium values.
const eco=clone(payload);
eco.fields.find(f=>f.key==="vehicle_model").value="3 DX ECO XPERT / BACKHOE LOADER";
eco.fields.find(f=>f.key==="vehicle_chassis_number").value="RAJ3DXE5P03631865";
eco.fields.find(f=>f.key==="vehicle_engine_number").value="H00541836";
eco.fields.find(f=>f.key==="idv").value="3309713";
eco.fields.find(f=>f.key==="od_premium").value="4638.15";
eco.premium_components={od:4638.15,tp:7647,net:12285.15,
 gst:2211.33,gross:14496.48,ownerDriverCpa:330,
 basicThirdPartyLiability:7267,paidDriverLiability:50};
const ecoParsed=admit(eco);
assert.equal(ecoParsed.candidateCanonicalPremium.tp,"7317");
assert.equal(ecoParsed.candidateCanonicalPremium.cpa,"330");
assert.equal(assessGoDigitNewJcbDirectConversion({
 parserId:ecoParsed.parserId,checksPassed:18,warnings:[],fields:ecoParsed.fields,
 commercialPremium:ecoParsed.premium,
 candidateCanonicalPremium:ecoParsed.candidateCanonicalPremium,
}).eligible,true,"ECO XPERT source-verified CPA and NEW identity");
for(const modify of [
 q=>q.fields.find(f=>f.key==="vehicle_model").value="3 DX ECO UNKNOWN / BACKHOE LOADER",
 q=>q.premium_components.ownerDriverCpa=0,
 q=>q.premium_components.gross=14496.58,
 q=>q.fields.find(f=>f.key==="vehicle_registration_number").value="MP20AB1234",
 q=>q.fields.find(f=>f.key==="cpa_premium").evidence="Unknown",
 q=>q.checks.unregistered_new_printed=false,
]){
 const fail=clone(eco);modify(fail);
 assert.throws(()=>admit(fail),"ECO XPERT uncertain evidence must fail closed");
}
const missingCity=clone(x);missingCity.fields=missingCity.fields.filter(f=>!["vehicle_rto_name","vehicle_rto_state"].includes(f.key));
assert.equal(assessGoDigitNewJcbDirectConversion({
 parserId:missingCity.parserId,checksPassed:18,warnings:[],fields:missingCity.fields,
 commercialPremium:missingCity.premium,candidateCanonicalPremium:missingCity.candidateCanonicalPremium,
}).eligible,true,"Both RTO fields optional");
assert.equal(assessGoDigitNewJcbDirectConversion({
 parserId:x.parserId,checksPassed:18,warnings:[],fields:x.fields,
 commercialPremium:x.premium,
 candidateCanonicalPremium:{...x.candidateCanonicalPremium,cpa:"0"},
}).eligible,false,"Canonical CPA must not be silently omitted");
console.log("Go Digit NEW JCB source CPA and canonical split positive/negative checks passed");
