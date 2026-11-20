import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { validateTataAigN8nResponse } from "../lib/policy-intake-n8n-validation.ts";
import { mapVerifiedN8nMotorPremium } from "../lib/policy-n8n-onboarding-premium.ts";
import { buildPolicyOcrOnboardingUpdate } from "../lib/policy-ocr-onboarding-apply.ts";

const read = relative => fs.readFileSync(fileURLToPath(new URL(relative,import.meta.url)),"utf8");
const parse = new Function("$input",read("../../../infra/n8n-local/workflows/tata-aig-real-pdf-parser-v2.js"));
const returnWeb = new Function("$input","$",read("../../../infra/n8n-local/workflows/tata-aig-real-pdf-return-v2.js"));
const fixtures=JSON.parse(read("./fixtures/tata-aig-real-layout-anonymized.json"));
assert.equal(fixtures.length,6);
const IDs={intakeId:"00000000-0000-4000-8000-000000000001",
  documentId:"00000000-0000-4000-8000-000000000002",
  requestId:"00000000-0000-4000-8000-000000000003"};
const checks=new Set(["current_insurer_verified","supported_layout_verified","policy_identity_verified",
"insured_present","vehicle_identity_verified","vehicle_registration_status_verified","vehicle_specs_verified",
"rto_resolved","idv_verified","coverage_periods_verified","basic_od_ncb_reconciled","itemized_addons_reconciled",
"liability_components_reconciled","net_premium_reconciled","tax_premium_reconciled","gross_premium_reconciled",
"receipt_date_document_consistent","policy_number_receipt_agree"]);
const money=x=>String(Math.round(Number(x)*100)/100);
function toWeb(r){
  const f=r.fields,p=r.premium_components;
  const fields=[];
  const add=(key,value,label)=>{if(value===null||value===undefined||String(value).trim()==="")return;
    fields.push({key,label,value:String(value),confidence:null,page:key==="insured_name"?1:null,
      evidence:key==="insured_name"?"Name of Insured":"Tata AIG current-policy schedule"});};
  add("policy_number",f.policy_number,"Current policy number");
  add("insurer_name",f.insurer_name,"Current insurer");
  add("policy_product",f.policy_product,"Policy product");
  add("insured_name",f.insured_name,"Name of insured");
  add("vehicle_registration_status",f.vehicle_registration_status,"Registration status");
  add("vehicle_registration_number",f.vehicle_registration_number,"Registration number");
  add("vehicle_class",f.vehicle_class,"Vehicle class");
  add("vehicle_make",f.vehicle_make,"Vehicle make");
  add("vehicle_model",f.vehicle_model,"Model / variant");
  add("vehicle_fuel_type",f.vehicle_fuel_type,"Fuel type");
  add("vehicle_manufacturing_year",f.vehicle_manufacturing_year,"Manufacturing year");
  add("vehicle_capacity",f.vehicle_capacity_cc,"Capacity");
  add("vehicle_motor_power_kw",f.vehicle_motor_power_kw,"Electric power kW");
  add("vehicle_chassis_number",f.vehicle_chassis_number,"Chassis");
  add("vehicle_engine_number",f.vehicle_engine_number,"Engine");
  add("vehicle_rto_name",f.vehicle_rto_city,"RTO city");
  add("vehicle_rto_state",f.vehicle_rto_state,"RTO state");
  add("idv",f.idv,"IDV");
  add("policy_start_date",f.policy_start_date,"OD start");
  add("policy_end_date",f.policy_end_date,"OD expiry");
  add("third_party_start_date",f.third_party_start_date,"TP start");
  add("third_party_end_date",f.third_party_end_date,"TP expiry");
  add("cpa_start_date",f.cpa_start_date,"Owner CPA start");
  add("cpa_end_date",f.cpa_end_date,"Owner CPA expiry");
  add("od_premium",money(f.od_premium),"OD");
  add("add_on_premium",money(f.addon_premium),"Add-ons");
  add("tp_premium",money(p.basic_tp+p.paid_driver_liability+p.unnamed_passenger_pa+p.roadside_assistance),"TP and non-owner liability");
  add("cpa_premium",money(p.owner_driver_cpa),"CPA");
  add("cpa_opted",p.owner_driver_cpa>0?"Yes":"No","CPA opted");
  return {contract_version:"1",intake_id:IDs.intakeId,document_id:IDs.documentId,
    request_id:IDs.requestId,ok:true,review_required:true,auto_finalize_allowed:false,
    extraction_method:"native_pdf_text",parser_id:r.parser_id,parser_version:r.parser_version,
    checks:r.checks,fields,
    premium_components:{basic_od_premium:p.basic_od,ncb_deduction:p.ncb_discount,
      post_ncb_od_premium:p.od_after_ncb,od_addons:p.addons.map(a=>({...a})),
      addon_subtotal:p.addon_total,basic_tp_premium:p.basic_tp,
      owner_driver_cpa:p.owner_driver_cpa,paid_driver_liability:p.paid_driver_liability,
      passenger_pa:p.unnamed_passenger_pa,roadside_assistance:p.roadside_assistance,
      total_liability_premium:p.total_liability,printed_net_premium:p.printed_net,
      component_net_premium:p.component_net,printed_total_tax:p.tax,gross_premium:p.printed_gross},
    warnings:["tata_aig_issuance_date_unverified","tata_aig_human_review_required",
      ...(Math.abs(p.component_net-p.printed_net)>0.005?["tata_aig_printed_net_rounding"]:[])]};
}
// A printed Haryana district+four-digit registration (without alphabetic
// series) is valid ONLY when a prior Date of Registration is independently
// printed. A district prefix alone, or an undated short number, remains blocked.
const historicalCar=fixtures[4];
const historicalText=historicalCar.text
  .replace("Registration No. HR00AB0001","Registration No. HR994321")
  +"\nDate of Registration 02/12/2020\n";
