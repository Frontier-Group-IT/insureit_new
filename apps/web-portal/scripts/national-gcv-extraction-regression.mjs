import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,"../lib/policy-nontata-commercial-n8n.ts"),"utf8");
const eligibility=fs.readFileSync(path.resolve(here,"../lib/ai-policy-onboarding-eligibility.ts"),"utf8");
const begin=source.indexOf("export function validateNationalGcvExtractionOnly(");
const end=source.indexOf("function validate(payload:",begin);
assert(begin>0&&end>begin);
const m={exports:{}};
const js=ts.transpileModule(source.slice(begin,end),{
 compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022},
}).outputText;
const allowed=[
 "insurer_name","policy_product","policy_number","insured_name",
 "policy_issuance_date","policy_start_date","policy_end_date","third_party_start_date",
 "third_party_end_date","vehicle_registration_number","vehicle_registration_status",
 "vehicle_engine_number","vehicle_chassis_number","vehicle_make","vehicle_model",
 "vehicle_class","vehicle_fuel_type","vehicle_manufacturing_year","vehicle_capacity",
 "vehicle_rto_name","idv","od_premium","tp_premium"
];
new Function("exports","object","ALLOWED_FIELDS",js)(m.exports,
 x=>!!x&&typeof x==="object"&&!Array.isArray(x),new Set(allowed));
const verify=m.exports.validateNationalGcvExtractionOnly;
const ids={intake_id:"11111111-1111-4111-8111-111111111111",
 document_id:"22222222-2222-4222-8222-222222222222",
 request_id:"33333333-3333-4333-8333-333333333333"};
const exact="NIA bilingual goods carrying vehicle package schedule";
const vals={
 insurer_name:"National Insurance Company Limited",
 policy_product:"Goods Carrying Vehicle Package",policy_number:"123456789012345678",
 insured_name:"EXAMPLE TRANSPORT",policy_issuance_date:"2026-11-25",
 policy_start_date:"2026-11-26",policy_end_date:"2027-11-25",
 third_party_start_date:"2026-11-26",third_party_end_date:"2027-11-25",
 vehicle_registration_number:"HR38Y3562",vehicle_registration_status:"registered",
 vehicle_engine_number:"A1234567890123",vehicle_chassis_number:"A1234567890123456",
 vehicle_make:"Eicher Motors Limited",vehicle_model:"EICHER PRO 1110 EICHER PRO 1110",
 vehicle_class:"Goods Carrying Vehicle",vehicle_fuel_type:"DIESEL",
 vehicle_manufacturing_year:"2018",vehicle_capacity:"2960",
 vehicle_rto_name:"Faridabad - Comm Vehicles Only",
 idv:"735000",od_premium:"1723.04",tp_premium:"27286"
};
const checkNames=[
 "insurer_product_verified","policy_number_verified","insured_name_verified",
 "printed_issuance_date_verified","coverage_dates_verified","registration_printed",
 "engine_chassis_printed","make_model_variant_printed","vehicle_class_verified",
 "fuel_source_verified","manufacture_year_verified","capacity_cc_printed",
 "idv_printed","od_tp_components_reconciled","printed_tax_components_verified",
 "net_tax_gross_reconciled","tp_itemization_reconciled","stamp_charge_disclosed"
];
const p={contract_version:"1",parser_id:"national_gcv_package_native_pdf",
 parser_version:"source-candidate-1",extraction_method:"native_pdf_text",
 review_required:true,auto_finalize_allowed:false,ok:true,validation_passed:true,
 ...ids,checks:Object.fromEntries(checkNames.map(k=>[k,true])),warnings:[],
 fields:Object.entries(vals).map(([key,value])=>({key,value,label:key,
  evidence:key==="policy_issuance_date"?"NIA printed Date of issue":exact,
  page:null,confidence:null})),
 premium_components:{od:1723.04,tp:27286,cpa:null,net:29009,
  gst:1687,gross:30696,cgst:0,sgst:0,igst:1687,stampDuty:0,
  separatelyPaidStamp:.5,taxRegime:"IGST"}
};
const good=verify(p,ids);
assert.equal(good.checksPassed,18);
assert.equal(good.premium.od,1723.04);
assert.equal("candidateCanonicalPremium" in good,false,"No unverified CPA can enter booking");
const rejects=x=>assert.throws(()=>verify(x,ids));
rejects({...p,document_id:"another-document"});
rejects({...p,checks:{...p.checks,printed_issuance_date_verified:false}});
rejects({...p,premium_components:{...p.premium_components,cpa:0}});
rejects({...p,premium_components:{...p.premium_components,gross:30697}});
rejects({...p,premium_components:{...p.premium_components,igst:1688}});
rejects({...p,fields:p.fields.map(f=>f.key==="vehicle_make"?{...f,evidence:"Unverified text"}:f)});
rejects({...p,fields:p.fields.map(f=>f.key==="policy_issuance_date"?{...f,value:"2027-11-26"}:f)});
rejects({...p,fields:p.fields.map(f=>f.key==="vehicle_make"?{...f,value:"Other Maker"}:f)});
rejects({...p,fields:[...p.fields,p.fields[0]]});
const classifier=source.slice(source.indexOf("function insurerForText("),
 source.indexOf("/** Strict insurer/product refinement",source.indexOf("function insurerForText(")));
assert.ok(classifier.includes("Policy Schedule-Motor"),"National GCV product heading must be classified");
assert.match(classifier,/National Insurance Co/);
assert.match(eligibility,/"national_gcv_package_native_pdf"/);
console.log("National GCV strict source-only extraction positives and negatives passed");
