import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const file=(p)=>readFileSync(new URL(p,import.meta.url),"utf8");
const signed=file("../lib/policy-nontata-commercial-n8n.ts");
const preview=file("../lib/policy-intake-semi-auto-n8n.ts");
const queue=file("../lib/ai-policy-onboarding-queue-server.ts");
const eligibility=file("../lib/ai-policy-onboarding-eligibility.ts");
const component=file("../components/development/semi-auto-policy-workspace.tsx");
const actions=file("../app/development/ai-policy-onboarding/actions.ts");
const oldBridge=file("../lib/policy-intake-n8n-bridge.ts");
const handoff=file("../app/policy-intakes/handoff-actions.ts");
const premiumHelper=file("../lib/policy-n8n-onboarding-premium.ts");
const insuredHelper=file("../lib/policy-n8n-onboarding-insured.ts");
const enrichmentHelper=file("../lib/policy-n8n-onboarding-enrichment.ts");
// An NIA RTO prefix is an unregistered vehicle, never a blocking incomplete
// registered plate. The source prefix must not fill registrationNo.
assert.match(signed,/isNewIndiaUnregistered/);
assert.match(signed,/fields\.filter\(\(f\) => f\.key !== "vehicle_registration_number"\)/);
assert.ok(signed.includes("fields: enrichIffcoCertifiedMachineFamily(")
  &&signed.includes("isNewIndiaUnregistered || isUnitedNewVehicle")
  &&signed.includes("const isIffcoNewVehicle ="),
  "IFFCO MP/NEW reference must remain in verified evidence, not canonical registration; other insurer references stay filtered");
assert.ok(handoff.includes('registrationMode:verified?.fields.some')
  &&handoff.includes('["unregistered","registration_pending"].includes(field.value)'),
  "Canonical unregistered form must keep registrationNo empty even with source MP/NEW evidence");
