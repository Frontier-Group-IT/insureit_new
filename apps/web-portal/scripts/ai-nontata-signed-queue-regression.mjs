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
assert.match(signed,/vehicle_registration_status"\) === "unregistered"/);
assert.match(handoff,/field\.key==="vehicle_registration_status"&&field\.value==="unregistered"/);
for (const id of ["go_digit_cv_native_pdf","new_india_cv_native_pdf","iffco_tokio_cv_native_pdf"]) {
  assert.ok(eligibility.includes(id), "AI queue must recognize trained parser "+id);
  assert.ok(signed.includes(id), "The signed-source path must retain exact parser identity "+id);
}
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
assert.match(actions,/extracted\.preview\.parserId!=="go_digit_cv_native_pdf"/);
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
assert.deepEqual(mapVerifiedGoDigitCommercialPremium({od:2415.46,tp:7647,net:10062.46,gst:1811.24,gross:11873.70}),
  {od:"2415.46",addOnPremium:"0",tp:"7647",cpa:"0",cpaOpted:"No"});
assert.throws(()=>mapVerifiedGoDigitCommercialPremium({od:2415.46,tp:7647,net:10062.46,gst:1811.24,gross:12000}),
  /n8n_motor_premium_handoff_unreconciled/);
assert.ok(handoff.includes('state:autoEligibleGoDigit?"verified":"exception"'));
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
assert.ok(niaHandoff.includes('nia_missing_rto_authority_and_cpa'));
assert.ok(niaPage.includes('readVerifiedNiaPrintedPremiumReference(')
  && niaPage.includes('queue.data.document_id===document.data.id'));
assert.ok(unified.includes('printedPremiumReference!.gst')
  && unified.includes('Math.round(od*100)===Math.round(printedPremiumReference.od*100)')
  && unified.includes('form.cpaOpted==="No"'));
assert.ok(shell.includes('printedPremiumReference={props.printedPremiumReference}'));
assert.ok(component.includes('NIA PDF verified · booking fields incomplete')
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

// The source PDF's RTO-authority cell is blank; the NIA issuing-office city
// is explicitly provisional and must never be treated as verified RC data.
assert.ok(handoff.includes("NIA_PROVISIONAL_RTO_FROM_ISSUING_OFFICE:")
  && handoff.includes("NIA issuing office city; provisional, NOT registration authority")
  && handoff.includes('field.value==="unregistered"'),
  "NIA fallback must require verified current PDF, unregistered status and source evidence");
assert.ok(unified.includes("Provisional city from the NIA issuing office")
  && unified.includes('form.remarks.includes("NIA_PROVISIONAL_RTO_FROM_ISSUING_OFFICE:")'),
  "A provisional issuing-office city must be labeled when shown as RTO");
assert.ok(handoff.includes('nia_missing_verified_gcv_cpa')
  && component.includes('nia_missing_verified_gcv_cpa'),
  "Missing positive CPA must continue blocking automatic GCV booking");

console.log("PASS: signed-source non-Tata AI queue routing, insurer-scoped verified name/product draft, and ICICI/Tata/booking guards.");
