"use server";

import type { PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import { buildPolicyOcrOnboardingUpdate } from "@/lib/policy-ocr-onboarding-apply";
import { segregatePolicyIntakeLanes } from "@/lib/policy-ocr-routing-mode";
import { selectPolicyIntakeCustomerMatch, type PolicyIntakeCustomerIdentityCandidate } from "@/lib/policy-intake-customer-match";
import { requirePolicyIntakeFinalizer, requirePolicyIntakeReviewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireCapability } from "@/lib/master-data-server";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { isN8nWorkbenchPrimary, previewSemiAutoN8nExtraction } from "@/lib/policy-intake-semi-auto-n8n";
import type { N8nVerifiedPremiumBreakdown } from "@/lib/policy-intake-n8n-validation";
import { mapVerifiedN8nMotorPremium, mapVerifiedIffcoCommercialPremium, mapVerifiedNiaCommercialPremium } from "@/lib/policy-n8n-onboarding-premium";
import { assessProductVariantDirectConversion, mapVerifiedProductVariantPremium, PRODUCT_VARIANT_PARSERS } from "@/lib/policy-product-variant-direct-eligibility";
import { assessIffcoAutoOnboarding } from "@/lib/policy-iffco-auto-eligibility";
import { assessNiaNamedAuthorityUnregisteredConversion, assessStandardCommercialDirectConversion } from "@/lib/policy-commercial-direct-eligibility";
import { policyDateDecision } from "@/lib/policy-date-rule";
import { trainedN8nParserProfile } from "@/lib/ai-policy-onboarding-eligibility";
import { enrichVerifiedN8nOnboardingFields, resolveManufacturingYearEvidence } from "@/lib/policy-n8n-onboarding-enrichment";
import { sameInsuredIdentity, selectVerifiedN8nInsuredDraftIdentity } from "@/lib/policy-n8n-onboarding-insured";

export type PolicyIntakeDraft = {
  registrationMode:"registered"|"unregistered";
  issuanceDate:string; rmName:string; intermediaryType:string; leadSource:string; intermediaryCode:string; businessLine:string;
  registrationNo:string; insuredName:string; phoneNo:string; vehicleClass:string; make:string; model:string; fuelType:string; capacity:string; manufacturingYear:string; chassisNo:string; engineNo:string; rtoState:string; rtoName:string;
  policyProduct:string; idv:string; od:string; tp:string; addOnPremium?:string; cpaOpted:"Yes"|"No"; cpa:string; policyNo:string; insurerId:string; validFrom:string; validUpto:string; tpValidUpto?:string; cpaValidUpto?:string;
  payoutBasis:string; projectedOdPercent:string; projectedTpPercent:string; insurerScheme:string; payinBillNo:string; payinBilledAmount:string; payinBillDate:string; payinStatus:string; retention:string; payoutOdPercent:string; payoutTpPercent:string; flatPayoutAmount:string; payoutStatus:string; payoutDate:string; payoutVoucherNo:string; remarks:string;
};

export type PolicyIntakeHandoffResult =
  | { ok:true; draft:PolicyIntakeDraft; draftRevision:number; matchedCustomerId:string|null; existingDraft?:boolean }
  | { ok:false; error:string; conflict?:false }
  | { ok:false; error:string; conflict:true; reviewerName:string };

export type PolicyIntakeDraftSaveResult =
  | { ok:true; revision:number }
  | { ok:false; error:string; conflict?:boolean };

type ManufacturerId={id:string};
type BrandOption={manufacturer_id:string;brand_name:string};
type InsurerOption={id:string;name:string};
type CustomerOption=PolicyIntakeCustomerIdentityCandidate;
async function resolveMasterIntakeIdentity(admin:ReturnType<typeof createSupabaseAdminClient>,customerId:string|null,phone:string){
  if(!customerId||!phone)return null;
  const {data,error}=await admin.from("customers").select("id,phone,contact_name,company_name").eq("id",customerId).maybeSingle<{id:string;phone:string;contact_name:string;company_name:string|null}>();
  if(error||!data||data.phone!==phone)return null;
  const name=(data.company_name||data.contact_name||"").trim();
  return name?{id:data.id,name}:null;
}
async function resolveConfirmedIntakeCustomerId(admin:ReturnType<typeof createSupabaseAdminClient>,phone:string,insuredName:string){
  if(!phone.trim()||!insuredName.trim())return null;
  const{data,error}=await admin.from("customers").select("id,contact_name,company_name").eq("phone",phone).limit(20).returns<CustomerOption[]>();
  if(error)return null;
  return selectPolicyIntakeCustomerMatch(data??[],insuredName);
}
function ocrInsuredName(fields:PolicyIntakeOcrField[]){
  return fields.find(field=>field.key==="insured_name")?.value?.trim()??"";
}

type IntakeForHandoff={
  id:string;
  intake_number:string;
  lead_source_type:"posp"|"misp"|"partner";
  lead_source_name:string;
  lead_source_code:string|null;
  customer_mobile:string;
  matched_customer_id:string|null;
  ocr_fields:PolicyIntakeOcrField[];
  status:string;
  created_at:string;
  assigned_to_profile_id:string|null;
  policy_type:string|null;
  storage_bucket:string|null;
  storage_path:string|null;
};

type VerifiedN8nHandoff = {
  documentId:string; fields:PolicyIntakeOcrField[];
  parserId:string; parserVersion:string; checksPassed:number; fingerprint:string; warnings:string[];
  premium:N8nVerifiedPremiumBreakdown | null;
  commercialPremium?: { od:number; tp:number; net:number; gst:number; gross:number; cpa?:number; addOn?:number; odBasic?:number };
  fillEmptyFields?:boolean;
  /** Explicit IT action: rebuild the saved, unbooked Intake draft from this fresh parse. */
  replaceExistingDraft?:boolean;
  /** Date accepted using Tata AIG's matching signing/receipt business rule. */
  autoAcceptedIssuanceDate?:{date:string;documentSha256:string};
  reviewedIssueDateReplacement?:{expectedPrevious:string;expectedRevision:number};
  reviewerConfirmedSigningDate?:{
    date:string;documentSha256:string;
    expectedDraftRevision:number|null;expectedPreviousDate:string|null;
  };
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The client supplies only IDs + the reviewed fingerprint. We re-run n8n
 * against the current private PDF before creating a canonical editable draft.
 * No policy is booked; this is a deliberate, auditable reviewer handoff.
 */
export async function prepareVerifiedN8nIntakeHandoff(
  id:string, expectedDocumentId:string|null, expectedFingerprint:string|null, takeOver=false, fillEmptyFields=false,
  reviewedIssueDateReplacement?:{expectedPrevious:string;expectedRevision:number},
  reviewerConfirmedSigningDate?:{
    date:string;documentSha256:string;
    expectedDraftRevision:number|null;expectedPreviousDate:string|null;
  },
  replaceExistingDraft=false,
):Promise<PolicyIntakeHandoffResult> {
  if (!isN8nWorkbenchPrimary() || !UUID.test(id)
      || (!replaceExistingDraft && (!expectedDocumentId || !expectedFingerprint
        || !UUID.test(expectedDocumentId) || !/^[a-f0-9]{64}$/i.test(expectedFingerprint)))) {
    return {ok:false,error:"n8n handoff is not enabled or the reviewed PDF reference is invalid."};
  }
  // Every exported server action enforces scope itself; do not rely on the
  // Development caller to authorize this sensitive private-PDF handoff.
  const operator=await requireCapability("manage_system","approve");
  if(operator.role!=="it_super_user"&&operator.role!=="super_admin")
    return{ok:false,error:"Development policy handoff requires authorized IT/Admin access."};
  await requirePolicyCreator();
  await requirePolicyIntakeFinalizer(id);
  await requirePolicyIntakeReviewer(id);
  const parsed=await previewSemiAutoN8nExtraction(id,{allowManualLane:replaceExistingDraft});
  if(!parsed.ok)return{ok:false,error:parsed.error};
  if((expectedDocumentId && parsed.preview.documentId!==expectedDocumentId)
      || (expectedFingerprint && parsed.preview.fingerprint!==expectedFingerprint)) {
    return{ok:false,error:"The n8n extraction changed after review. Run n8n again and check the new fields before continuing."};
  }
  const commercial=parsed.preview.commercialPremium;
  const goDigitVerifiedFill = Boolean(commercial) && fillEmptyFields
    && parsed.preview.parserId==="go_digit_cv_native_pdf"
    && parsed.preview.checksPassed===18 && parsed.preview.warnings.length===0;
  // Direct IFFCO handoff is restricted to the separately certified JCB
  // family. This has the same strict insurer/premium/RTO provenance gate as
  // queue eligibility and final conversion. Other commercial layouts still
  // require the explicit reparse/review flow.
  const iffcoVerifiedFill = Boolean(commercial) && fillEmptyFields
    && assessIffcoAutoOnboarding({
      parserId:parsed.preview.parserId,
      checksPassed:parsed.preview.checksPassed,
      warnings:parsed.preview.warnings,
      fields:parsed.preview.fields,
      commercialPremium:commercial,
    }).eligible;
  const standardCommercialVerifiedFill=Boolean(commercial)&&fillEmptyFields
    &&(assessNiaNamedAuthorityUnregisteredConversion({
      parserId:parsed.preview.parserId,checksPassed:parsed.preview.checksPassed,
      warnings:parsed.preview.warnings,fields:parsed.preview.fields,
      commercialPremium:commercial,
    }).eligible||assessStandardCommercialDirectConversion({
      parserId:parsed.preview.parserId,checksPassed:parsed.preview.checksPassed,
      warnings:parsed.preview.warnings,fields:parsed.preview.fields,
      commercialPremium:commercial,
    }).eligible);
  const productVariantVerifiedFill=Boolean(commercial)&&fillEmptyFields
    &&assessProductVariantDirectConversion({
      parserId:parsed.preview.parserId,checksPassed:parsed.preview.checksPassed,
      warnings:parsed.preview.warnings,fields:parsed.preview.fields,
      commercialPremium:commercial,
    }).eligible;
  if (commercial && !replaceExistingDraft && !goDigitVerifiedFill
      && !iffcoVerifiedFill && !standardCommercialVerifiedFill && !productVariantVerifiedFill) {
    return {ok:false,error:"This commercial PDF is not eligible for direct verified handoff; check its insurer-specific evidence before booking."};
  }
  if (!commercial && !parsed.preview.premium) {
    return {ok:false,error:"The validated n8n premium breakdown is missing."};
  }
  const isTata = parsed.preview.parserId.startsWith("tata_aig_")
    && trainedN8nParserProfile(parsed.preview.parserId) !== null;
  const informationalTataWarnings = new Set([
    "tata_aig_issuance_date_unverified",
    "tata_aig_human_review_required",
    "tata_aig_printed_net_rounding",
    "tata_aig_signature_date_not_in_native_text",
    "tata_aig_issuance_date_requires_verified_pdf_signature",
  ]);
  const blockingWarnings = parsed.preview.warnings.filter(warning =>
    !isTata || !informationalTataWarnings.has(warning));
  // Missing signing evidence still leaves issuance date blank; the workflow
  // never substitutes coverage start, receipt alone, PDF creation, or today.
  // The non-Tata adapter has already verified the insurer-specific check
  // set and its printed OD + TP = net, net + GST = gross contract.
  // Never attempt to pass its commercial totals through ICICI/Tata rules.
  const commercialChecksOk=Boolean(commercial)
    && (["go_digit_cv_native_pdf","iffco_tokio_cv_native_pdf","new_india_cv_native_pdf",
        "united_india_gcv_native_pdf","oriental_gccv_native_pdf"].includes(parsed.preview.parserId)
       || PRODUCT_VARIANT_PARSERS.has(parsed.preview.parserId))
    && parsed.preview.checksPassed === (trainedN8nParserProfile(parsed.preview.parserId)?.checks ?? 0)
    && Math.abs((commercial!.od+commercial!.tp)-commercial!.net)<0.07
    && Math.abs((commercial!.net+commercial!.gst)-commercial!.gross)<(PRODUCT_VARIANT_PARSERS.has(parsed.preview.parserId)?0.51:0.07);
  const acceptableCommercialWarning=(value:string)=>
    parsed.preview.parserId==="new_india_cv_native_pdf"
    && value.startsWith("Policy prints only an RTO prefix.");
  const legacyChecksFailed=parsed.preview.checksPassed !== (trainedN8nParserProfile(parsed.preview.parserId)?.checks ?? 13)
    || blockingWarnings.length > 0;
  if (commercial ? (!commercialChecksOk || parsed.preview.warnings.some(w=>!acceptableCommercialWarning(w)))
      : legacyChecksFailed) {
    return{ok:false,error:"n8n validation warnings must be resolved before creating an onboarding draft."};
  }
  // Metadata-only date evidence is not certified issuance. An authorized
  // reviewer must explicitly compare the original PDF and opt into using it.
  const signature=parsed.preview.issuanceEvidence;
  const existing=parsed.preview.savedDraftIssueDate;
  if(reviewerConfirmedSigningDate) {
    if(!signature || signature.verification!=="detached_signature_integrity_verified"
      || reviewerConfirmedSigningDate.date!==signature.proposedDate
      || reviewerConfirmedSigningDate.documentSha256!==signature.documentSha256
      || reviewerConfirmedSigningDate.expectedDraftRevision!==(existing?.revision??null)
      || reviewerConfirmedSigningDate.expectedPreviousDate!==(existing?.value??null)
      || ["invalid","future"].includes(policyDateDecision(reviewerConfirmedSigningDate.date))) {
      return{ok:false,error:"The signing-date proposal or saved draft changed. Review the current PDF and confirm again."};
    }
  }
  // This server-side preview already re-read the *current* PDF and checked
  // the strict Tata 18-check profile, signer/receipt date agreement and hash.
  const autoDate=parsed.preview.acceptedIssuanceDate;
  const autoAcceptedIssuanceDate=autoDate&&signature
    && signature.proposedDate===autoDate
    && !["invalid","future"].includes(policyDateDecision(autoDate))
    ?{date:autoDate,documentSha256:signature.documentSha256}:undefined;
  return preparePolicyIntakeHandoffInternal(id,takeOver===true,{
    documentId:parsed.preview.documentId,fields:parsed.preview.fields,
    parserId:parsed.preview.parserId,parserVersion:parsed.preview.parserVersion,
    checksPassed:parsed.preview.checksPassed,fingerprint:parsed.preview.fingerprint,
    warnings:parsed.preview.warnings,premium:parsed.preview.premium,
    ...(commercial?{commercialPremium:commercial}:{}),fillEmptyFields,
    replaceExistingDraft,
    reviewedIssueDateReplacement,
    ...(autoAcceptedIssuanceDate?{autoAcceptedIssuanceDate}:{}),
    ...(reviewerConfirmedSigningDate?{reviewerConfirmedSigningDate}:{}),
  });
}

export async function preparePolicyIntakeHandoff(id:string,takeOver=false):Promise<PolicyIntakeHandoffResult> {
  if (segregatePolicyIntakeLanes()) {
    const admin=createSupabaseAdminClient();
    const {data}=await admin.from("policy_intake_requests").select("processing_lane").eq("id",id).maybeSingle<{processing_lane:string}>();
    if(data?.processing_lane==="automation") return{ok:false,error:"AI Automation owns this Intake. Use the controlled n8n workbench, not manual Operations handoff."};
  }
  return preparePolicyIntakeHandoffInternal(id,takeOver);
}

async function preparePolicyIntakeHandoffInternal(
  id:string,takeOver=false,verified?:VerifiedN8nHandoff,
):Promise<PolicyIntakeHandoffResult> {
  await requirePolicyIntakeFinalizer(id);
  const reviewer=await requirePolicyIntakeReviewer(id);
  const admin=createSupabaseAdminClient();
  const {data:intake}=await admin.from("policy_intake_requests")
    .select("id,intake_number,lead_source_type,lead_source_name,lead_source_code,customer_mobile,matched_customer_id,ocr_fields,status,created_at,assigned_to_profile_id,policy_type,storage_bucket,storage_path")
    .eq("id",id)
    .maybeSingle<IntakeForHandoff>();
  if(!intake||["completed","rejected"].includes(intake.status))return{ok:false,error:"This intake is no longer available for onboarding."};
  if(verified){
    if(intake.policy_type!=="motor" || !["processing","ready_for_review","in_review","needs_attention"].includes(intake.status))
      return{ok:false,error:"Only an open Motor Intake with verified n8n output can continue to Motor Policy Onboarding."};
    const{data:currentDocument,error:documentError}=await admin.from("policy_intake_documents")
      .select("id,storage_path,storage_bucket").eq("intake_id",id).eq("is_current",true)
      .maybeSingle<{id:string;storage_path:string;storage_bucket:string}>();
    if(documentError||!currentDocument||currentDocument.id!==verified.documentId
        ||currentDocument.storage_path!==intake.storage_path
        ||currentDocument.storage_bucket!==intake.storage_bucket)
      return{ok:false,error:"The current policy PDF has changed. Run n8n again before continuing."};
  }
  const duplicateCheck=await loadPolicyIntakeDuplicateMatches(admin,[intake]);
  if(!duplicateCheck.ok)return{ok:false,error:duplicateCheck.error};
  if(duplicateCheck.matches.has(id))return{ok:false,error:"This policy intake is a duplicate and cannot be sent to Policy Onboarding."};
  if(verified){
    const fromN8n=await loadPolicyIntakeDuplicateMatches(admin,[{...intake,ocr_fields:verified.fields}]);
    if(!fromN8n.ok)return{ok:false,error:fromN8n.error};
    if(fromN8n.matches.has(id))return{ok:false,error:"The verified n8n policy number already exists or matches an earlier Intake. Booking handoff is blocked."};
  }

  const assignedToAnother=Boolean(intake.assigned_to_profile_id&&intake.assigned_to_profile_id!==reviewer.id);
  if(assignedToAnother&&!takeOver){
    const{data:assignedProfile}=await admin.from("profiles").select("full_name").eq("id",intake.assigned_to_profile_id as string).maybeSingle<{full_name:string}>();
    const reviewerName=assignedProfile?.full_name?.trim()||"another Operations user";
    return{ok:false,conflict:true,reviewerName,error:`This intake is currently assigned to ${reviewerName}.`};
  }

  const replaceOcr=verified?.replaceExistingDraft===true;
  let assignmentQuery=admin.from("policy_intake_requests")
    .update({status:"in_review",assigned_to_profile_id:reviewer.id,attention_reason:null,
      ...(replaceOcr?{ocr_status:"completed",ocr_fields:verified.fields,
        ocr_parser_id:verified.parserId,ocr_parser_version:verified.parserVersion,
        ocr_warnings:verified.warnings}: {})})
    .eq("id",id)
    .in("status",["ready_for_review","in_review","processing","needs_attention"]);
  if(verified)assignmentQuery=assignmentQuery.eq("storage_path",intake.storage_path as string);
  if(assignedToAnother){
    assignmentQuery=assignmentQuery.eq("assigned_to_profile_id",intake.assigned_to_profile_id as string);
  }else{
    assignmentQuery=assignmentQuery.or(`assigned_to_profile_id.is.null,assigned_to_profile_id.eq.${reviewer.id}`);
  }
  const{data:claimed,error:claimError}=await assignmentQuery.select("id").maybeSingle<{id:string}>();
  if(claimError||!claimed){
    return{ok:false,error:"The reviewer assignment changed while you were opening this intake. Refresh and try again."};
  }
  if(verified){
    // The PDF can be superseded while reviewer assignment is being claimed.
    // Never create an n8n-origin draft against a stale document version.
    const {data:lastDoc,error:lastDocError}=await admin.from("policy_intake_documents")
      .select("id,storage_path,storage_bucket").eq("intake_id",id).eq("is_current",true)
      .maybeSingle<{id:string;storage_path:string;storage_bucket:string}>();
    if(lastDocError||!lastDoc||lastDoc.id!==verified.documentId
        ||lastDoc.storage_path!==intake.storage_path ||lastDoc.storage_bucket!==intake.storage_bucket){
      return{ok:false,error:"The current PDF changed during handoff. Re-run n8n before opening Policy Onboarding."};
    }
  }

  const {data:existingDraft}=await admin.from("policy_intake_onboarding_drafts").select("draft_payload,revision").eq("intake_id",id).maybeSingle<{draft_payload:PolicyIntakeDraft;revision:number}>();
  const markFreshParseForReview=async()=>{
    if(!verified?.replaceExistingDraft)return true;
    // An n8n 16/16 NIA extraction only establishes printed facts, not that
    // an unregistered GCV has its RTO authority and owner-driver CPA. Keep a
    // specific review hold rather than calling every such case bulk failure.
    const nia=verified.parserId==="new_india_cv_native_pdf"
      && verified.checksPassed===16 && verified.warnings.length===0;
    const hasField=(key:string)=>verified.fields.some(f=>f.key===key&&f.value.trim());
    const niaMissingAuthority=nia && (!hasField("vehicle_rto_name")
      ||verified.fields.some(f=>f.key==="vehicle_rto_name" && /^FASTag ID:$/i.test(f.value.trim())));
    // Optional CPA is not a missing GCV field. Keep NIA review limited to
    // actual absent authority or other independently verified booking rules.
    const niaHoldCode=niaMissingAuthority?"nia_missing_registration_authority":null;
    const goDigit=verified.parserId==="go_digit_cv_native_pdf" && verified.checksPassed===18
      && verified.warnings.length===0;
    // Business rule: where the manufacturer did not print a manufacturing
    // year, use the separately evidenced registration year as an operational
    // fallback, with provenance. Financial values are never inferred.
    const digitYear=goDigit?resolveManufacturingYearEvidence(verified.fields):null;
    const requiredGoDigitKeys=[
      "insured_name","policy_product","vehicle_manufacturing_year",
      "vehicle_capacity","vehicle_rto_name","vehicle_rto_state",
      "vehicle_registration_number","vehicle_chassis_number","vehicle_engine_number",
      "policy_issuance_date","policy_start_date","policy_end_date",
    ];
    const missingGoDigit=goDigit?requiredGoDigitKeys.filter(key=>
      key==="vehicle_manufacturing_year" ? !digitYear?.year
      :!verified.fields.some(f=>f.key===key&&f.value.trim())):[];
    const autoEligibleGoDigit=goDigit&&missingGoDigit.length===0;
    const iffcoReview=assessIffcoAutoOnboarding({
      parserId:verified.parserId,checksPassed:verified.checksPassed,
      warnings:verified.warnings,fields:verified.fields,
      commercialPremium:verified.commercialPremium,
    });
    const standardReview=assessStandardCommercialDirectConversion({
      parserId:verified.parserId,checksPassed:verified.checksPassed,
      warnings:verified.warnings,fields:verified.fields,
      commercialPremium:verified.commercialPremium,
    });
    const niaReview=assessNiaNamedAuthorityUnregisteredConversion({
      parserId:verified.parserId,checksPassed:verified.checksPassed,
      warnings:verified.warnings,fields:verified.fields,
      commercialPremium:verified.commercialPremium,
    });
    // A fresh, fully verified Tata AIG TP parse remains a verified intake
    // after rebuilding its derived draft. Rebuilding cannot itself book it;
    // canonical identity, policy, vehicle, duplicate and date preflights remain.
    const verifiedTataTp = (
      verified.parserId==="tata_aig_private_car_liability_only_n8n_native_pdf"
      ||verified.parserId==="tata_aig_private_car_three_year_tp_n8n_native_pdf"
    ) && verified.checksPassed===16
      && verified.fields.some(f=>f.key==="insured_name"&&f.value.trim().length>=2)
      && verified.fields.some(f=>f.key==="policy_number"&&f.value.trim())
      && verified.fields.some(f=>f.key==="policy_start_date"&&f.value.trim())
      && verified.fields.some(f=>f.key==="policy_end_date"&&f.value.trim());
    // No policy is booked by this status change; only certified variants qualify.
    const productVariantReview=assessProductVariantDirectConversion({
      parserId:verified.parserId,checksPassed:verified.checksPassed,
      warnings:verified.warnings,fields:verified.fields,
      commercialPremium:verified.commercialPremium,
    });
    const eligibleForVerifiedConversion=verifiedTataTp||autoEligibleGoDigit||iffcoReview.eligible
      ||standardReview.eligible||niaReview.eligible||productVariantReview.eligible;
    const specificMissingYear=goDigit&&missingGoDigit.includes("vehicle_manufacturing_year");
    const{error}=await admin.from("policy_intake_ai_processing_queue").update({
      // Only previously certified Go Digit and new narrowly evidenced IFFCO
      // layouts enter the verified queue. All other commercial formats remain
      // review-only; no booking is created by changing queue status.
      state:eligibleForVerifiedConversion?"verified":"exception",
      exception_codes:eligibleForVerifiedConversion?[]:niaHoldCode?["missing_field"]
        :goDigit&&missingGoDigit.length?["missing_field"]:["booking_review_required"],
      field_keys:verified.fields.map(field=>field.key),parser_id:verified.parserId,
      checks_passed:verified.checksPassed,extraction_fingerprint:verified.fingerprint,
      last_error_code:eligibleForVerifiedConversion?null:niaHoldCode??(specificMissingYear
        ?"go_digit_missing_verified_manufacturing_year":goDigit&&missingGoDigit.length
          ?"go_digit_missing_verified_onboarding_fields"
          :verified.parserId==="iffco_tokio_cv_native_pdf"?iffcoReview.reason
          :verified.parserId==="new_india_cv_native_pdf"?niaReview.reason
          :PRODUCT_VARIANT_PARSERS.has(verified.parserId)?productVariantReview.reason
           :["united_india_gcv_native_pdf","oriental_gccv_native_pdf"].includes(verified.parserId)?standardReview.reason
          :"bulk_conversion_review_required"),
      processed_at:new Date().toISOString(),
      retry_after:new Date(Date.now()+24*60*60*1000).toISOString(),
      lease_id:null,leased_until:null,updated_at:new Date().toISOString(),
    }).eq("intake_id",id).eq("document_id",verified.documentId);
    return !error;
  };
  if(existingDraft?.draft_payload && !(verified?.fillEmptyFields) && !(verified?.replaceExistingDraft)){
    // A pre-existing operator draft must NEVER be overwritten by n8n.
    const identityName=verified
      ? existingDraft.draft_payload.insuredName
      : existingDraft.draft_payload.insuredName||ocrInsuredName(intake.ocr_fields??[]);
    const approvedMaster=verified
      ? await resolveMasterIntakeIdentity(admin,intake.matched_customer_id,intake.customer_mobile) : null;
    const matchedCustomerId=verified
      ? approvedMaster&&sameInsuredIdentity(approvedMaster.name,identityName)?approvedMaster.id:null
      : await resolveConfirmedIntakeCustomerId(admin,intake.customer_mobile,identityName);
    return{ok:true,draft:existingDraft.draft_payload,draftRevision:existingDraft.revision,matchedCustomerId,existingDraft:true};
  }

  const [manufacturerResult,brandResult,insurerResult]=await Promise.all([
    admin.from("vehicle_manufacturers").select("id").eq("is_active",true).returns<ManufacturerId[]>(),
    admin.from("vehicle_manufacturer_brands").select("manufacturer_id,brand_name").eq("is_active",true).order("brand_name").returns<BrandOption[]>(),
    admin.from("insurance_companies").select("id,name").eq("is_active",true).order("name").returns<InsurerOption[]>(),
  ]);
  if(manufacturerResult.error||brandResult.error||insurerResult.error)return{ok:false,error:"Policy onboarding master data is temporarily unavailable."};

  const activeManufacturerIds=new Set((manufacturerResult.data??[]).map(row=>row.id));
  const manufacturerOptions=Array.from(new Set((brandResult.data??[]).filter(row=>activeManufacturerIds.has(row.manufacturer_id)).map(row=>row.brand_name))).sort((a,b)=>a.localeCompare(b));
  const insurers=(insurerResult.data??[]).map((row:InsurerOption)=>({value:row.id,label:row.name}));
  const mapped=buildPolicyOcrOnboardingUpdate({
    mode:"create",
    // Carry verified new/unregistered status into onboarding. Never force a
    // registration number for a policy containing only an RTO prefix.
    registrationMode:verified?.fields.some(field =>
      field.key==="vehicle_registration_status"&&["unregistered","registration_pending"].includes(field.value))?"unregistered":"registered",
    current:{registrationNo:"",vehicleClass:"",make:"",model:"",fuelType:"",manufacturingYear:"",capacity:"",chassisNo:"",engineNo:"",rtoState:"",rtoName:"",policyProduct:"",idv:"",od:"",tp:"",cpa:"",policyNo:"",insurerId:"",validFrom:"",validUpto:""},
    fields:verified?enrichVerifiedN8nOnboardingFields(verified.fields,verified.parserId):(intake.ocr_fields??[]),
    manufacturers:manufacturerOptions,insurers,rcVerified:false,
  });
  // Only a server-verified current-PDF insured name is offered as an
  // editable, review-required draft value. It NEVER auto-links a customer.
  const masterIdentity=verified?await resolveMasterIntakeIdentity(admin,intake.matched_customer_id,intake.customer_mobile):null;
  const verifiedIdentity=verified?selectVerifiedN8nInsuredDraftIdentity(verified.fields,masterIdentity,verified.parserId):null;
  const customerName=verifiedIdentity?.name??(mapped.next.insuredName?.trim()||"");
  // Canonical form computes net = Basic OD + add-ons + TP + CPA. The n8n
  // "od_premium" OCR field is *Total OD*, so never copy it directly into
  // the form's Basic OD field and then add add-ons again.
  // The IFFCO Net(B) source prints CPA inside TP. Canonical Motor instead
  // adds CPA separately; split the *independently printed* CPA out of TP in
  // paisa, preserving verified OD, net, tax, gross, and paid-driver liability.
  // Other insurer liability totals retain their existing safe handling.
  const iffcoCpaFields=verified?.parserId==="iffco_tokio_cv_native_pdf"
    ?verified.fields.filter(f=>f.key==="cpa_premium"):[];
  const iffcoCpa=iffcoCpaFields.length===1?Number(iffcoCpaFields[0].value):NaN;
  if(verified?.parserId==="iffco_tokio_cv_native_pdf"
     &&(!verified.commercialPremium||verified.checksPassed!==18
       ||verified.warnings.length>0||iffcoCpaFields.length!==1
       ||!Number.isFinite(iffcoCpa)||iffcoCpa<0))
    return{ok:false,error:"IFFCO printed CPA evidence is incomplete; do not calculate an unverified premium."};
  const niaCertified=verified?.parserId==="new_india_cv_native_pdf"
    &&assessNiaNamedAuthorityUnregisteredConversion({
      parserId:verified.parserId,checksPassed:verified.checksPassed,
      warnings:verified.warnings,fields:verified.fields,
      commercialPremium:verified.commercialPremium,
    }).eligible;
  const niaCpa=niaCertified?Number(verified.fields.find(f=>f.key==="cpa_premium")?.value):NaN;
  let verifiedPremium:ReturnType<typeof mapVerifiedN8nMotorPremium>|null=null;
  try{
    verifiedPremium=verified?.parserId==="iffco_tokio_cv_native_pdf"
      ?mapVerifiedIffcoCommercialPremium(verified.commercialPremium!,iffcoCpa)
      :niaCertified
      ?mapVerifiedNiaCommercialPremium(verified!.commercialPremium!,niaCpa)
      :verified?.commercialPremium&&PRODUCT_VARIANT_PARSERS.has(verified.parserId)
      ?mapVerifiedProductVariantPremium(verified.commercialPremium,verified.parserId)
      :verified?.commercialPremium
      ? {od:String(verified.commercialPremium.od),tp:String(verified.commercialPremium.tp),
         addOnPremium:"0",cpa:"0",cpaOpted:"No"}
      :verified?.premium ? mapVerifiedN8nMotorPremium(verified.premium) : null;
  }catch{
    return{ok:false,error:"The current insurer PDF CPA/TP split is inconsistent; no draft or policy was changed."};
  }
  const addOnTotal=verifiedPremium?Number(verifiedPremium.addOnPremium):0;
  const yearEvidence=verified?resolveManufacturingYearEvidence(verified.fields):null;
  const yearFallbackNote=yearEvidence?.source==="registration_year_fallback"
    ? " REGISTRATION_YEAR_MANUFACTURING_FALLBACK: Manufacturing year missing from policy; "+yearEvidence.year
      +" was taken from the printed vehicle registration year under the configured operational fallback rule. This is not manufacturer-verified and no manufacturing month/day was inferred."
    :"";
  const niaProvisionalRtoField=verified?.parserId==="new_india_cv_native_pdf"
    && verified.checksPassed===16
    && verified.fields.some(field=>field.key==="vehicle_registration_status"
      &&field.value==="unregistered")
      ?verified.fields.find(field=>field.key==="vehicle_rto_name"
        &&field.evidence==="NIA issuing office city; provisional, NOT registration authority"
        &&/^[A-Za-z][A-Za-z -]{2,45}$/.test(field.value.trim()))
      :undefined;
  const niaProvisionalRtoNote=niaProvisionalRtoField
    ?" NIA_PROVISIONAL_RTO_FROM_ISSUING_OFFICE: "+niaProvisionalRtoField.value.trim()
      +", "+(verified?.fields.find(f=>f.key==="vehicle_rto_state")?.value||"state unavailable")
      +". Vehicle registration authority was blank on the PDF; the source is NIA's issuing office, not RTO confirmation. Confirm after RTO registration.":"";
  // IFFCO issues MP/NEW internal vehicle references before actual RTO
  // registration. Its insured-address city is a useful operational fallback,
  // NOT official RTO evidence. Keep the proof in the saved draft remarks.
  const iffcoProvisionalRtoField=verified?.parserId==="iffco_tokio_cv_native_pdf"
    && verified.checksPassed===18
    && verified.fields.some(field=>field.key==="vehicle_registration_status"
      &&field.value==="registration_pending")
      ?verified.fields.find(field=>field.key==="vehicle_rto_name"
        &&field.evidence.startsWith("IFFCO policyholder address city only;")
        &&/^[A-Za-z][A-Za-z -]{2,45}$/.test(field.value.trim()))
      :undefined;
  const iffcoProvisionalNote=iffcoProvisionalRtoField
    ?" IFFCO_PROVISIONAL_RTO_FROM_INSURED_ADDRESS: "+iffcoProvisionalRtoField.value.trim()
      +", "+(verified?.fields.find(field=>field.key==="vehicle_rto_state")?.value||"state unknown")
      +". IFFCO new vehicle's actual Registration Authority field was blank. "
      +"The insured address city is used for onboarding geography only; replace with the actual registered RTO after registration.":"";
  const iffcoRegisteredRtoField=verified?.parserId==="iffco_tokio_cv_native_pdf"
    &&verified.checksPassed===18
    &&verified.fields.some(field=>field.key==="vehicle_registration_status"
      &&field.value==="registered")
    ?verified.fields.find(field=>field.key==="vehicle_rto_name"
      &&field.evidence.startsWith("Registered plate ")
      &&field.evidence.includes(" (MP RTO registry);")
      &&/^[A-Za-z][A-Za-z -]{2,45}$/.test(field.value.trim())):undefined;
  const iffcoRegisteredRtoNote=iffcoRegisteredRtoField
    ?" IFFCO_REGISTERED_RTO_FROM_PLATE: "+iffcoRegisteredRtoField.evidence
      +". RTO city comes from the printed registration plate's MP district code, not the insured address.":"";
  const iffcoModelFuel=verified?.parserId==="iffco_tokio_cv_native_pdf"
    &&verified.checksPassed===18
      ?verified.fields.find(f=>f.key==="vehicle_fuel_type"&&f.value==="Diesel"
        &&f.evidence.startsWith("Manufacturer-model Diesel specification")):undefined;
  const iffcoFuelNote=iffcoModelFuel
    ?" IFFCO_FUEL_FROM_JCB_MODEL: Diesel is inferred from the manufacturer-confirmed JCB 3DX Plus 2WD variant, not a fuel value printed in this policy.":"";
  // Only a separately printed issued-on date OR the exact insurer-scoped
  // signing+receipt rule is accepted; OD/TP start and clock are never substitutes.
  const verifiedIssuanceDate=verified?.fields.find(field=>field.key==="policy_issuance_date")?.value
    || verified?.autoAcceptedIssuanceDate?.date || "";
  const approvedSigningDate=verified?.reviewerConfirmedSigningDate?.date??"";
  const tpStart=verified?.fields.find(field=>field.key==="third_party_start_date")?.value??"";
  const tpExpiry=verified?.fields.find(field=>field.key==="third_party_end_date")?.value??"";
   const cpaExpiry=verified?.fields.find(field=>field.key==="cpa_end_date")?.value??"";
  const matchedCustomerId=verified
    ? (verifiedIdentity?.matchedCustomerId??null)
    : await resolveConfirmedIntakeCustomerId(admin,intake.customer_mobile,customerName);
  const intermediaryType=intake.lead_source_type==="posp"?"POSP":intake.lead_source_type==="misp"?"MISP":"SIBL / Partner";
  const draft:PolicyIntakeDraft={
    registrationMode:mapped.registrationMode,
    issuanceDate:verified?(verifiedIssuanceDate||approvedSigningDate):"",rmName:"",intermediaryType,leadSource:intake.lead_source_name,intermediaryCode:intake.lead_source_code??"",businessLine:"Motor",
    registrationNo:mapped.next.registrationNo,insuredName:customerName,phoneNo:intake.customer_mobile,vehicleClass:mapped.next.vehicleClass,make:mapped.next.make,model:mapped.next.model,fuelType:mapped.next.fuelType,capacity:mapped.next.capacity,manufacturingYear:mapped.next.manufacturingYear,chassisNo:mapped.next.chassisNo,engineNo:mapped.next.engineNo,rtoState:mapped.next.rtoState,rtoName:mapped.next.rtoName,
    policyProduct:mapped.next.policyProduct,idv:mapped.next.idv,
    od:verifiedPremium?.od??mapped.next.od,
    tp:verifiedPremium?.tp??mapped.next.tp,
    ...(verifiedPremium?{addOnPremium:verifiedPremium.addOnPremium,tpValidUpto:tpExpiry,cpaValidUpto:cpaExpiry||(niaCertified?tpExpiry:"")}:{}),
    cpaOpted:verifiedPremium?.cpaOpted??"No",
    cpa:verifiedPremium?.cpa??mapped.next.cpa,
    policyNo:mapped.next.policyNo,insurerId:mapped.next.insurerId,validFrom:mapped.next.validFrom,validUpto:mapped.next.validUpto,
    payoutBasis:"NET",projectedOdPercent:"",projectedTpPercent:"",insurerScheme:"",payinBillNo:"",payinBilledAmount:"",payinBillDate:"",payinStatus:"Unbilled",retention:"",payoutOdPercent:"",payoutTpPercent:"",flatPayoutAmount:"",payoutStatus:"Pending",payoutDate:"",payoutVoucherNo:"",remarks:verified?.commercialPremium
      ? `Policy Intake ${id} — independently validated commercial-motor PDF (${verified.parserId}). REVIEW ONLY; no policy or customer was booked. Printed OD ${verified.commercialPremium.od}, TP including liabilities ${verified.commercialPremium.tp}, Net ${verified.commercialPremium.net}, GST ${verified.commercialPremium.gst}, Gross ${verified.commercialPremium.gross}. ${verified.parserId==="iffco_tokio_cv_native_pdf" ? `IFFCO source Net(B) ${verified.commercialPremium.tp} includes owner-driver CPA ${iffcoCpa}. Canonical TP ${verifiedPremium?.tp} excludes that CPA, and CPA is entered separately as ${verifiedPremium?.cpa}; their sum equals printed Net(B).` : niaCertified ? `New India separately verified owner-driver CPA ${niaCpa} is excluded from canonical TP ${verifiedPremium?.tp}; paid-driver LL stays within TP. Printed mixed 18%/5% GST ${verified.commercialPremium.gst} is not recalculated at 18% of net.` :PRODUCT_VARIANT_PARSERS.has(verified.parserId) ? (verified.parserId==="sbi_general_private_car_package_native_pdf"
        ? "SBI General Private Car Package: printed basic OD, NCB discount (if applicable), itemized OD add-ons, third-party basic and separate owner-driver CPA are independently reconciled. Canonical Motor uses basic OD after NCB so discounts and add-ons are not double-counted. Net, GST and rounded payable are checked against the insurer PDF."
        : verified.parserId==="hdfc_ergo_two_wheeler_tp_native_pdf"
        ? "HDFC ERGO two-wheeler liability-only: printed TP ₹ total, rounded IGST and CPA waiver validated. Petrol was resolved from the certified Honda Activa-3G 109cc model family; the policy does not print fuel."
        : verified.parserId==="go_digit_two_wheeler_od_native_pdf" ? "Digit Two-Wheeler standalone OD: newly issued TP and CPA are zero. Earlier ICICI TP validity is a policy reference, not new TP premium. Parts Depreciation Protect is opted without a separately itemized premium; no add-on charge was fabricated." : "Liability-only policy: OD, IDV and owner-driver CPA are zero. United tractor paid-driver liability remains inside TP; the separately disclosed stamp charge does not increase gross.") : "Owner-driver PA and paid-driver liabilities are retained inside printed TP; do not add CPA a second time."} Confirm vehicle class, registration, policy dates, premiums and all other fields before booking.${yearFallbackNote}${niaProvisionalRtoNote}${iffcoProvisionalNote}${iffcoRegisteredRtoNote}${iffcoFuelNote}`
      : verified && verified.premium
      ? `Policy Intake ${id} — n8n validated ${verified.premium.tataAig ? "Tata AIG private car" : "ICICI 3005"} PDF. Review every prefilled value before booking.
PDF premium reconciliation: Printed Basic OD ${verified.premium.basicOd} + OD add-ons ${addOnTotal} - validated NCB/OD deductions ${verified.premium.odDeductions??0} = Total OD ${verified.premium.totalOd}; net-of-deductions Basic OD entered for onboarding ${verifiedPremium?.od??"unavailable"}. TP ${verified.premium.basicTp}, CPA ${verified.premium.cpa}, Net ${verified.premium.net}, GST ${verified.premium.tax}, Gross ${verified.premium.gross}.
Third Party period: ${tpStart||"unavailable"} to ${tpExpiry||"unavailable"}. ${verified.premium.tataAig ? "Tata AIG issuance date is taken from the current signed policy PDF timestamp when it matches the printed receipt under the configured insurer rule. Non-owner-driver paid-liability amounts are allocated to the TP form bucket, not CPA." : ""} Verify separate TP/CPA dates, policy class/product, identity, commercial rates and unmatched PDF fields manually.${yearFallbackNote}`
      : `Policy Intake ${id}`,
  };
  // Preserve the long-standing generic OCR default. A positive owner-driver
  // CPA is opted-in only for a separately validated n8n premium breakdown.
  if(verifiedPremium)draft.cpaOpted=verifiedPremium.cpaOpted;
  if(existingDraft?.draft_payload && verified?.replaceExistingDraft){
    // Reparse is an explicit reset: a successful current-PDF parse replaces
    // every old draft field, including stale operator edits. The previous
    // revision remains observable through the monotonically increasing CAS.
    const {data:updated,error:updateError}=await admin.from("policy_intake_onboarding_drafts")
      .update({draft_payload:draft,revision:existingDraft.revision+1,
        updated_by_profile_id:reviewer.id,updated_at:new Date().toISOString()})
      .eq("intake_id",id).eq("revision",existingDraft.revision)
      .select("revision").maybeSingle<{revision:number}>();
    if(updateError||!updated)return{ok:false,error:"The saved draft changed during reparse. Refresh and run Reparse & Replace again."};
    if(!await markFreshParseForReview())return{ok:false,error:"The draft was replaced but the review queue could not be refreshed. Reload this Intake before booking."};
    return{ok:true,draft,draftRevision:updated.revision,
      matchedCustomerId:masterIdentity&&sameInsuredIdentity(masterIdentity.name,draft.insuredName)?masterIdentity.id:null,
      existingDraft:true};
  }
  if(existingDraft?.draft_payload){
    // Operator explicitly requested reapplying only missing verified fields.
    // Never replace a nonempty saved value; use optimistic revision control.
    const original=existingDraft.draft_payload;
    const confirmedSigning=verified?.reviewerConfirmedSigningDate;
    if(confirmedSigning && (
      existingDraft.revision!==confirmedSigning.expectedDraftRevision
      || original.issuanceDate!==confirmedSigning.expectedPreviousDate
      || !verified?.fillEmptyFields
    )) return{ok:false,error:"The saved issuance date changed. Reload and confirm the new comparison; nothing was overwritten."};
    const supplemented={...original};
    // The older allowlist left the entire policy/premium section blank on
    // legacy drafts, so correcting the issue date simply exposed another
    // booking error. Complete ONLY blank fields from this reverified PDF.
    const fillable:(keyof PolicyIntakeDraft)[]=[
      "insuredName","vehicleClass","make","model","fuelType","capacity",
      "rtoState","rtoName","policyProduct","manufacturingYear","issuanceDate",
      "registrationNo","chassisNo","engineNo","policyNo","insurerId",
      "validFrom","validUpto","tpValidUpto","idv","od","addOnPremium","tp","cpa",
    ];
    const dateReview=verified?.reviewedIssueDateReplacement;
    if(dateReview && (
      existingDraft.revision!==dateReview.expectedRevision
      || original.issuanceDate!==dateReview.expectedPrevious
      || !verifiedIssuanceDate
      || policyDateDecision(verifiedIssuanceDate)==="invalid"
      || policyDateDecision(verifiedIssuanceDate)==="future"
      || !verified?.fields.some(f=>f.key==="policy_issuance_date"&&f.value===verifiedIssuanceDate)
    ))return{ok:false,error:"The saved draft revision, previous issue date or verified PDF changed. Refresh the date comparison before applying the correction."};
    let changed=false;
    const autoDate=verified?.autoAcceptedIssuanceDate;
    // Explicit insurer-scoped business rule: correct even a stale saved
    // issuance date, but preserve its former value and document hash in the
    // existing audited revision-CAS draft. Do not change booked policies.
    if(autoDate && original.issuanceDate!==autoDate.date){
      supplemented.issuanceDate=autoDate.date;
      supplemented.remarks=(original.remarks||"")
        +"\nAUTO_TATA_ISSUANCE_DATE: "+(original.issuanceDate||"(blank)")
        +" -> "+autoDate.date
        +" under signing/receipt business rule; source PDF SHA-256 "
        +autoDate.documentSha256+". Applied under the configured Tata AIG issuance-date rule.";
      changed=true;
    }
    if(dateReview && original.issuanceDate!==verifiedIssuanceDate){
      supplemented.issuanceDate=verifiedIssuanceDate;
      changed=true;
    }
    if(confirmedSigning && original.issuanceDate!==confirmedSigning.date){
      supplemented.issuanceDate=confirmedSigning.date;
      supplemented.remarks=(original.remarks||"")
        +"\nReviewer confirmed proposed PDF signing date "+confirmedSigning.date
        +" against the original policy; document SHA-256 "+confirmedSigning.documentSha256
        +". Certificate chain is not independently trusted; booking needs normal approval.";
      changed=true;
    }
    // Reconcile ONLY the recognized old auto-generated NIA premium split.
    // The older parser placed printed TP (including PA) into canonical TP
    // and wrote CPA=0/No. It must not turn a previously verified PA policy
    // into zero CPA. Preserve any genuine operator edits and use draft CAS.
    const oldNiaMoney=niaCertified && verified?.commercialPremium
      && verifiedPremium?.cpaOpted==="Yes"
      && original.remarks.includes("independently validated commercial-motor PDF (new_india_cv_native_pdf)")
      && original.remarks.includes("Printed OD "+verified.commercialPremium.od+", TP including liabilities "+verified.commercialPremium.tp+",")
      && Number(original.od)===verified.commercialPremium.od
      && Number(original.tp)===verified.commercialPremium.tp
      && Number(original.cpa)===0 && original.cpaOpted==="No"
      && Number(original.addOnPremium||"0")===0;
    if(oldNiaMoney){
      supplemented.tp=verifiedPremium!.tp;
      supplemented.cpa=verifiedPremium!.cpa;
      supplemented.cpaOpted="Yes";
      supplemented.cpaValidUpto=tpExpiry;
      supplemented.remarks=(supplemented.remarks||"")
        +"\nNIA_VERIFIED_CPA_RECONCILIATION: prior source-generated unsplit TP "
        +original.tp+" -> "+verifiedPremium!.tp+" TP plus "+verifiedPremium!.cpa
        +" independently printed owner-driver CPA; mixed GST unchanged.";
      changed=true;
    }
    for(const key of fillable){
      // CPA amount and opt-in form a pair in the booking engine. Never
      // silently fill a positive PDF CPA amount while an older draft
      // explicitly says "No" to owner-driver CPA: canonical booking would
      // otherwise persist zero CPA despite a correct numeric comparison.
      // The reviewer must resolve BOTH fields together in Policy Onboarding.
      if(key==="cpa" && verifiedPremium && Number(verifiedPremium.cpa)>0
          && original.cpaOpted!=="Yes") continue;
      if(!String(original[key]??"").trim()&&String(draft[key]??"").trim()){
        (supplemented as unknown as Record<string,unknown>)[key]=draft[key];
        changed=true;
      }
    }
    if(supplemented.manufacturingYear && !original.manufacturingYear
        && yearEvidence?.source==="registration_year_fallback"
        && !supplemented.remarks.includes("REGISTRATION_YEAR_MANUFACTURING_FALLBACK:")){
      supplemented.remarks=(supplemented.remarks||"")+yearFallbackNote;
      changed=true;
    }
    if(niaProvisionalRtoField && supplemented.rtoName===niaProvisionalRtoField.value.trim()
       && !supplemented.remarks.includes("NIA_PROVISIONAL_RTO_FROM_ISSUING_OFFICE:")){
      supplemented.remarks=(supplemented.remarks||"")+niaProvisionalRtoNote;
      changed=true;
    }
    if(iffcoProvisionalRtoField
      && supplemented.rtoName===iffcoProvisionalRtoField.value.trim()
      && !supplemented.remarks.includes("IFFCO_PROVISIONAL_RTO_FROM_INSURED_ADDRESS:")){
      supplemented.remarks=(supplemented.remarks||"")+iffcoProvisionalNote;
      changed=true;
    }
    if(iffcoRegisteredRtoField
      &&supplemented.rtoName===iffcoRegisteredRtoField.value.trim()
      &&!supplemented.remarks.includes("IFFCO_REGISTERED_RTO_FROM_PLATE:")){
      supplemented.remarks=(supplemented.remarks||"")+iffcoRegisteredRtoNote;
      changed=true;
    }
    if(iffcoModelFuel && supplemented.fuelType==="Diesel"
      &&!supplemented.remarks.includes("IFFCO_FUEL_FROM_JCB_MODEL:")){
      supplemented.remarks=(supplemented.remarks||"")+iffcoFuelNote;
      changed=true;
    }
    if(!changed)return{ok:true,draft:original,draftRevision:existingDraft.revision,
      matchedCustomerId:verified
        ? masterIdentity&&sameInsuredIdentity(masterIdentity.name,original.insuredName)?masterIdentity.id:null
        : await resolveConfirmedIntakeCustomerId(admin,intake.customer_mobile,original.insuredName),
      existingDraft:true};
    const {data:updated,error:updateError}=await admin.from("policy_intake_onboarding_drafts")
      .update({draft_payload:supplemented,revision:existingDraft.revision+1,updated_by_profile_id:reviewer.id,updated_at:new Date().toISOString()})
      .eq("intake_id",id).eq("revision",existingDraft.revision)
      .select("revision").maybeSingle<{revision:number}>();
    if(updateError||!updated)return{ok:false,error:"The saved draft changed while you were applying verified blank fields. Reload and review before retrying."};
    return{ok:true,draft:supplemented,draftRevision:updated.revision,
      matchedCustomerId:verified
        ? masterIdentity&&sameInsuredIdentity(masterIdentity.name,supplemented.insuredName)?masterIdentity.id:null
        : await resolveConfirmedIntakeCustomerId(admin,intake.customer_mobile,supplemented.insuredName),
      existingDraft:true};
  }
  const {data:storedDraft,error:draftError}=await admin.from("policy_intake_onboarding_drafts").insert({intake_id:id,draft_payload:draft,revision:1,updated_by_profile_id:reviewer.id}).select("revision").single<{revision:number}>();
  if(draftError||!storedDraft)return{ok:false,error:"Policy Onboarding draft could not be prepared. Refresh and try again."};
  if(!await markFreshParseForReview())return{ok:false,error:"The draft was prepared but the review queue could not be refreshed. Reload this Intake before booking."};
  return{ok:true,draft,draftRevision:storedDraft.revision,matchedCustomerId,existingDraft:false};
}

export async function loadPolicyIntakeOnboardingDraft(id:string):Promise<PolicyIntakeHandoffResult>{
  await requirePolicyIntakeFinalizer(id); await requirePolicyIntakeReviewer(id); const admin=createSupabaseAdminClient();
  const {data:intake}=await admin.from("policy_intake_requests").select("id,intake_number,status,created_at,ocr_fields,ocr_parser_id,ocr_status,assigned_to_profile_id,matched_customer_id,customer_mobile").eq("id",id).maybeSingle<{id:string;intake_number:string;status:string;created_at:string;ocr_fields:PolicyIntakeOcrField[];ocr_parser_id:string|null;ocr_status:string;assigned_to_profile_id:string|null;matched_customer_id:string|null;customer_mobile:string}>();
  if(!intake||intake.status!=="in_review")return{ok:false,error:"This intake is not in review for Policy Onboarding."};
  const duplicateCheck=await loadPolicyIntakeDuplicateMatches(admin,[intake]);
  if(!duplicateCheck.ok)return{ok:false,error:duplicateCheck.error};
  if(duplicateCheck.matches.has(id))return{ok:false,error:"This policy intake is a duplicate and cannot continue in Policy Onboarding."};
  const {data,error}=await admin.from("policy_intake_onboarding_drafts").select("draft_payload,revision").eq("intake_id",id).maybeSingle<{draft_payload:PolicyIntakeDraft;revision:number}>();
  if(error||!data?.draft_payload)return{ok:false,error:"The saved Policy Onboarding draft is unavailable. Return to the intake and start review again."};
  // Restore only blank fields from verified, current-PDF NIA evidence. An older
  // draft may have lost the correct insured name because the former identity
  // selector only accepted ICICI page-1 provenance. Do not overwrite edits.
  const nia=intake.ocr_parser_id==="new_india_cv_native_pdf" && intake.ocr_status==="completed";
  let niaVerified=false;
  if(nia){
    const [queue,doc]=await Promise.all([
      admin.from("policy_intake_ai_processing_queue").select("state,document_id,parser_id,checks_passed,extraction_fingerprint")
        .eq("intake_id",id).maybeSingle<{state:string;document_id:string;parser_id:string;checks_passed:number;extraction_fingerprint:string|null}>(),
      admin.from("policy_intake_documents").select("id").eq("intake_id",id).eq("is_current",true)
        .maybeSingle<{id:string}>(),
    ]);
    niaVerified=Boolean(!queue.error&&!doc.error&&queue.data&&doc.data
      &&queue.data.document_id===doc.data.id
      &&queue.data.parser_id==="new_india_cv_native_pdf"
      &&queue.data.checks_passed===16 && queue.data.extraction_fingerprint
      &&["exception","verified"].includes(queue.data.state));
  }
  const verifiedNiaName=niaVerified
    ?selectVerifiedN8nInsuredDraftIdentity(intake.ocr_fields??[],null,"new_india_cv_native_pdf").name:"";
  const displayDraft={...data.draft_payload};
  if(verifiedNiaName && !displayDraft.insuredName.trim())displayDraft.insuredName=verifiedNiaName;
  // This field was populated by the old parser reading the following table
  // label ("FASTag ID:") as the missing registration authority. Clear only
  // that known invalid machine-generated value; never guess Gurgaon from
  // the policy issuing office or HR-00 from a registration prefix.
  if(niaVerified && /^FASTag ID:$/i.test(displayDraft.rtoName.trim()))displayDraft.rtoName="";
  const verifiedDraft=data.draft_payload.remarks?.includes("n8n validated ICICI 3005")===true;
  const identityName=verifiedDraft
    ? displayDraft.insuredName
    : niaVerified ? displayDraft.insuredName
      : ocrInsuredName(intake.ocr_fields??[])||displayDraft.insuredName;
  const masterIdentity=verifiedDraft
    ? await resolveMasterIntakeIdentity(admin,intake.matched_customer_id,intake.customer_mobile) : null;
  const matchedCustomerId=verifiedDraft
    ? masterIdentity&&sameInsuredIdentity(masterIdentity.name,identityName)?masterIdentity.id:null
    : await resolveConfirmedIntakeCustomerId(admin,intake.customer_mobile,identityName);
  return{ok:true,draft:displayDraft,draftRevision:data.revision,matchedCustomerId};
}

export async function savePolicyIntakeOnboardingDraft(id:string,expectedRevision:number,draft:PolicyIntakeDraft):Promise<PolicyIntakeDraftSaveResult>{
  await requirePolicyIntakeFinalizer(id); const reviewer=await requirePolicyIntakeReviewer(id); const admin=createSupabaseAdminClient();
  const {data:intake}=await admin.from("policy_intake_requests").select("status,assigned_to_profile_id").eq("id",id).maybeSingle<{status:string;assigned_to_profile_id:string|null}>();
  if(!intake||intake.status!=="in_review")return{ok:false,error:"This intake is no longer in review.",conflict:true};
  const {data,error}=await admin.from("policy_intake_onboarding_drafts")
    .update({draft_payload:draft,revision:expectedRevision+1,updated_by_profile_id:reviewer.id,updated_at:new Date().toISOString()})
    .eq("intake_id",id).eq("revision",expectedRevision).select("revision").maybeSingle<{revision:number}>();
  if(error)return{ok:false,error:"The Policy Onboarding draft could not be saved."};
  if(!data)return{ok:false,error:"This draft was updated elsewhere. Reload the latest version before continuing.",conflict:true};
  return{ok:true,revision:data.revision};
}
