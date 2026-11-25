import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
import ts from "typescript";
const here=path.dirname(fileURLToPath(import.meta.url));
const source=fs.readFileSync(path.resolve(here,"../lib/policy-held-insurer-candidate-admission.ts"),"utf8");
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const ex={};new Function("exports",compiled)(ex);
const admit=ex.assessHeldInsurerCandidate;
const ids={intake_id:"a",document_id:"b",request_id:"c"};
const MAGMA=[
 "insurer_product_verified","policy_number_verified","insured_name_verified","issuance_date_printed",
 "policy_dates_verified","vehicle_registration_verified","vehicle_engine_chassis_verified",
 "manufacturer_model_printed","vehicle_year_printed","vehicle_capacity_printed",
 "vehicle_idv_printed","vehicle_fuel_source_verified","od_premium_reconciled",
 "tp_cpa_paid_driver_reconciled","net_premium_reconciled","tax_components_printed",
 "gross_premium_reconciled","package_not_tp_only"];
const NATIONAL=[
 "insurer_product_verified","policy_number_verified","insured_name_verified","printed_issuance_date_verified",
 "coverage_dates_verified","registration_printed","engine_chassis_printed","make_model_variant_printed",
 "vehicle_class_verified","fuel_source_verified","manufacture_year_verified","capacity_cc_printed",
 "liability_only_no_own_damage","printed_tp_premium_verified","printed_tax_components_verified",
 "net_tax_gross_reconciled","stamp_charge_disclosed","separately_charged_cpa_absent"];
const OI=[
 "insurer_product_verified","policy_identity_verified","insured_name_verified",
 "coverage_period_verified","printed_issuance_or_verified_image_date",
 "registered_vehicle_plate_verified","engine_chassis_verified","vehicle_make_model_verified",
 "vehicle_class_verified","vehicle_fuel_source_verified","manufacture_year_printed",
 "vehicle_capacity_printed","idv_printed","separate_od_tp_components_printed",
 "cpa_is_product_specific_and_evidenced","net_premium_reconciled",
 "gst_and_gross_printed","tax_and_premium_reconciled"];
