"use server";

import type { PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";
import { loadPolicyIntakeDuplicateMatches } from "@/lib/policy-intake-duplicate";
import { buildPolicyOcrOnboardingUpdate } from "@/lib/policy-ocr-onboarding-apply";
import { selectPolicyIntakeCustomerMatch, type PolicyIntakeCustomerIdentityCandidate } from "@/lib/policy-intake-customer-match";
import { requirePolicyIntakeFinalizer, requirePolicyIntakeReviewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requireCapability } from "@/lib/master-data-server";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { isN8nWorkbenchPrimary, previewSemiAutoN8nExtraction } from "@/lib/policy-intake-semi-auto-n8n";
import type { N8nVerifiedPremiumBreakdown } from "@/lib/policy-intake-n8n-validation";
import { mapVerifiedN8nMotorPremium } from "@/lib/policy-n8n-onboarding-premium";
import { filterVerifiedN8nOnboardingFields } from "@/lib/policy-n8n-onboarding-fields";

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
  premium:N8nVerifiedPremiumBreakdown;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The client supplies only IDs + the reviewed fingerprint. We re-run n8n
 * against the current private PDF before creating a canonical editable draft.
 * No policy is booked; this is a deliberate, auditable reviewer handoff.
 */
export async function prepareVerifiedN8nIntakeHandoff(
  id:string, expectedDocumentId:string, expectedFingerprint:string, takeOver=false,
):Promise<PolicyIntakeHandoffResult> {
  if (!isN8nWorkbenchPrimary() || !UUID.test(id) || !UUID.test(expectedDocumentId)
      || !/^[a-f0-9]{64}$/i.test(expectedFingerprint)) {
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
  const parsed=await previewSemiAutoN8nExtraction(id);
  if(!parsed.ok)return{ok:false,error:parsed.error};
  if(parsed.preview.documentId!==expectedDocumentId
      || parsed.preview.fingerprint!==expectedFingerprint) {
    return{ok:false,error:"The n8n extraction changed after review. Run n8n again and check the new fields before continuing."};
  }
  if(parsed.preview.checksPassed!==13 || parsed.preview.warnings.length>0) {
    return{ok:false,error:"n8n validation warnings must be resolved before creating an onboarding draft."};
  }
  return preparePolicyIntakeHandoffInternal(id,takeOver===true,{
    documentId:expectedDocumentId,fields:parsed.preview.fields,premium:parsed.preview.premium,
  });
}

export async function preparePolicyIntakeHandoff(id:string,takeOver=false):Promise<PolicyIntakeHandoffResult> {
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
    if(intake.policy_type!=="motor" || !["processing","ready_for_review","in_review"].includes(intake.status))
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

  let assignmentQuery=admin.from("policy_intake_requests")
    .update({status:"in_review",assigned_to_profile_id:reviewer.id,attention_reason:null})
    .eq("id",id)
    .in("status",["ready_for_review","in_review","processing"]);
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
  if(existingDraft?.draft_payload){
    // A pre-existing operator draft must NEVER be overwritten by n8n.
    const identityName=verified
      ? existingDraft.draft_payload.insuredName // Manual saved identity only; never fall back to OCR for n8n handoff.
      : existingDraft.draft_payload.insuredName||ocrInsuredName(intake.ocr_fields??[]);
    const matchedCustomerId=await resolveConfirmedIntakeCustomerId(admin,intake.customer_mobile,identityName);
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
    registrationMode:"registered",
    current:{registrationNo:"",vehicleClass:"",make:"",model:"",fuelType:"",manufacturingYear:"",capacity:"",chassisNo:"",engineNo:"",rtoState:"",rtoName:"",policyProduct:"",idv:"",od:"",tp:"",cpa:"",policyNo:"",insurerId:"",validFrom:"",validUpto:""},
    fields:verified?filterVerifiedN8nOnboardingFields(verified.fields):(intake.ocr_fields??[]),
    manufacturers:manufacturerOptions,insurers,rcVerified:false,
  });
  // The document-derived insured_name is checked by n8n but may not be
  // proposed as onboarding identity. Request manual/approved master identity.
  const customerName=verified?"":mapped.next.insuredName?.trim()||"";
  // Canonical form computes net = Basic OD + add-ons + TP + CPA. The n8n
  // "od_premium" OCR field is *Total OD*, so never copy it directly into
  // the form's Basic OD field and then add add-ons again.
  const verifiedPremium=verified?mapVerifiedN8nMotorPremium(verified.premium):null;
  const addOnTotal=verifiedPremium?Number(verifiedPremium.addOnPremium):0;
  const tpStart=verified?.fields.find(field=>field.key==="third_party_start_date")?.value??"";
  const tpExpiry=verified?.fields.find(field=>field.key==="third_party_end_date")?.value??"";
  const matchedCustomerId=await resolveConfirmedIntakeCustomerId(admin,intake.customer_mobile,customerName);
  const intermediaryType=intake.lead_source_type==="posp"?"POSP":intake.lead_source_type==="misp"?"MISP":"SIBL / Partner";
  const draft:PolicyIntakeDraft={
    registrationMode:mapped.registrationMode,
    issuanceDate:new Date().toISOString().slice(0,10),rmName:"",intermediaryType,leadSource:intake.lead_source_name,intermediaryCode:intake.lead_source_code??"",businessLine:"Motor",
    registrationNo:mapped.next.registrationNo,insuredName:customerName,phoneNo:intake.customer_mobile,vehicleClass:mapped.next.vehicleClass,make:mapped.next.make,model:mapped.next.model,fuelType:mapped.next.fuelType,capacity:mapped.next.capacity,manufacturingYear:mapped.next.manufacturingYear,chassisNo:mapped.next.chassisNo,engineNo:mapped.next.engineNo,rtoState:mapped.next.rtoState,rtoName:mapped.next.rtoName,
    policyProduct:mapped.next.policyProduct,idv:mapped.next.idv,
    od:verifiedPremium?.od??mapped.next.od,
    tp:verifiedPremium?.tp??mapped.next.tp,
    ...(verifiedPremium?{addOnPremium:verifiedPremium.addOnPremium,tpValidUpto:tpExpiry}:{}),
    cpaOpted:"No",
    cpa:verifiedPremium?.cpa??mapped.next.cpa,
    policyNo:mapped.next.policyNo,insurerId:mapped.next.insurerId,validFrom:mapped.next.validFrom,validUpto:mapped.next.validUpto,
    payoutBasis:"NET",projectedOdPercent:"",projectedTpPercent:"",insurerScheme:"",payinBillNo:"",payinBilledAmount:"",payinBillDate:"",payinStatus:"Unbilled",retention:"",payoutOdPercent:"",payoutTpPercent:"",flatPayoutAmount:"",payoutStatus:"Pending",payoutDate:"",payoutVoucherNo:"",remarks:verified
      ? `Policy Intake ${id} — n8n validated ICICI 3005 PDF. Review every prefilled value before booking.
PDF premium reconciliation: Basic OD ${verified.premium.basicOd} + OD add-ons ${addOnTotal} = Total OD ${verified.premium.totalOd}; TP ${verified.premium.basicTp}, CPA ${verified.premium.cpa}, Net ${verified.premium.net}, GST ${verified.premium.tax}, Gross ${verified.premium.gross}.
Third Party period: ${tpStart||"unavailable"} to ${tpExpiry||"unavailable"}. Verify separate TP/CPA dates, policy class/product, identity, commercial rates and unmatched PDF fields manually.`
      : `Policy Intake ${id}`,
  };
  // Preserve the long-standing generic OCR default. A positive owner-driver
  // CPA is opted-in only for a separately validated n8n premium breakdown.
  if(verifiedPremium)draft.cpaOpted=verifiedPremium.cpaOpted;
  const {data:storedDraft,error:draftError}=await admin.from("policy_intake_onboarding_drafts").insert({intake_id:id,draft_payload:draft,revision:1,updated_by_profile_id:reviewer.id}).select("revision").single<{revision:number}>();
  if(draftError||!storedDraft)return{ok:false,error:"Policy Onboarding draft could not be prepared. Refresh and try again."};
  return{ok:true,draft,draftRevision:storedDraft.revision,matchedCustomerId,existingDraft:false};
}

export async function loadPolicyIntakeOnboardingDraft(id:string):Promise<PolicyIntakeHandoffResult>{
  await requirePolicyIntakeFinalizer(id); await requirePolicyIntakeReviewer(id); const admin=createSupabaseAdminClient();
  const {data:intake}=await admin.from("policy_intake_requests").select("id,intake_number,status,created_at,ocr_fields,assigned_to_profile_id,matched_customer_id,customer_mobile").eq("id",id).maybeSingle<{id:string;intake_number:string;status:string;created_at:string;ocr_fields:PolicyIntakeOcrField[];assigned_to_profile_id:string|null;matched_customer_id:string|null;customer_mobile:string}>();
  if(!intake||intake.status!=="in_review")return{ok:false,error:"This intake is not in review for Policy Onboarding."};
  const duplicateCheck=await loadPolicyIntakeDuplicateMatches(admin,[intake]);
  if(!duplicateCheck.ok)return{ok:false,error:duplicateCheck.error};
  if(duplicateCheck.matches.has(id))return{ok:false,error:"This policy intake is a duplicate and cannot continue in Policy Onboarding."};
  const {data,error}=await admin.from("policy_intake_onboarding_drafts").select("draft_payload,revision").eq("intake_id",id).maybeSingle<{draft_payload:PolicyIntakeDraft;revision:number}>();
  if(error||!data?.draft_payload)return{ok:false,error:"The saved Policy Onboarding draft is unavailable. Return to the intake and start review again."};
  const identityName=data.draft_payload.remarks?.includes("n8n validated ICICI 3005")
  ? data.draft_payload.insuredName
  : ocrInsuredName(intake.ocr_fields??[])||data.draft_payload.insuredName;
  const matchedCustomerId=await resolveConfirmedIntakeCustomerId(admin,intake.customer_mobile,identityName);return{ok:true,draft:data.draft_payload,draftRevision:data.revision,matchedCustomerId};
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