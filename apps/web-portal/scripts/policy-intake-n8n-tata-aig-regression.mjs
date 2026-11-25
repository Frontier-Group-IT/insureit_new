import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { validateTataAigN8nResponse } from "../lib/policy-intake-n8n-validation.ts";
import { mapVerifiedN8nMotorPremium } from "../lib/policy-n8n-onboarding-premium.ts";
import { buildPolicyOcrOnboardingUpdate } from "../lib/policy-ocr-onboarding-apply.ts";
import { selectVerifiedN8nInsuredDraftIdentity } from "../lib/policy-n8n-onboarding-insured.ts";

const IDS={intakeId:"00000000-0000-4000-8000-000000000001",documentId:"00000000-0000-4000-8000-000000000002",requestId:"00000000-0000-4000-8000-000000000003"};
for(const parserId of [
  "tata_aig_private_car_liability_only_n8n_native_pdf",
  "tata_aig_private_car_three_year_tp_n8n_native_pdf",
]){
  const verifiedName=selectVerifiedN8nInsuredDraftIdentity([
    {key:"insured_name",value:"Mr SANKALP BHARADWAJ",page:1,evidence:"Tata AIG Liability Only Policy Schedule"},
  ],null,parserId);
  assert.equal(verifiedName.name,"Mr SANKALP BHARADWAJ");
  assert.equal(verifiedName.source,"verified_pdf");
  assert.equal(verifiedName.matchedCustomerId,null,"OCR name must not auto-link a customer");
  const untrusted=selectVerifiedN8nInsuredDraftIdentity([
    {key:"insured_name",value:"Mr SANKALP BHARADWAJ",page:1,evidence:"unverified OCR"},
  ],null,parserId);
  assert.equal(untrusted.name,"","Unverified labels must not populate the canonical name");
}

const read=name=>JSON.parse(fs.readFileSync(fileURLToPath(new URL(`./fixtures/tata-aig-n8n-${name}-synthetic.json`,import.meta.url)),"utf8"));
const copy=v=>structuredClone(v);
const get=(fields,key)=>fields.find(field=>field.key===key)?.value??"";
const invalid=(base,update,expected)=>{const changed=copy(base);update(changed);assert.throws(()=>validateTataAigN8nResponse(changed,IDS),new RegExp(expected));};
// A true standalone OD schedule need not repeat an existing TP policy's dates.
// Preserve older SAOD references if both dates are present, but reject partial dates.
const saodWithoutTp=read("saod");
saodWithoutTp.fields=saodWithoutTp.fields.filter(f=>!["third_party_start_date","third_party_end_date"].includes(f.key));
assert.equal(validateTataAigN8nResponse(saodWithoutTp,IDS).ok,true,
  "SAOD review may omit TP dates because standalone OD issues no new TP cover");
invalid(saodWithoutTp, v=>v.fields.push(
  {key:"third_party_start_date",label:"TP start",value:"2025-11-30",confidence:null,page:null,evidence:"Test policy"}
), "n8n_coverage_dates_invalid");

// Regression from live Tata AIG Package intake PIR-261120-766C17:
// native PDF verified DIESEL, but the website previously hard-coded PETROL.
const packageDiesel=read("package");
packageDiesel.fields.find(field=>field.key==="vehicle_fuel_type").value="DIESEL";
// Regression from real Tata AIG Package CNG policy (premium amounts only).
// Page 5 prints IMT25 kit OD ₹137.94 and kit TP ₹60 separately.
// They must NOT be silently omitted or relabelled as base TP/OD.
const cngPolicy=copy(packageDiesel);
const cng={basicOd:2758.85,kitOd:137.94,ncb:724.20,od:2172.59,
  addons:[3601.63,135,315,1160.52,0],addonTotal:5212.15,
  basicTp:3416,kitTp:60,cpa:375,passenger:250,paid:50,liability:4151,
  net:11535.74,printedNet:11536,tax:2076,gross:13612};