const f=(key,value,evidence="Source-labelled policy schedule")=>({key,value:String(value),evidence});
function build(kind){
 const national=kind==="national",ori=kind==="oriental";
 const insurer=national?"National Insurance Company Limited":ori?"The Oriental Insurance Company Limited":"Magma General Insurance Limited";
 const product=national?"Private Car Liability Only":ori?"GCCV Public Carriers Package":"Private Car Package";
 const p=national?{od:0,tp:3416,net:3416,gst:615,gross:4031,cpa:0,cgst:0,sgst:0,igst:615}
  :ori?{od:4558,tp:44370,net:48928,gst:3094,gross:52022,cpa:320,taxRegime:"CGST_SGST_FOUR_COMPONENT",printedComponents:12}
  :{od:4649,tp:2594,net:7243,gst:1303.74,gross:8547,cpa:450,basicTp:2094,paidDriver:50,
   taxRegime:"CGST_SGST",cgst:651.87,sgst:651.87,igst:null};
 const pid=national?"national_private_car_liability_only_native_pdf":ori?"oriental_gccv_package_native_pdf":"magma_private_car_package_native_pdf";
 const checks=Object.fromEntries((national?NATIONAL:ori?OI:MAGMA).map(k=>[k,true]));
 const fields=[
 f("insurer_name",insurer),f("policy_number","SAMPLE12345"),f("insured_name","TEST INSURED"),
 f("policy_product",product),f("policy_start_date","2026-11-23"),f("policy_end_date","2027-11-22"),
 f("policy_issuance_date","2026-11-20",national?"NIA certificate printed Date of issue":ori?"Oriental explicitly printed Policy Issue Date":"Magma PDF printed Date of Issue"),
 f("vehicle_registration_status","registered"),f("vehicle_registration_number","HR30Z0885"),
 f("vehicle_make",national?"FORD":ori?"BharatBenz":"RENAULT"),
 f("vehicle_model",national?"ECOSPORT":ori?"2523C TIPPER":"TRIBER RXE MT"),
 f("vehicle_fuel_type",national?"DIESEL":ori?"DIESEL":"Petrol",national||ori?"Vehicle policy schedule":"Manufacturer model-family: Renault Triber RXE MT 999 cc Petrol"),
 f("vehicle_manufacturing_year","2022"),f("vehicle_capacity","999"),
 f("vehicle_chassis_number","SAMPLECHASSISABC12"),f("vehicle_engine_number","SAMPLEENGINE123"),
 f("vehicle_class",ori?"Goods Carrying Vehicle":"Private Car"),
 f("idv",national?0:420000,national?"NIA liability-only PDF prints Vehicle IDV NA":"Source-labelled IDV"),
 f("od_premium",p.od),f("tp_premium",p.tp),f("cpa_premium",p.cpa)
 ];
 return {contract_version:"1",parser_id:pid,parser_version:"source-candidate-1",
  extraction_method:"native_pdf_text",ok:true,validation_passed:true,
  review_required:true,auto_finalize_allowed:false,...ids,
  checks,warnings:[],fields,premium_components:p};
}
const clone=x=>structuredClone(x);
for(const kind of ["magma","national","oriental"]){
 const v=build(kind),passed=admit(v,ids);
 assert.equal(passed.accepted,true,kind+": "+passed.reason);
 assert.equal(Number(passed.canonicalPremium.tp)+Number(passed.canonicalPremium.cpa),
   v.premium_components.tp,"CPA must be split exactly once");
 const oneRto=clone(v);
 oneRto.fields.push(f("vehicle_rto_name","PALWAL","Source RTO city row"));
 assert.equal(admit(oneRto,ids).accepted,true,"City only must not block");
 const other=clone(v);
 other.fields.push(f("vehicle_rto_state","Haryana","Source RTO state row"));
 assert.equal(admit(other,ids).accepted,true,"State only must not block");
 const both=clone(v);both.fields.push(...oneRto.fields.slice(-1),...other.fields.slice(-1));
 assert.equal(admit(both,ids).accepted,true,"Both RTO fields independently optional");
 for(const change of [
  x=>{x.document_id="stale";},x=>{x.auto_finalize_allowed=true;},
  x=>{delete x.checks[Object.keys(x.checks)[0]];},x=>{x.premium_components.gross+=200;},
  x=>{x.fields.push(f("policy_number","DUPLICATE"));},
  x=>{x.fields.find(f=>f.key==="vehicle_registration_number").value="HR30";},
  x=>{x.fields.find(f=>f.key==="policy_issuance_date").value="2026-02-30";},
  x=>{x.fields.find(f=>f.key==="cpa_premium").value="999";}
 ]){const bad=clone(v);change(bad);assert.equal(admit(bad,ids).accepted,false,kind+" negative source case");}
}
const wrongCity=build("magma");wrongCity.fields.push(f("vehicle_rto_name","DELHI","Customer address"));
assert.equal(admit(wrongCity,ids).accepted,false);
const nationalOd=build("national");nationalOd.premium_components.od=100;
assert.equal(admit(nationalOd,ids).accepted,false,"Liability Only must never gain OD");
const orientalWithoutDate=build("oriental");orientalWithoutDate.checks.printed_issuance_or_verified_image_date=false;
assert.equal(admit(orientalWithoutDate,ids).accepted,false,"Unverified Oriental issuance must remain held");
const orientalFakeDate=build("oriental");orientalFakeDate.fields.find(f=>f.key==="policy_issuance_date").evidence="Generic footer Date";
assert.equal(admit(orientalFakeDate,ids).accepted,false,"Footer date not policy issue evidence");
const magnaWrongTax=build("magma");magnaWrongTax.premium_components.cgst=900;
assert.equal(admit(magnaWrongTax,ids).accepted,false);
console.log("Held new insurers: strict source response/CPA split/optional independent RTO/identity and premium negative gates passed");
