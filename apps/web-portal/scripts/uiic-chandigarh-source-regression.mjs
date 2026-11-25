import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";

const here=path.dirname(fileURLToPath(import.meta.url));
const root=path.resolve(here,"..");
const tsSource=fs.readFileSync(path.join(root,"lib/policy-commercial-direct-eligibility.ts"),"utf8");
const js=ts.transpileModule(tsSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exportsObject={};
new Function("exports",js)(exportsObject);
const check=exportsObject.assessUiicGcvDirectConversion;
assert.equal(typeof check,"function");

const field=(key,value,evidence="Native PDF policy schedule")=>({key,value,evidence});
const baseline=[
 field("insured_name","SAMPLE TRANSPORT","Verified insured on current PDF"),
 field("policy_number","SAMPLE-001","Current PDF policy number"),
 field("insurer_name","United India Insurance Company Limited"),
 field("policy_issuance_date","2026-11-19"),
 field("policy_start_date","2026-11-19"),
 field("policy_end_date","2027-11-18"),
 field("third_party_start_date","2026-11-19"),
 field("third_party_end_date","2027-11-18"),
 field("policy_product","Goods Carrying Vehicle Package"),
 field("vehicle_class","Goods Carrying Vehicle"),
 field("vehicle_make","Tata Motors"),
 field("vehicle_model","SIGNA 4832.TK BSVI 10X4 HD 29BX"),
 field("vehicle_fuel_type","Diesel"),
 field("vehicle_manufacturing_year","2025"),
 field("vehicle_capacity","12000"),
 field("vehicle_chassis_number","MAT566218S3N30886"),
 field("vehicle_engine_number","EXAMPLEENGINE001"),
 field("vehicle_registration_status","registered"),
 field("vehicle_registration_number","CH01AB1234"),
 field("vehicle_rto_name","CHANDIGARH",
   "UIIC PDF vehicle Registration Authority: CHANDIGARH UT (RLA AND STA) INDIA"),
 field("idv","5215500"),
 field("od_premium","35069"),
 field("tp_premium","44342"),
 field("cpa_premium","0","UIIC PDF Compulsory Personal Accident (CPA) cover is removed"),
];
const premium={od:35069,tp:44342,net:79411,gst:8542,gross:87953};
const input=(fields=baseline,extras={})=>({
  parserId:"united_india_gcv_native_pdf",checksPassed:18,warnings:[],
  fields,commercialPremium:premium,...extras,
});
const mutate=(key,value,evidence)=>baseline.map(f=>f.key===key?{...f,value,...(evidence===undefined?{}:{evidence})}:f);
assert.deepEqual(check(input()),{eligible:true,reason:""});
for(const changed of [
 mutate("vehicle_rto_name","CHANDIGARH","Native PDF policy schedule"),
 mutate("vehicle_rto_name","DELHI"),
 mutate("vehicle_registration_number","PB35AQ9134"),
 mutate("vehicle_make","Tata"),
 mutate("cpa_premium","0","Native PDF policy schedule"),
]){
 assert.equal(check(input(changed)).eligible,false,"Changed or missing CH source must fail");
}
assert.equal(check(input(baseline,{checksPassed:17})).eligible,false);
assert.equal(check(input(baseline,{warnings:["Review required: authority"]})).eligible,false);
const mp=mutate("vehicle_registration_number","MP20AB1234")
 .map(f=>f.key==="vehicle_rto_name"?{...f,value:"JABALPUR",
   evidence:"UIIC PDF vehicle Registration Authority: MP20 JABALPUR INDIA"}:f);
assert.equal(check(input(mp)).eligible,true,"Previous MP path remains valid");
const source=fs.readFileSync(path.resolve(root,"../../infra/n8n-local/workflows/united-india-gcv-live-source-20261125.js"),"utf8");
assert(source.includes("const ch=unitedIndiaGcvFlexible(t)"));
assert(source.includes("CHANDIGARH UT (RLA AND STA) INDIA"));
assert(source.includes("if(classic.ok)return classic"),"Previous classic-first route retained");
assert(source.includes("currentRows.length===1") &&
  source.includes("currentAuthority==='CHANDIGARH UT (RLA AND STA) INDIA'"),
  "CH authority must be bound to current printed vehicle schedule row");
const parse=new Function("$input","$",source);
const fake="UNITED INDIA INSURANCE COMPANY LIMITED\n"+
 "GCV PUBLIC CARRIER OTHER THAN 3 WHEELER\nGross OD & TP:\n"+
 "Particulars of Vehicle Insured\nCH - 01 - AB - 1234\n"+
 "Registration Authority Auto Association Membership No. Geographical Area Extension\n"+
 "DELHI INDIA\nPrevious vehicle Registration Authority\n"+
 "CHANDIGARH UT (RLA AND STA) INDIA\n";
const out=parse({all:()=>[{json:{text:fake}}]},
 ()=>({first:()=>({json:{intake_id:"test",document_id:"test",request_id:"test"}})}))[0].json;
assert.notEqual(out.fields.find(f=>f.key==="vehicle_rto_name")?.value,"CHANDIGARH",
 "Historical Chandigarh mention must not override current DELHI authority");
console.log("UIIC Chandigarh exact-source and existing MP GCV regression passed");