const cm=cngPolicy.premium_components;
Object.assign(cm,{
  basic_od_premium:cng.basicOd,cng_kit_od_premium:cng.kitOd,
  ncb_deduction:cng.ncb,post_ncb_od_premium:cng.od,
  od_addons:cng.addons.map((amount,i)=>({name:["Depreciation Reimbursement",
    "Loss of personal belongings","Key Replacement","Consumable expenses",
    "Repair of Glass Rubber and Plastic Parts"][i],code:["TA01","TA09","TA15","TA18","TA08"][i],amount})),
  addon_subtotal:cng.addonTotal,basic_tp_premium:cng.basicTp,
  cng_kit_tp_premium:cng.kitTp,owner_driver_cpa:cng.cpa,
  passenger_pa:cng.passenger,paid_driver_liability:cng.paid,
  roadside_assistance:0,total_liability_premium:cng.liability,
  component_net_premium:cng.net,printed_net_premium:cng.printedNet,
  printed_total_tax:cng.tax,gross_premium:cng.gross,
});
for(const [key,value] of Object.entries({
  vehicle_fuel_type:"CNG",od_premium:"2172.59",
  add_on_premium:"5212.15",tp_premium:"3776",cpa_premium:"375"
}))cngPolicy.fields.find(f=>f.key===key).value=value;
const checkedCng=validateTataAigN8nResponse(cngPolicy,IDS);
assert.equal(checkedCng.ok,true,"Printed CNG policy must pass strict 18-check portal reconciliation");
assert.equal(checkedCng.premium.tataAig.cngKitOd,137.94);
assert.equal(checkedCng.premium.tataAig.cngKitTp,60);
assert.deepEqual(mapVerifiedN8nMotorPremium(checkedCng.premium),{
  od:"2172.59",addOnPremium:"5212.15",tp:"3776",cpa:"375",cpaOpted:"Yes",
});
invalid(cngPolicy,x=>{delete x.premium_components.cng_kit_od_premium;},
  "n8n_premium_reconciliation_failed");
invalid(cngPolicy,x=>{delete x.premium_components.cng_kit_tp_premium;},
  "n8n_premium_reconciliation_failed");
invalid(cngPolicy,x=>{x.premium_components.cng_kit_tp_premium=0;},
  "n8n_premium_reconciliation_failed");
invalid(cngPolicy,x=>{x.fields.find(f=>f.key==="tp_premium").value="3716";},
  "n8n_premium_reconciliation_failed");
invalid(cngPolicy,x=>{x.fields.find(f=>f.key==="vehicle_fuel_type").value="PETROL";},
  "n8n_premium_reconciliation_failed");

const verifiedDiesel=validateTataAigN8nResponse(packageDiesel,IDS);
assert.equal(verifiedDiesel.ok,true,"Diesel Tata AIG Package must pass after 18 signed-source checks");
assert.equal(get(verifiedDiesel.fields,"vehicle_fuel_type"),"DIESEL");
for(const permitted of ["CNG","LPG","ELECTRIC"]){
  const fuelVariant=copy(permitted==="ELECTRIC"?packageDiesel:cngPolicy);
  fuelVariant.fields.find(field=>field.key==="vehicle_fuel_type").value=permitted;
  assert.equal(validateTataAigN8nResponse(fuelVariant,IDS).ok,true,"Supported printed fuel: "+permitted);
}
invalid(packageDiesel,x=>{
  x.fields.find(field=>field.key==="vehicle_fuel_type").value="KEROSENE";
},"n8n_tata_aig_vehicle_or_policy_invalid");
// Regression for the three reported Tata AIG Package intakes (anonymized):
// the native parser passes 18/18 for WB/Kolkata, HR/Panchkula and DL/Delhi,
// but the older portal bridge still restricted RTO state to HR/DL and rejected
// WB or unlisted cities. RTO location is independent OPTIONAL PDF enrichment.
const withVehicle=(overrides={})=>{
  const doc=copy(packageDiesel);
  const fields=new Map(doc.fields.map(f=>[f.key,f]));
  for(const [key,value] of Object.entries(overrides)){
    if(value===null) doc.fields=doc.fields.filter(f=>f.key!==key);
    else if(fields.has(key))fields.get(key).value=value;
    else doc.fields.push({key,label:key,value,confidence:null,page:1,evidence:"Synthetic printed vehicle schedule"});
  }
  return doc;
};
const variants=[
  ["WB Kolkata",{"vehicle_registration_number":"WB08H0751","vehicle_rto_name":"KOLKATA","vehicle_rto_state":"WEST BENGAL"}],
  ["HR Panchkula",{"vehicle_registration_number":"HR03AB1234","vehicle_rto_name":"PANCHKULA","vehicle_rto_state":"HARYANA"}],
  ["DL Delhi",{"vehicle_registration_number":"DL04AB1234","vehicle_rto_name":"DELHI","vehicle_rto_state":"DELHI"}],
  ["Rajasthan Jaipur",{"vehicle_registration_number":"RJ14AB1234","vehicle_rto_name":"JAIPUR","vehicle_rto_state":null}],
  ["city only",{"vehicle_registration_number":"WB08H0751","vehicle_rto_name":"KOLKATA","vehicle_rto_state":null}],
  ["state only",{"vehicle_registration_number":"WB08H0751","vehicle_rto_name":null,"vehicle_rto_state":"WEST BENGAL"}],
  ["both absent",{"vehicle_registration_number":"WB08H0751","vehicle_rto_name":null,"vehicle_rto_state":null}],
];
for(const [label,fields] of variants){
  const verified=validateTataAigN8nResponse(withVehicle(fields),IDS);
  assert.equal(verified.ok,true,label+" should not fail for RTO geography");
  assert.equal(verified.checksPassed,18);
}
invalid(withVehicle({"vehicle_registration_number":"WB08H0751","vehicle_rto_state":"WEST BENGAL"}),x=>{
  x.fields.find(f=>f.key==="vehicle_rto_state").value="HARYANA";
},"n8n_tata_aig_registration_invalid");
invalid(withVehicle({"vehicle_registration_number":"WB08H0751","vehicle_rto_state":null}),x=>{
  x.fields.find(f=>f.key==="vehicle_registration_number").value="WB08";
},"n8n_tata_aig_registration_invalid");

