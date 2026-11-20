import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { validateTataAigN8nResponse } from "../lib/policy-intake-n8n-validation.ts";
import { mapVerifiedN8nMotorPremium } from "../lib/policy-n8n-onboarding-premium.ts";
import { buildPolicyOcrOnboardingUpdate } from "../lib/policy-ocr-onboarding-apply.ts";
import { selectVerifiedN8nInsuredDraftIdentity } from "../lib/policy-n8n-onboarding-insured.ts";

const IDS={intakeId:"00000000-0000-4000-8000-000000000001",documentId:"00000000-0000-4000-8000-000000000002",requestId:"00000000-0000-4000-8000-000000000003"};
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
const verifiedDiesel=validateTataAigN8nResponse(packageDiesel,IDS);
assert.equal(verifiedDiesel.ok,true,"Diesel Tata AIG Package must pass after 18 signed-source checks");
assert.equal(get(verifiedDiesel.fields,"vehicle_fuel_type"),"DIESEL");
for(const permitted of ["CNG","LPG","ELECTRIC"]){
  const fuelVariant=copy(packageDiesel);
  fuelVariant.fields.find(field=>field.key==="vehicle_fuel_type").value=permitted;
  assert.equal(validateTataAigN8nResponse(fuelVariant,IDS).ok,true,"Supported printed fuel: "+permitted);
}
invalid(packageDiesel,x=>{
  x.fields.find(field=>field.key==="vehicle_fuel_type").value="KEROSENE";
},"n8n_tata_aig_vehicle_or_policy_invalid");
invalid(read("bundled"),x=>{
  x.fields.find(field=>field.key==="vehicle_fuel_type").value="DIESEL";
},"n8n_tata_aig_vehicle_or_policy_invalid");

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
  invalid(raw,x=>{x.fields.push({key:"policy_issuance_date",label:"Issued",value:"2026-11-19",confidence:null,page:1,evidence:"Receipt date"});},"n8n_field_shape_invalid|n8n_required_field_missing");
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
assert.match(actions,/isTata\?18:13/);
assert.match(actions,/customer_mobile/);
assert.match(actions,/lead_source_name/);
assert.match(actions,/rmName/);
console.log("Tata AIG n8n private-car 3-layout + negative validation + onboarding draft regression: passed");