const historical=parse({all:()=>[{json:{text:historicalText}}]})[0].json;
assert.equal(historical.ok,true,"Historic Haryana format must not fail registration validation");
assert.equal(historical.checks_passed,18);
assert.equal(historical.fields.vehicle_registration_status,"registered");
assert.equal(historical.fields.vehicle_registration_number,"HR994321");
const historicalNormalized=returnWeb(
 {first:()=>({json:historical})},
 () => ({first:()=>({json:{intake_id:IDs.intakeId,document_id:IDs.documentId,request_id:IDs.requestId}})}),
)[0].json;
assert.equal(validateTataAigN8nResponse(historicalNormalized,IDs).ok,true);
const historicalMissingDate=historicalText.replace("Date of Registration 02/12/2020","");
const rejectedHistorical=parse({all:()=>[{json:{text:historicalMissingDate}}]})[0].json;
assert.equal(rejectedHistorical.ok,false,"Undated short number must not be accepted");
assert.equal(rejectedHistorical.checks.vehicle_registration_status_verified,false);
for(const invalidDate of ["99/99/2020","31/12/2099"]){
 const malformed=historicalText.replace("02/12/2020",invalidDate);
 const rejected=parse({all:()=>[{json:{text:malformed}}]})[0].json;
 assert.equal(rejected.ok,false,"Invalid/future historic registration date must not qualify");
 assert.equal(rejected.checks.vehicle_registration_status_verified,false);
}