// The previously held Tata AIG policies have a verified, PDF-printed
// receipt day but no separate Policy Issue Date label. Under the approved
// insurer-specific mapping, retain source evidence and verify receipt match.
const receiptBased=copy(packageDiesel);
receiptBased.premium_components.receipt_date="2026-11-25";
const receiptDay=receiptBased.premium_components.receipt_date;
assert.match(receiptDay,/^20\d{2}-\d{2}-\d{2}$/);
receiptBased.fields.push({
 key:"policy_issuance_date",label:"Issue Date (from printed receipt)",
 value:receiptDay,confidence:null,page:null,
 evidence:"Tata AIG printed Receipt Date (approved issuance rule)",
});
receiptBased.warnings=receiptBased.warnings.filter(w=>
 w!=="tata_aig_issuance_date_unverified" &&w!=="tata_aig_signature_date_not_in_native_text");
receiptBased.warnings.push("tata_aig_receipt_date_as_issuance");
const verifiedReceipt=validateTataAigN8nResponse(receiptBased,IDS);
assert.equal(get(verifiedReceipt.fields,"policy_issuance_date"),receiptDay);
invalid(receiptBased,x=>{
 x.fields.find(f=>f.key==="policy_issuance_date").value="2026-11-24";
},"n8n_tata_aig_printed_issue_invalid");
invalid(receiptBased,x=>{
 x.fields.find(f=>f.key==="policy_issuance_date").evidence="Unverified receipt";
},"n8n_tata_aig_printed_issue_invalid");
invalid(receiptBased,x=>{
 x.warnings=x.warnings.filter(w=>w!=="tata_aig_receipt_date_as_issuance");
},"n8n_tata_aig_warning_invalid");
const explicitPrinted=copy(receiptBased);
explicitPrinted.fields.find(f=>f.key==="policy_issuance_date").value="2026-11-18";
explicitPrinted.fields.find(f=>f.key==="policy_issuance_date").label="Policy Issue Date (printed)";
explicitPrinted.fields.find(f=>f.key==="policy_issuance_date").evidence=
 "Printed Policy Issue Date / Date of Issue on current policy";
explicitPrinted.warnings=explicitPrinted.warnings.filter(w=>w!=="tata_aig_receipt_date_as_issuance");
assert.equal(get(validateTataAigN8nResponse(explicitPrinted,IDS).fields,
 "policy_issuance_date"),"2026-11-18",
 "An unambiguous explicit Policy Issue Date must outrank a different receipt day");