assert.match(signed,/vehicle_registration_status"\) === "unregistered"/);
assert.ok(handoff.includes('["unregistered","registration_pending"].includes(field.value)'),
  "Both explicit unregistered and registration_pending map to unregistered; a registered plate never does");
for (const id of ["go_digit_cv_native_pdf","new_india_cv_native_pdf","iffco_tokio_cv_native_pdf"]) {
  assert.ok(eligibility.includes(id), "AI queue must recognize trained parser "+id);
  assert.ok(signed.includes(id), "The signed-source path must retain exact parser identity "+id);
}
// Split-insurer n8n layout routing: do not send IFFCO new-vehicle internal
// references into canonical registration as real number plates.
assert.ok(signed.includes('"united_india_gcv_native_pdf"')
  && signed.includes('"oriental_gccv_native_pdf"')
  && signed.includes('"stamp_charge_reconciled"'),
  "New insurer identifiers must be explicitly recognized with strict financial check sets");
assert.ok(signed.includes('isIffcoNewVehicle')
  && signed.includes('isUnitedNewVehicle')
  && signed.includes('/^MP\\/NEW\\/\\d{3,6}$/i')
  && signed.includes('printedPlate === "NEW"'),
  "IFFCO and United new-vehicle internal numbers must be classified as unregistered");
assert.ok(signed.includes("isIffcoNewVehicle || isUnitedNewVehicle")
  && signed.includes('vehicle_manufacturing_year'),
  "Only printed make/year evidence may grant unregistered classification");
assert.ok(!signed.includes("auto_finalize_allowed:true"),
  "New insurer recognition must preserve review-only extraction safety");

// Validate the new insurer-independent adapter and keep booking gated.
// A parser family is evidence-only, never permission to book.
const {trainedN8nParserProfile}=await import("../lib/ai-policy-onboarding-eligibility.ts");
assert.deepEqual(trainedN8nParserProfile("united_india_gcv_native_pdf"),{checks:18,family:"commercial"});
assert.deepEqual(trainedN8nParserProfile("oriental_gccv_native_pdf"),{checks:17,family:"commercial"});
assert.deepEqual(trainedN8nParserProfile("go_digit_cv_native_pdf"),{checks:18,family:"commercial"});
assert.deepEqual(trainedN8nParserProfile("new_india_cv_native_pdf"),{checks:16,family:"commercial"});
assert.ok(insuredHelper.includes('"united_india_gcv_native_pdf"')
  && insuredHelper.includes('"oriental_gccv_native_pdf"'),
  "Only fixed native PDF evidence for the new insurers may fill an editable name");
assert.ok(handoff.includes('"united_india_gcv_native_pdf","oriental_gccv_native_pdf"'),
  "The two new insurer types must reach review-only handoff without bypassing canonical checks");
assert.match(preview,/tryReadNonTataCommercialSignedPolicy/);
assert.ok(preview.indexOf("tryReadNonTataCommercialSignedPolicy") <
          preview.indexOf("requestN8nPolicyIntakeBySignedSource({"),
 "The trained non-Tata candidate must be tried before the ICICI/Tata parser");
assert.match(signed,/TRUSTED_STORAGE_ORIGIN|ilzhsfqqjyppzzvfscmh\.supabase\.co/);
assert.match(signed,/content-length/);
assert.match(signed,/MAX_BYTES/);
assert.match(signed,/redirect: "error"/);
assert.match(signed,/checksPassed: expected\.filter/);
assert.match(signed,/Math\.abs\(cents\(od \+ tp\) - cents\(net\)\)/);
assert.match(signed,/Math\.abs\(cents\(net \+ gst\) - cents\(gross\)\)/);
assert.match(preview,/commercialPremium = commercial\.premium/);
assert.match(preview,/premium: null/);
assert.match(preview,/!commercialPremium &&/);
assert.match(component,/Verified printed commercial premium/);
assert.match(component,/n8nResult\.preview\.commercialPremium\.gross/);
assert.match(eligibility,/profile\.family==="commercial"/);
assert.match(queue,/ICICI_N8N_IDS\.has\(extraction\.preview\.parserId\)/);
assert.match(actions,/const commercial=extracted\.preview\.commercialPremium/);
assert.match(actions,/mapVerifiedGoDigitCommercialPremium\(commercial\)/);
assert.ok(actions.includes('extracted.preview.parserId==="go_digit_cv_native_pdf"')
  && actions.includes('assessStandardCommercialDirectConversion({'),
  "Go Digit premium mapping stays insurer-scoped; other commercial parsers need their own strict eligibility contract");
assert.match(actions,/!hasVerifiedN8nParserEvidence\(extracted\.preview\.parserId,/,
  "Confirmed bulk conversion requires exact trained insurer checks, including Tata 18/18");
assert.match(oldBridge,/insureit-policy-intake-icici-v1/);
assert.doesNotMatch(signed,/supabaseAdmin|\.from\("policies"\)/);
assert.doesNotMatch(preview,/auto_finalize_allowed:\s*true/);
assert.ok(handoff.includes("selectVerifiedN8nInsuredDraftIdentity(verified.fields,masterIdentity,verified.parserId)"));
assert.ok(handoff.includes("enrichVerifiedN8nOnboardingFields(verified.fields,verified.parserId)"));
assert.ok(insuredHelper.includes('field.page === null && field.evidence === "Native PDF policy schedule"'));
assert.ok(enrichmentHelper.includes('parserId === "go_digit_cv_native_pdf"'));
assert.ok(enrichmentHelper.includes('Number(get("od_premium")) > 0 && Number(get("tp_premium")) > 0'));
assert.ok(actions.includes('mapVerifiedGoDigitCommercialPremium(commercial)'));
assert.ok(actions.includes('key==="vehicle_manufacturing_year"'));
assert.ok(handoff.includes('const goDigitVerifiedFill = Boolean(commercial) && fillEmptyFields'));
assert.ok(premiumHelper.includes("mapVerifiedGoDigitCommercialPremium"));
const {mapVerifiedGoDigitCommercialPremium}=await import("../lib/policy-n8n-onboarding-premium.ts");
const {mapVerifiedIffcoCommercialPremium}=await import("../lib/policy-n8n-onboarding-premium.ts");
const iffcoVerified=[
  {od:4608,tp:7697,net:12305,gst:2214.90,gross:14519.90,cpa:330},
  {od:20129,tp:7367,net:27496,gst:4949.28,gross:32445.28,cpa:0},
  {od:4518,tp:7697,net:12215,gst:2198.70,gross:14413.70,cpa:330},
  {od:5565,tp:7367,net:12932,gst:2327.76,gross:15259.76,cpa:0},
  {od:4132,tp:7697,net:11829,gst:2129.22,gross:13958.22,cpa:330},
  {od:4762,tp:7367,net:12129,gst:2183.22,gross:14312.22,cpa:0},
  {od:5847,tp:7367,net:13214,gst:2378.52,gross:15592.52,cpa:0},
];
for(const data of iffcoVerified){
  const p=mapVerifiedIffcoCommercialPremium(data,data.cpa);
  assert.equal(p.cpaOpted,data.cpa>0?"Yes":"No");
  assert.equal(Math.round((Number(p.od)+Number(p.tp)+Number(p.cpa))*100),
    Math.round(data.net*100),"IFFCO canonical net must equal independently printed PDF net");
  assert.equal(Math.round(Number(p.tp)*100),
    Math.round((data.tp-data.cpa)*100),"IFFCO printed Net(B) must not be double-counted");
}
assert.throws(()=>mapVerifiedIffcoCommercialPremium(iffcoVerified[0],9000),
  /n8n_iffco_cpa_split_unreconciled/);
assert.throws(()=>mapVerifiedIffcoCommercialPremium({...iffcoVerified[0],gross:15000},330),
  /n8n_iffco_cpa_split_unreconciled/);
assert.ok(handoff.includes("mapVerifiedIffcoCommercialPremium")
  && handoff.includes('iffcoCpaFields.length!==1'),
  "IFFCO review draft must require printed CPA evidence and strict TP/CPA mapping");

assert.deepEqual(mapVerifiedGoDigitCommercialPremium({od:2415.46,tp:7647,net:10062.46,gst:1811.24,gross:11873.70}),
  {od:"2415.46",addOnPremium:"0",tp:"7647",cpa:"0",cpaOpted:"No"});
assert.throws(()=>mapVerifiedGoDigitCommercialPremium({od:2415.46,tp:7647,net:10062.46,gst:1811.24,gross:12000}),
  /n8n_motor_premium_handoff_unreconciled/);
assert.ok(handoff.includes("const standardCommercialVerifiedFill=Boolean(commercial)&&fillEmptyFields")
  &&handoff.includes("assessStandardCommercialDirectConversion({"),
  "Other commercial parsers must use a strict direct-booking eligibility contract");
assert.ok(handoff.includes("const iffcoVerifiedFill = Boolean(commercial) && fillEmptyFields")
  &&handoff.includes("!iffcoVerifiedFill && !standardCommercialVerifiedFill")
  &&handoff.includes("assessIffcoAutoOnboarding({"),
  "Certified IFFCO must be allowed through direct handoff without manual reparse");
assert.ok(handoff.includes('state:eligibleForVerifiedConversion?"verified":"exception"')
  && handoff.includes("autoEligibleGoDigit||iffcoReview.eligible"),
  "Existing Go Digit eligibility is preserved while narrowly certified IFFCO is added");
assert.ok(handoff.includes('go_digit_missing_verified_manufacturing_year'));
assert.ok(component.includes('go_digit_missing_verified_manufacturing_year'));
// Run the actual helpers on verified commercial evidence, not a copied algorithm.
const {selectVerifiedN8nInsuredDraftIdentity}=await import("../lib/policy-n8n-onboarding-insured.ts");
const {enrichVerifiedN8nOnboardingFields}=await import("../lib/policy-n8n-onboarding-enrichment.ts");
const rawName=[{key:"insured_name",value:"MR BASANT SINGH KUSHRAM",page:null,evidence:"Native PDF policy schedule"}];
const proposed=selectVerifiedN8nInsuredDraftIdentity(rawName,null,"go_digit_cv_native_pdf");
assert.deepEqual([proposed.name,proposed.matchedCustomerId,proposed.needsManualReview],["MR BASANT SINGH KUSHRAM",null,true]);
assert.equal(selectVerifiedN8nInsuredDraftIdentity(rawName,null).name,"","ICICI/Tata provenance must not change");
assert.equal(selectVerifiedN8nInsuredDraftIdentity(rawName,null,"unexpected_parser").name,"","Unknown parser fails closed");
assert.equal(selectVerifiedN8nInsuredDraftIdentity(rawName,[{id:"x",name:"UNRELATED"}][0],"go_digit_cv_native_pdf").matchedCustomerId,null);
assert.equal(selectVerifiedN8nInsuredDraftIdentity([], {id:"x",name:"UNRELATED"},"go_digit_cv_native_pdf").name,"","Do not fallback to a master when verified commercial PDF name is missing");
const digitFields=[{key:"policy_product",label:"Policy product",value:"Digit Commercial Vehicle Insurance"},
{key:"vehicle_class",label:"Class",value:"Commercial Vehicle - Miscellaneous Class D"},
{key:"od_premium",label:"OD",value:"2415.46"}, {key:"tp_premium",label:"TP",value:"7647"}];
assert.equal(enrichVerifiedN8nOnboardingFields(digitFields,"go_digit_cv_native_pdf").find(f=>f.key==="policy_product")?.value,"Package");
assert.equal(enrichVerifiedN8nOnboardingFields(digitFields,"iffco_tokio_cv_native_pdf").find(f=>f.key==="policy_product")?.value,"Digit Commercial Vehicle Insurance");
assert.equal(enrichVerifiedN8nOnboardingFields(digitFields).find(f=>f.key==="policy_product")?.value,"Digit Commercial Vehicle Insurance");
// NIA's printed mixed-rate GST cannot be derived from the generic 18%/5%
// estimator, so the onboarding view uses the saved source only after
// verifying the same current PDF queue, policy ID and OD+TP reconciliation.
const {readVerifiedNiaPrintedPremiumReference}=await import("../lib/policy-n8n-onboarding-premium.ts");
const niaNotes="Policy Intake x — independently validated commercial-motor PDF (new_india_cv_native_pdf). REVIEW ONLY; no policy or customer was booked. Printed OD 40622, TP including liabilities 44342, Net 84964, GST 9542, Gross 94506. Owner-driver PA and paid-driver liabilities are retained inside printed TP.";
const niaBase={
  parserId:"new_india_cv_native_pdf",checksPassed:16,currentPdfVerified:true,
  remarks:niaNotes,policyNumber:"31280031260300002807",
  fields:[{key:"policy_number",value:"31280031260300002807"},
    {key:"od_premium",value:"40622"},{key:"tp_premium",value:"44342"}],
};
const pdfTotals={od:40622,tp:44342,net:84964,gst:9542,gross:94506};
assert.deepEqual(readVerifiedNiaPrintedPremiumReference(niaBase),pdfTotals);
assert.equal(readVerifiedNiaPrintedPremiumReference({...niaBase,parserId:"go_digit_cv_native_pdf"}),null);
assert.equal(readVerifiedNiaPrintedPremiumReference({...niaBase,checksPassed:15}),null);
assert.equal(readVerifiedNiaPrintedPremiumReference({...niaBase,currentPdfVerified:false}),null);
assert.equal(readVerifiedNiaPrintedPremiumReference({...niaBase,policyNumber:"OTHER"}),null);
assert.equal(readVerifiedNiaPrintedPremiumReference({...niaBase,
  fields:niaBase.fields.map(f=>f.key==="tp_premium"?{...f,value:"44343"}:f)}),null);
assert.equal(readVerifiedNiaPrintedPremiumReference({...niaBase,remarks:niaNotes.replace("GST 9542","GST 9530")}),null);
const niaHandoff=file("../app/policy-intakes/handoff-actions.ts");
const niaPage=file("../app/policies/new/page.tsx");
const unified=file("../components/policy-unified-form.tsx");
const shell=file("../components/policy-commercial-shell.tsx");
assert.ok(niaHandoff.includes('niaVerified')&&niaHandoff.includes("FASTag ID:"),
  "NIA stale drafts must not show FASTag ID as the registration authority");
assert.ok(niaHandoff.includes('nia_missing_registration_authority') && !niaHandoff.includes('const niaMissingCpa='));
assert.ok(niaPage.includes('readVerifiedNiaPrintedPremiumReference(')
  && niaPage.includes('queue.data.document_id===document.data.id'));
assert.ok(unified.includes('printedPremiumReference!.gst')
  && unified.includes('Math.round(od*100)===Math.round(printedPremiumReference.od*100)')
  && unified.includes('form.cpaOpted==="No"'));
assert.ok(shell.includes('printedPremiumReference={props.printedPremiumReference}'));
assert.ok(component.includes('NIA PDF verified · provisional RTO pending')
  && component.includes('Go Digit · manufacturing year unavailable'));

// Approved operational rule: only when the policy fails to print manufacture
// year, a separately printed registration year or complete registration date
// may fill the canonical manufacturing YEAR. No day/month is fabricated.
const {resolveManufacturingYearEvidence}=await import("../lib/policy-n8n-onboarding-enrichment.ts");
const registrationOnly=[
  {key:"vehicle_manufacturing_year",value:"--"},
  {key:"vehicle_registration_year",value:"2022"},
];
assert.deepEqual(resolveManufacturingYearEvidence(registrationOnly),
  {year:"2022",source:"registration_year_fallback"});
assert.deepEqual(resolveManufacturingYearEvidence([
  {key:"vehicle_manufacturing_year",value:"2021"},...registrationOnly.slice(1)]),
  {year:"2021",source:"manufacturing_year"});
assert.deepEqual(resolveManufacturingYearEvidence([{key:"vehicle_registration_date",value:"2022-08-16"}]),
  {year:"2022",source:"registration_year_fallback"});
assert.equal(resolveManufacturingYearEvidence([{key:"policy_issuance_date",value:"2026-11-19"}]).year,"");
assert.equal(resolveManufacturingYearEvidence([{key:"vehicle_registration_year",value:"2040"}]).year,"");
assert.equal(resolveManufacturingYearEvidence([{key:"vehicle_registration_year",value:"2022"},{key:"vehicle_registration_year",value:"2024"}]).year,"");
assert.equal(resolveManufacturingYearEvidence([{key:"vehicle_registration_year",value:"2022"},
  {key:"vehicle_registration_date",value:"2023-01-01"}]).year,"");
assert.equal(resolveManufacturingYearEvidence([{key:"vehicle_registration_date",value:"2022-02-30"}]).year,"");
assert.equal(resolveManufacturingYearEvidence([{key:"vehicle_registration_year",value:"2022"},
  {key:"vehicle_manufacturing_year",value:"unknown layout"}]).year,"");
const fallbackFields=[
  {key:"vehicle_registration_year",value:"2022",label:"Registration year"},
  {key:"vehicle_manufacturing_year",value:"--",label:"Manufacturing year"},
];
const enrichedFallback=enrichVerifiedN8nOnboardingFields(fallbackFields,"go_digit_cv_native_pdf");
assert.deepEqual(enrichedFallback.filter(f=>f.key==="vehicle_manufacturing_year"),
  [{key:"vehicle_manufacturing_year",label:"Manufacturing year — registration-year fallback",value:"2022"}],
  "The invalid placeholder should not be treated as manufacturing-year evidence");
const actualManufacture=enrichVerifiedN8nOnboardingFields([
  {key:"vehicle_registration_year",value:"2022",label:"Registration year"},
  {key:"vehicle_manufacturing_year",value:"2024",label:"Manufacturing year"},
],"go_digit_cv_native_pdf");
assert.equal(actualManufacture.find(f=>f.key==="vehicle_manufacturing_year")?.value,"2024");
const {buildPolicyOcrOnboardingUpdate}=await import("../lib/policy-ocr-onboarding-apply.ts");
const baseOcrState={registrationNo:"",vehicleClass:"",make:"",model:"",fuelType:"",
  manufacturingYear:"",capacity:"",chassisNo:"",engineNo:"",rtoState:"",rtoName:"",
  policyProduct:"",idv:"",od:"",tp:"",cpa:"",policyNo:"",insurerId:"",
  validFrom:"",validUpto:""};
const applyYear=(current,fields,mode="create")=>buildPolicyOcrOnboardingUpdate({
  mode,registrationMode:"registered",rcVerified:false,current,fields,
  manufacturers:[],insurers:[]});
assert.equal(applyYear(baseOcrState,[{key:"vehicle_registration_year",value:"2022",label:"Registration year"}]).next.manufacturingYear,"2022");
assert.equal(applyYear({...baseOcrState,manufacturingYear:"2021"},[{key:"vehicle_registration_year",value:"2022",label:"Registration year"}]).next.manufacturingYear,"2021");
assert.equal(applyYear(baseOcrState,[{key:"vehicle_registration_year",value:"2022",label:"Registration year"}],"edit").next.manufacturingYear,"");
assert.ok(handoff.includes("resolveManufacturingYearEvidence(verified.fields)")
  && handoff.includes("REGISTRATION_YEAR_MANUFACTURING_FALLBACK:")
  && handoff.includes('key==="vehicle_manufacturing_year" ? !digitYear?.year'));
assert.ok(actions.includes("resolveManufacturingYearEvidence(extracted.preview.fields)")
  && actions.includes('forwarded.draft.manufacturingYear!==manufacturingEvidence.year')
  && actions.includes("mapVerifiedGoDigitCommercialPremium(commercial)"));
assert.ok(eligibility.includes("resolveManufacturingYearEvidence(input.fields)"));
assert.ok(signed.includes('"vehicle_registration_year"'));
assert.ok(unified.includes("Registration-year fallback"));

// Exact current-PDF IFFCO fields must map into the existing unregistered
// MISD onboarding form, without treating MP/NEW as an official plate.
const iffcoOcrFields=[
  {key:"vehicle_registration_status",label:"Status",value:"registration_pending"},
  {key:"vehicle_class",label:"Class",value:"Commercial Vehicle - Miscellaneous Class D"},
  {key:"vehicle_make",label:"Make",value:"JCB"},
  {key:"vehicle_model",label:"Model",value:"JCB 3DX PLUS 2WD BACKHOE LOADER"},
  {key:"vehicle_fuel_type",label:"Fuel",value:"Diesel"},
  {key:"vehicle_capacity",label:"CC",value:"4765"},
  {key:"vehicle_rto_state",label:"RTO state",value:"Madhya Pradesh"},
  {key:"vehicle_rto_name",label:"Provisional city",value:"Jabalpur"},
];
const iffcoApplied=buildPolicyOcrOnboardingUpdate({
  mode:"create",registrationMode:"registered",rcVerified:false,
  current:baseOcrState,fields:iffcoOcrFields,manufacturers:["JCB"],insurers:[],
});
assert.equal(iffcoApplied.registrationMode,"unregistered");
assert.equal(iffcoApplied.next.registrationNo,"");
assert.equal(iffcoApplied.next.vehicleClass,"MISD");
for(const [key,expected] of Object.entries({
  make:"JCB",fuelType:"Diesel",capacity:"4765",rtoState:"Madhya Pradesh",
  rtoName:"Jabalpur",model:"JCB 3DX PLUS 2WD BACKHOE LOADER"})){
  assert.equal(iffcoApplied.next[key],expected,"IFFCO mapper must preserve "+key);
}
assert.ok(handoff.includes('IFFCO_PROVISIONAL_RTO_FROM_INSURED_ADDRESS:')
  && handoff.includes("IFFCO_FUEL_FROM_JCB_MODEL:")
  && handoff.includes('iffcoProvisionalRtoField')
  && handoff.includes('iffcoModelFuel'),
  "IFFCO non-PDF provenance must reach the stored policy intake draft remarks");
assert.ok(unified.includes("Provisional IFFCO policyholder address city")
  && unified.includes("Diesel inferred from the JCB 3DX Plus manufacturer model"),
  "IFFCO fallback values should be distinguished from verified PDF registration/fuel");

// Confirmed IFFCO conversion eligibility uses the same strict source
// provenance and exact printed commercial premiums as the booking handler.
const {assessIffcoAutoOnboarding}=await import("../lib/policy-iffco-auto-eligibility.ts");
const ifField=(key,value,evidence="Native PDF policy schedule")=>({key,value,evidence});
const iffcoAutoFields=[
  ifField("insured_name","KR EARTHMOVERS"),ifField("policy_number","N9394260"),
  ifField("policy_product","Commercial Vehicle Package"),
  ifField("policy_issuance_date","2026-11-16"),ifField("policy_start_date","2026-11-16"),
  ifField("policy_end_date","2027-11-15"),ifField("third_party_start_date","2026-11-16"),
  ifField("third_party_end_date","2027-11-15"),ifField("vehicle_class","Commercial Vehicle - Miscellaneous Class D"),
  ifField("vehicle_make","JCB"),ifField("vehicle_model","JCB 3DX PLUS 2WD BACKHOE LOADER"),
  ifField("vehicle_registration_status","registration_pending"),
  ifField("vehicle_registration_number","MP/NEW/5556"),
  ifField("vehicle_manufacturing_year","2026"),ifField("vehicle_chassis_number","RAJ3DXSRV03731509"),
  ifField("vehicle_engine_number","H00545556"),ifField("idv","3480000"),
  ifField("vehicle_capacity","4765","IFFCO PDF page 1: CC in insured vehicle row; not seating capacity"),
  ifField("vehicle_fuel_type","Diesel","Manufacturer-model Diesel specification (JCB 3DX Plus 2WD); NOT PDF-printed"),
  ifField("vehicle_rto_state","Madhya Pradesh","IFFCO PDF State Code 23 plus MP/NEW new vehicle reference"),
  ifField("vehicle_rto_name","Jabalpur","IFFCO policyholder address city only; registration authority is blank. PROVISIONAL until vehicle is registered."),
  ifField("cpa_premium","0"),
];
const iffcoAuto={parserId:"iffco_tokio_cv_native_pdf",checksPassed:18,
  warnings:[],fields:iffcoAutoFields,
  commercialPremium:{od:4762,tp:7367,net:12129,gst:2183.22,gross:14312.22}};
// Shared direct-conversion criteria for the other three trained commercial
// parsers. A parser-success flag alone must NEVER grant booking authority.
const {assessStandardCommercialDirectConversion}=await import("../lib/policy-commercial-direct-eligibility.ts");
const standardFields=[
  ifField("insured_name","TEST CARRIER"),ifField("policy_number","POLICY-EXAMPLE"),
  ifField("policy_issuance_date","2026-11-16"),ifField("policy_start_date","2026-11-16"),
  ifField("policy_end_date","2027-11-15"),ifField("third_party_start_date","2026-11-16"),
  ifField("third_party_end_date","2027-11-15"),ifField("insurer_name","TEST INSURER"),
  ifField("vehicle_class","Goods Carrying Vehicle"),ifField("vehicle_make","TATA"),
  ifField("vehicle_model","TRUCK"),ifField("vehicle_fuel_type","Diesel"),
  ifField("vehicle_manufacturing_year","2024"),ifField("vehicle_capacity","7500"),
  ifField("vehicle_rto_state","Madhya Pradesh"),
  ifField("vehicle_rto_name","Jabalpur","RTO authority printed in registered vehicle schedule"),
  ifField("vehicle_registration_number","MP20AB1234"),ifField("vehicle_registration_status","registered"),
  ifField("vehicle_chassis_number","CHASSIS123456"),ifField("vehicle_engine_number","ENGINE123"),
  ifField("policy_product","Goods Carrying Vehicle Package"),
  ifField("idv","1000000"),ifField("cpa_premium","0"),
];
const standardPremium={od:1000,tp:2000,net:3000,gst:540,gross:3540};
for(const [parserId,checksPassed] of [
  ["new_india_cv_native_pdf",16],["united_india_gcv_native_pdf",18],
  ["oriental_gccv_native_pdf",17],
]){
 const fixture={parserId,checksPassed,warnings:[],fields:standardFields,commercialPremium:standardPremium};
 assert.equal(assessStandardCommercialDirectConversion(fixture).eligible,true,
   parserId+" fully evidenced, zero-CPA registered package eligible");
 assert.equal(assessStandardCommercialDirectConversion({...fixture,checksPassed:checksPassed-1}).eligible,false);
 assert.equal(assessStandardCommercialDirectConversion({...fixture,fields:standardFields.filter(f=>f.key!=="vehicle_rto_name")}).eligible,false);
 assert.equal(assessStandardCommercialDirectConversion({...fixture,fields:standardFields.map(f=>f.key==="vehicle_registration_number"?{...f,value:"NEW"}:f)}).eligible,false);
 assert.equal(assessStandardCommercialDirectConversion({...fixture,fields:standardFields.map(f=>f.key==="cpa_premium"?{...f,value:"330"}:f)}).eligible,false);
 assert.equal(assessStandardCommercialDirectConversion({...fixture,commercialPremium:{...standardPremium,net:2999}}).eligible,false);
}
// Regression for the real MP/NEW IFFCO certificate N9436560, whose PDF
// identifies MP/NEW/9805 as an internal reference (never an RTO plate).
// The value is mandatory *extraction evidence* but must not become a
// canonical registrationNo. Printed CPA=330 is split out of TP=7697.
const iffcoMandlaNew={
  ...iffcoAuto,
  fields:iffcoAutoFields.map(field=>{
    if(field.key==="policy_number")return {...field,value:"N9436560"};
    if(field.key==="insured_name")return {...field,value:"SHOBHARAM TARAM"};
    if(field.key==="vehicle_registration_number")return {...field,value:"MP/NEW/9805"};
    if(field.key==="vehicle_rto_name")return {...field,value:"Mandla"};
    if(field.key==="vehicle_chassis_number")return {...field,value:"RAJ3DXSRP03674139"};
    if(field.key==="vehicle_engine_number")return {...field,value:"H00539805"};
    if(field.key==="idv")return {...field,value:"3430000"};
    if(field.key==="cpa_premium")return {...field,value:"330"};
    if(field.key==="policy_issuance_date"||field.key==="policy_start_date"||field.key==="third_party_start_date")
      return {...field,value:"2026-11-19"};
    if(field.key==="policy_end_date"||field.key==="third_party_end_date")
      return {...field,value:"2027-11-18"};
    return field;
  }),
  commercialPremium:{od:4694,tp:7697,net:12391,gst:2230.38,gross:14621.38},
};
assert.equal(assessIffcoAutoOnboarding(iffcoMandlaNew).eligible,true,
  "N9436560 MP/NEW is eligible with exact 18 checks, source RTO notes and CPA reconciliation");
assert.equal(assessIffcoAutoOnboarding({...iffcoMandlaNew,fields:iffcoMandlaNew.fields.filter(f=>
  f.key!=="vehicle_registration_number")}).eligible,false,
  "IFFCO internal reference is mandatory for evidence even though canonical registration stays empty");
assert.equal(assessIffcoAutoOnboarding({...iffcoMandlaNew,fields:iffcoMandlaNew.fields.map(f=>
  f.key==="vehicle_registration_number"?{...f,value:"NEW"}:f)}).eligible,false);
assert.equal(assessIffcoAutoOnboarding({...iffcoMandlaNew,commercialPremium:{
  ...iffcoMandlaNew.commercialPremium,net:12390}}).eligible,false);
const semiN8n=file("../lib/policy-intake-semi-auto-n8n.ts");
assert.ok(semiN8n.includes("legacyIffcoNewFingerprint")
  &&semiN8n.includes('field.key!=="vehicle_registration_number"')
  &&actions.includes("sameReviewedFingerprint")
  &&actions.includes("extracted.preview.fingerprint,true,true"),
  "An old queue MP/NEW hash can retry once with the newly verified full current-PDF evidence");
// Family-level enrichment: N9293311's original PDF prints "VMT 117 LC
// NDD COMPACTOR", and n8n emits "VMT" with no fuel. Do not grant booking
// just because extraction has passed 18/18 checks.
const {enrichIffcoCertifiedMachineFamily}=await import("../lib/policy-iffco-machine-family.ts");
const iffcoCompactorSource=[
  ...iffcoAutoFields.filter(f=>!["vehicle_make","vehicle_model","vehicle_fuel_type"].includes(f.key)),
  ifField("vehicle_make","VMT"),
  ifField("vehicle_model","VMT 117 LC NDD COMPACTOR"),
];
const enrichedCompactor=enrichIffcoCertifiedMachineFamily(
  iffcoCompactorSource,"iffco_tokio_cv_native_pdf");
assert.equal(enrichedCompactor.find(f=>f.key==="vehicle_make")?.value,"JCB");
assert.equal(enrichedCompactor.find(f=>f.key==="vehicle_fuel_type")?.value,"Diesel");
assert.equal(enrichedCompactor.find(f=>f.key==="vehicle_make")?.evidence?.startsWith("Manufacturer-model JCB VM117 NDD specification"),true);
const compactor={...iffcoAuto,fields:enrichedCompactor,commercialPremium:{
  od:5565,tp:7367,net:12932,gst:2327.76,gross:15259.76,
}};
assert.equal(assessIffcoAutoOnboarding(compactor).eligible,true,
  "IFFCO VMT 117 LC NDD family can be certified for N9293311 without a policy-number exception");
assert.equal(assessIffcoAutoOnboarding({...compactor,fields:iffcoCompactorSource}).eligible,false,
  "18/18 parser checks are not enough when make and fuel are unverified");
for(const model of ["UNLISTED COMPACTOR","VMT 330 ROAD ROLLER","VMT 117 LC DD COMPACTOR"]){
 const e=enrichIffcoCertifiedMachineFamily(iffcoCompactorSource.map(f=>f.key==="vehicle_model"?{...f,value:model}:f),"iffco_tokio_cv_native_pdf");
 assert.equal(e.some(f=>f.key==="vehicle_fuel_type"),false,model+" must never get a guessed fuel type");
}
assert.equal(enrichIffcoCertifiedMachineFamily(iffcoCompactorSource,"new_india_cv_native_pdf").some(f=>f.key==="vehicle_fuel_type"),false);
const previewSource=file("../lib/policy-intake-semi-auto-n8n.ts");
assert.ok(previewSource.includes("legacyIffcoMachineWithoutNewRefFingerprint")
  &&actions.includes("extracted.preview.legacyIffcoMachineWithoutNewRefFingerprint"),
  "Existing IFFCO queue entries must retain a guarded one-click evidence retry");
// JCB 455-5N wheel-loader N9424861: PDF prints JCB and model, not
// fuel. Fill Diesel only for the verified model family, not all JCB makes.
const iffcoLoaderSource=[
  ...iffcoAutoFields.filter(f=>!["vehicle_make","vehicle_model","vehicle_fuel_type"].includes(f.key)),
  ifField("vehicle_make","JCB"),
  ifField("vehicle_model","JCB 455-5N LOADER"),
];
const loaderFields=enrichIffcoCertifiedMachineFamily(iffcoLoaderSource,"iffco_tokio_cv_native_pdf");
assert.equal(loaderFields.find(f=>f.key==="vehicle_fuel_type")?.value,"Diesel");
assert.equal(loaderFields.find(f=>f.key==="vehicle_make")?.value,"JCB");
assert.ok(loaderFields.find(f=>f.key==="vehicle_fuel_type")?.evidence?.includes("JCB 455-5N wheel loader"));
assert.equal(assessIffcoAutoOnboarding({...iffcoAuto,fields:loaderFields}).eligible,true);
assert.equal(assessIffcoAutoOnboarding({...iffcoAuto,fields:iffcoLoaderSource}).eligible,false,
 "18/18 parser checks do not mean a bookable intake when fuel is missing");
for(const model of ["JCB 403E LOADER","JCB E-TECH LOADER","JCB UNKNOWN LOADER"]){
 const fields=enrichIffcoCertifiedMachineFamily(iffcoLoaderSource.map(f=>f.key==="vehicle_model"?{...f,value:model}:f),"iffco_tokio_cv_native_pdf");
 assert.equal(fields.some(f=>f.key==="vehicle_fuel_type"),false,"Must not guess diesel for "+model);
}
const loaderElectric=enrichIffcoCertifiedMachineFamily([...iffcoLoaderSource,ifField("vehicle_fuel_type","Electric")],"iffco_tokio_cv_native_pdf");
assert.equal(loaderElectric.find(f=>f.key==="vehicle_fuel_type")?.value,"Electric","Never overwrite printed fuel");
const loaderPreview=file("../lib/policy-intake-semi-auto-n8n.ts");
assert.ok(loaderPreview.includes("legacyIffcoLoaderFuelFingerprint")
  &&loaderPreview.includes("legacyIffcoLoaderFuelWithoutNewRefFingerprint")
  &&actions.includes("extracted.preview.legacyIffcoLoaderFuelFingerprint"),
  "Old IFFCO loader queues must remain eligible for exact fresh-PDF revalidation");
assert.equal(assessIffcoAutoOnboarding(iffcoAuto).eligible,true);
// A registered JCB MP plate is not an MP/NEW provisional vehicle. Its
// address city must not be mistaken for the registration district.
const iffcoRegistered={
  ...iffcoAuto,
  fields:iffcoAuto.fields.map(field=>{
    if(field.key==="vehicle_registration_status")return {...field,value:"registered"};
    if(field.key==="vehicle_registration_number")return {...field,value:"MP20ZS7041"};
    if(field.key==="vehicle_manufacturing_year")return {...field,value:"2024"};
    if(field.key==="vehicle_capacity")return {...field,value:"4399"};
    if(field.key==="vehicle_rto_state")return {...field,evidence:"Registered plate MP20ZS7041 indicates MP state; MP RTO registry"};
    if(field.key==="vehicle_rto_name")return {...field,evidence:"Registered plate MP20ZS7041 code MP-20 = Jabalpur (MP RTO registry); not policyholder address"};
    if(field.key==="cpa_premium")return {...field,value:"330"};
    return field;
  }),
  commercialPremium:{od:4132,tp:7697,net:11829,gst:2129.22,gross:13958.22},
};
assert.equal(assessIffcoAutoOnboarding(iffcoRegistered).eligible,true,
  "IFFCO registered MP20 JCB with 18/18 checks and reconciled premium is eligible");
assert.equal(assessIffcoAutoOnboarding({...iffcoRegistered,fields:iffcoRegistered.fields.map(f=>
  f.key==="vehicle_rto_name"?{...f,evidence:"IFFCO policyholder address city only;"}:f)}).eligible,false,
  "Registered RTO must not come from the mailing address");
assert.equal(assessIffcoAutoOnboarding({...iffcoRegistered,fields:iffcoRegistered.fields.map(f=>
  f.key==="vehicle_registration_number"?{...f,value:"MP21ZS7041"}:f)}).eligible,false,
  "RTO evidence must match the exact printed plate");
assert.equal(assessIffcoAutoOnboarding({...iffcoRegistered,commercialPremium:{...iffcoRegistered.commercialPremium,net:11828}}).eligible,false,
  "Registered IFFCO still requires reconciled printed premiums");
assert.equal(assessIffcoAutoOnboarding({...iffcoRegistered,checksPassed:17}).eligible,false);
assert.equal(assessIffcoAutoOnboarding({...iffcoAuto,parserId:"go_digit_cv_native_pdf"}).eligible,false);
assert.equal(assessIffcoAutoOnboarding({...iffcoAuto,checksPassed:17}).eligible,false);
assert.equal(assessIffcoAutoOnboarding({...iffcoAuto,commercialPremium:{...iffcoAuto.commercialPremium,gross:14300}}).eligible,false);
assert.equal(assessIffcoAutoOnboarding({...iffcoAuto,fields:iffcoAuto.fields.filter(f=>f.key!=="vehicle_capacity")}).eligible,false);
assert.equal(assessIffcoAutoOnboarding({...iffcoAuto,fields:iffcoAuto.fields.map(f=>f.key==="vehicle_rto_name"?{...f,evidence:"Native PDF policy schedule"}:f)}).eligible,false);
assert.equal(assessIffcoAutoOnboarding({...iffcoAuto,fields:iffcoAuto.fields.map(f=>f.key==="vehicle_fuel_type"?{...f,evidence:"Native PDF policy schedule"}:f)}).eligible,false);
assert.equal(assessIffcoAutoOnboarding({...iffcoAuto,fields:[...iffcoAuto.fields,iffcoAuto.fields[0]]}).eligible,false);
assert.ok(handoff.includes("const iffcoReview=assessIffcoAutoOnboarding(")
  && handoff.includes("eligibleForVerifiedConversion=autoEligibleGoDigit||iffcoReview.eligible"),
  "IFFCO source and financial validated readiness must be used for the queue");
assert.ok(actions.includes('queued.exception_codes[0]==="registration_pending_review"')
  &&actions.includes('queued.parser_id==="iffco_tokio_cv_native_pdf"'),
  "Only fully trained IFFCO can explicitly retry an old provisional registration hold");
assert.ok(queue.includes("certifiedIffcoNewVehicle")
  &&queue.includes('certifiedIffcoNewVehicle&&e.code==="registration_pending_review"'),
  "Queue should clear only the certified IFFCO provisional RTO exception, not real booking errors");
assert.ok(actions.includes('const heldReview=queued?.state==="exception"')
  &&actions.includes('queued.exception_codes.length===1')
  &&actions.includes('queued.exception_codes[0]==="booking_review_required"')
  &&actions.includes("const sameReviewedFingerprint=")
  &&actions.includes("!(sameReviewedFingerprint||reverifiedNiaLegacyHold)")
  &&actions.includes("extracted.preview.documentId!==queued.document_id")
  &&actions.includes('queued.last_error_code==="missing_verified_vehicle_registration_number"')
  &&actions.includes("assessNiaNamedAuthorityUnregisteredConversion({"),
  "Held parser retries require an exact fingerprint except for a narrowly re-certified NIA legacy source, and always require the same current PDF");
const studio=file("../components/development/semi-auto-policy-workspace.tsx");
assert.ok(studio.includes("canRetryReviewHeldPolicy(exceptionRow)")
  &&studio.includes("setAutoConvertRow(exceptionRow)")
  &&studio.includes("convertVerifiedAiIntake(row.id,true)"),
  "Only explicitly confirmed held parser retries can invoke direct conversion");
assert.ok(actions.includes("const assessment=assessIffcoAutoOnboarding(")
  && actions.includes("mapVerifiedIffcoCommercialPremium(commercial")
  && actions.includes('pdfField("vehicle_registration_status")==="registration_pending"'),
  "IFFCO confirmed conversion must verify financial mapping, registration and original evidence");

// The source PDF's RTO-authority cell is blank; the NIA issuing-office city
// is explicitly provisional and must never be treated as verified RC data.
assert.ok(handoff.includes("NIA_PROVISIONAL_RTO_FROM_ISSUING_OFFICE:")
  && handoff.includes("NIA issuing office city; provisional, NOT registration authority")
  && handoff.includes('field.value==="unregistered"'),
  "NIA fallback must require verified current PDF, unregistered status and source evidence");
assert.ok(unified.includes("Provisional city from the NIA issuing office")
  && unified.includes('form.remarks.includes("NIA_PROVISIONAL_RTO_FROM_ISSUING_OFFICE:")'),
  "A provisional issuing-office city must be labeled when shown as RTO");
const canonicalEngine=file("../lib/policy-onboarding-engine.ts");
assert.ok(!canonicalEngine.includes("CPA amount is mandatory for GCV policies")
  && canonicalEngine.includes("(payload.premium.cpaOpted && cpaAmount <= 0)")
  && canonicalEngine.includes("(!payload.premium.cpaOpted && cpaAmount > 0)"),
  "Canonical booking must allow zero CPA for any GCV policy, unless CPA is opted in");
assert.ok(!unified.includes("CPA amount is mandatory for GCV policies")
  && unified.includes("CPA must be positive when opted in.")
  && unified.includes('min="0"')
  && !unified.includes('...(form.vehicleClass==="GCV"?[form.cpa]:[])'),
  "Form must allow zero CPA while preserving opted-in amount check");
assert.ok(!handoff.includes('const niaMissingCpa=')
  && handoff.includes('niaHoldCode=niaMissingAuthority?"nia_missing_registration_authority":null'),
  "NIA reparse queue must not hold verified zero-CPA commercial policies as missing CPA");
assert.ok(component.includes("Historical NIA CPA hold"),
  "The UI must clarify older CPA-only exceptions are obsolete");

console.log("PASS: signed-source non-Tata AI queue routing, insurer-scoped verified name/product draft, and ICICI/Tata/booking guards.");