for(const [i,fixture] of fixtures.entries()){
  const parsed=parse({all:()=>[{json:{text:fixture.text}}]})[0].json;
  assert.equal(parsed.ok,true,fixture.name+" "+JSON.stringify(parsed.failed_checks));
  assert.equal(parsed.checks_passed,18);
  assert.deepEqual(new Set(Object.keys(parsed.checks)),checks);
  assert.ok(Object.values(parsed.checks).every(Boolean));
  assert.equal(parsed.fields.policy_number,fixture.policy.replace(/\s/g,""));
  const normalized=returnWeb(
    {first:()=>({json:parsed})},
    () => ({first:()=>({json:{intake_id:IDs.intakeId,document_id:IDs.documentId,request_id:IDs.requestId}})}),
  )[0].json;
  assert.equal(normalized.ok,true,"strict response node must return a reviewed JSON contract");
  const projected=toWeb(parsed);
  for(const key of ["policy_number","vehicle_registration_status","vehicle_class","vehicle_motor_power_kw","od_premium","add_on_premium","tp_premium","cpa_premium","cpa_opted"]){
    const expected=projected.fields.find(x=>x.key===key)?.value ?? "";
    const actual=normalized.fields.find(x=>x.key===key)?.value ?? "";
    assert.equal(actual,expected,fixture.name+" "+key);
  }
  const valid=validateTataAigN8nResponse(normalized,IDs);
  assert.equal(valid.checksPassed,18);
  assert.equal(valid.fields.some(f=>f.key==="policy_issuance_date"),false);
  const tw=i<4;
  assert.equal(parsed.fields.vehicle_class,tw?"TWP":"PCP");
  assert.equal(parsed.fields.vehicle_registration_status,tw?"unregistered":"registered");
  assert.equal(normalized.fields.some(f=>f.key==="vehicle_registration_number"),!tw);
  assert.equal(parsed.fields.vehicle_fuel_type,tw?"ELECTRIC":"PETROL");
  const result=mapVerifiedN8nMotorPremium(valid.premium);
  assert.equal(result.cpaOpted,parsed.premium_components.owner_driver_cpa>0?"Yes":"No");
  assert.ok(Math.abs(Number(result.od)+Number(result.tp)+Number(result.cpa)+Number(result.addOnPremium)-valid.premium.net)<0.05);
  assert.equal(Math.round(valid.premium.gross),[7220,7225,8336,7823,22727,4873][i]);
  const form=buildPolicyOcrOnboardingUpdate({
    mode:"create",registrationMode:"registered",rcVerified:false,
    manufacturers:["Bajaj","Kia","Honda"],
    insurers:[{value:"tata",label:"Tata AIG General Insurance Company Limited"}],
    current:{registrationNo:"",insuredName:"",phoneNo:"",vehicleClass:"",make:"",
      model:"",fuelType:"",manufacturingYear:"",capacity:"",chassisNo:"",engineNo:"",
      rtoState:"",rtoName:"",policyProduct:"",idv:"",od:"",tp:"",cpa:"",
      policyNo:"",insurerId:"",validFrom:"",validUpto:"",
      addOnPremium:"",tpValidUpto:"",cpaValidUpto:""},
    fields:valid.fields,
  });
  assert.equal(form.next.vehicleClass,tw?"TWP":"PCP");
  assert.equal(form.registrationMode,tw?"unregistered":"registered");
  assert.equal(form.next.registrationNo,tw?"":parsed.fields.vehicle_registration_number);
  assert.equal(form.next.policyProduct,tw?"Bundled":"Package");
  assert.equal(form.next.insurerId,"tata");
  if(tw){assert.equal(form.next.fuelType,"Electric");assert.equal(form.next.capacity,"4");}
  else{assert.equal(form.next.capacity,"1497");}
  if (i===0 || i===4) {
    // Reproduce actual n8n PDF.js output: the text extractor drops
    // "Certificate of", and rasterized signing metadata is not text.
    const pdfJsText=fixture.text
      .replace(/Certificate of Insurance Cum Policy Schedule/g,"Insurance Cum Policy Schedule")
      .replace(/Digitally Signed by:[\s\S]{0,100}?Date:[^\n]*/g,
        "Electronic signature present; signature date not in native PDF text");
    assert.notEqual(pdfJsText,fixture.text);
    const pdfJsParsed=parse({all:()=>[{json:{text:pdfJsText}}]})[0].json;
    assert.equal(pdfJsParsed.ok,true,"PDF.js native text must not be marked untrained");
    assert.equal(pdfJsParsed.checks_passed,18);
    assert.equal(pdfJsParsed.premium_components.digital_signature_date,null);
    const pdfJsEnvelope=returnWeb(
      {first:()=>({json:pdfJsParsed})},
      () => ({first:()=>({json:{intake_id:IDs.intakeId,document_id:IDs.documentId,request_id:IDs.requestId}})}),
    )[0].json;
    assert(pdfJsEnvelope.warnings.includes("tata_aig_signature_date_not_in_native_text"));
    assert.equal(validateTataAigN8nResponse(pdfJsEnvelope,IDs).checksPassed,18);
    // Missing signing metadata must never authorize an inconsistent receipt.
    const invalidReceipt=pdfJsText.replace(/Receipt Date[^\n]*/,
      "Receipt Date 01/01/2000");
    const invalidParsed=parse({all:()=>[{json:{text:invalidReceipt}}]})[0].json;
    assert.equal(invalidParsed.checks.receipt_date_document_consistent,false);
    assert.equal(invalidParsed.ok,false);
  }
  // Tamper financial, classification and registration evidence and verify rejection.
  const bad=structuredClone(normalized);
  bad.premium_components.gross_premium+=100;
  assert.throws(()=>validateTataAigN8nResponse(bad,IDs),/n8n_premium_reconciliation_failed/);
  const wrong=structuredClone(normalized);
  wrong.fields.find(f=>f.key==="vehicle_class").value=tw?"PCP":"TWP";
  assert.throws(()=>validateTataAigN8nResponse(wrong,IDs),/n8n_tata_aig_vehicle_or_policy_invalid/);
  if(tw){
    const unregistered=structuredClone(normalized);
    unregistered.fields.push({key:"vehicle_registration_number",label:"Registration number",
      value:"MP00AB0001",confidence:null,page:2,evidence:"faked"});
    assert.throws(()=>validateTataAigN8nResponse(unregistered,IDs),/n8n_tata_aig_registration_invalid/);
  }
}
console.log("Six anonymized real-layout Tata AIG two-wheeler/car contract and onboarding regressions: passed");