const combos=[
  {name:"saod",product:"Stand-Alone Own Damage",registrationMode:"registered",gross:9178},
  {name:"package",product:"Package",registrationMode:"registered",gross:23505},
  {name:"bundled",product:"Bundled",registrationMode:"unregistered",gross:24145},
];
for(const entry of combos){
  const raw=read(entry.name);
  const result=validateTataAigN8nResponse(raw,IDS);
  assert.equal(result.ok,true);
  assert.equal(result.checksPassed,18);
  assert.equal(get(result.fields,"policy_product"),entry.product);
  assert.equal(get(result.fields,"vehicle_registration_status"),entry.registrationMode);
  assert.equal(result.premium.gross,entry.gross);
  assert.equal(result.warnings.includes("tata_aig_issuance_date_unverified"),true);
  assert.equal(result.fields.some(field=>field.key==="policy_issuance_date"),false);
  const premium=mapVerifiedN8nMotorPremium(result.premium);
  assert.ok(Math.abs(Number(premium.od)+Number(premium.addOnPremium)+Number(premium.tp)+Number(premium.cpa)-result.premium.net)<0.05);
  assert.equal(premium.cpaOpted,result.premium.cpa>0?"Yes":"No");
  if(entry.name==="saod"){
    assert.equal(Number(premium.tp),0,"SAOD may not charge current TP");
    assert.ok(Number(premium.addOnPremium)>result.premium.odAddons.reduce((a,b)=>a+b.amount,0),"Roadside assistance is in SAOD add-ons");
  } else {
    assert.ok(Number(premium.tp)>result.premium.basicTp,"Include non-owner liability in TP, not CPA");
  }

  const form=buildPolicyOcrOnboardingUpdate({
    mode:"create",registrationMode:"registered",rcVerified:false,
    manufacturers:["Honda","Volkswagen"],
    insurers:[{value:"tata",label:"Tata AIG General Insurance Company Limited"}],
    current:{registrationNo:"",insuredName:"",phoneNo:"",vehicleClass:"",make:"",model:"",fuelType:"",manufacturingYear:"",capacity:"",chassisNo:"",engineNo:"",rtoState:"",rtoName:"",policyProduct:"",idv:"",od:"",tp:"",cpa:"",policyNo:"",insurerId:"",validFrom:"",validUpto:"",addOnPremium:"",tpValidUpto:"",cpaValidUpto:""},
    fields:result.fields, 
  });
  assert.equal(form.registrationMode,entry.registrationMode);
  assert.equal(form.next.vehicleClass,"PCP");
  assert.equal(form.next.insurerId,"tata");
  assert.equal(form.next.policyProduct,entry.name==="saod"?"SAOD":entry.product);
  assert.equal(form.next.registrationNo,entry.registrationMode==="registered"?get(raw.fields,"vehicle_registration_number"):"");
  assert.equal(form.next.addOnPremium,get(raw.fields,"add_on_premium"));
  assert.equal(form.next.tpValidUpto,get(raw.fields,"third_party_end_date"));
  const identity=selectVerifiedN8nInsuredDraftIdentity(result.fields,null);
  assert.ok(identity.name,"Page-one verified insured name should appear in review draft");
  assert.equal(identity.matchedCustomerId,null,"OCR must not link a customer automatically");
  const conflict=selectVerifiedN8nInsuredDraftIdentity(result.fields,{id:"synthetic-customer-id",name:"DIFFERENT CUSTOMER"});
  assert.equal(conflict.matchedCustomerId,null);
  assert.equal(conflict.needsManualReview,true);

  invalid(raw,x=>{x.checks.supported_layout_verified=false;},"n8n_financial_validation_failed");
  invalid(raw,x=>{x.ok=false;},"n8n_review_required");
  invalid(raw,x=>{x.request_id=IDS.documentId;},"n8n_request_identity_mismatch");
  invalid(raw,x=>{x.fields.find(f=>f.key==="insurer_name").value="Other insurer";},"n8n_tata_aig_vehicle_or_policy_invalid");
  invalid(raw,x=>{x.premium_components.basic_tp_premium+=100;},"n8n_premium_reconciliation_failed");
  invalid(raw,x=>{x.premium_components.gross_premium+=100;},"n8n_premium_reconciliation_failed");
  invalid(raw,x=>{x.fields.push({key:"policy_issuance_date",label:"Issued",value:"2026-11-19",confidence:null,page:1,evidence:"Receipt date"});},"n8n_tata_aig_printed_issue_invalid");
  if(entry.registrationMode==="unregistered"){
    invalid(raw,x=>{x.fields.push({key:"vehicle_registration_number",label:"Registration No",value:"HR00AB0001",confidence:null,page:4,evidence:"fake"});},"n8n_tata_aig_registration_invalid");
  } else {
    invalid(raw,x=>{x.fields.find(f=>f.key==="vehicle_registration_number").value="NEW";},"n8n_tata_aig_registration_invalid");
  }
}
const eligibility=fs.readFileSync(fileURLToPath(new URL("../lib/policy-intake-n8n-layout-eligibility.ts",import.meta.url)),"utf8");
const bridge=fs.readFileSync(fileURLToPath(new URL("../lib/policy-intake-n8n-bridge.ts",import.meta.url)),"utf8");
const panel=fs.readFileSync(fileURLToPath(new URL("../components/policy-ocr-import-panel.tsx",import.meta.url)),"utf8");
const actions=fs.readFileSync(fileURLToPath(new URL("../app/policy-intakes/handoff-actions.ts",import.meta.url)),"utf8");
assert.match(eligibility,/INSUREIT_TATA_AIG_N8N_ENABLED/);
assert.match(eligibility,/Thank\\s\+you\\s\+for\\s\+choosing\\s\+TATA\\s\+AIG\\s\+as\\s\+your\\s\+Insurer/);
assert.match(bridge,/x-insureit-policy-intake-secret/);
assert.match(bridge,/SIGNED_OBJECT_PREFIX/);
assert.match(panel,/cpa_opted/);
assert.match(actions,/trainedN8nParserProfile\(parsed\.preview\.parserId\)\?\.checks/);
assert.match(actions,/customer_mobile/);
assert.match(actions,/lead_source_name/);
assert.match(actions,/rmName/);
console.log("Tata AIG n8n private-car 3-layout + negative validation + onboarding draft regression: passed");
