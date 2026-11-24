"use server";

import { revalidatePath } from "next/cache";
import { convertLifeHealthCaseForVerifiedActor } from "@/lib/life-health-case-conversion-engine";
import { requirePolicyCreator, requireLifeTeamSalesCaseWrite } from "@/lib/policy-access-server";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { requireOperationsHeadRecordOwnership } from "@/lib/operations-head-record-authorization";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { resolvePolicyIntermediarySource } from "@/lib/policy-intermediary-source";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { consumePolicyDateApproval, recordPreviousMonthPolicyUpload, linkConsumedPolicyDateApproval } from "@/lib/policy-date-approval-server";
import { policyDateDecision } from "@/lib/policy-date-rule";

const DOCUMENT_BUCKET = "policy-documents";
// Leave headroom under the 25 MB Next.js server-action request limit.
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const DOCUMENT_TYPES = new Set(["proposal_form", "benefit_illustration", "premium_receipt", "policy_copy", "kyc", "other_document"]);
const PAYMENT_FREQUENCIES = new Set(["Monthly", "Quarterly", "Half Yearly", "Annually", "One Time"]);
const PAYMENT_MODES = new Set(["Cheque", "NEFT/RTGS", "UPI", "Credit/Debit Card", "Net Banking"]);
const COMMERCIAL_BASES = new Set(["NET_PREMIUM_PERCENT", "FIXED_AMOUNT"]);

export type LifeHealthCaseResult = | { ok: true; caseId: string; caseNumber: string } | { ok: false; error: string };
export type LifeHealthDocumentResult = | { ok: true; documentId: string } | { ok: false; error: string };
export type LifeHealthConversionResult = | { ok: true; policyId: string; policyCode: string } | { ok: false; error: string };

type CustomerIdentityRow = { id: string; contact_name: string; company_name: string | null };
type CaseDocumentRow = { id:string; document_type:string; file_name:string; storage_bucket:string; storage_path:string; mime_type:string|null; file_size:number|null; uploaded_by:string|null };
type CaseRow = { id:string; case_number:string; business_line:"Life"|"Health"; status:string; sourcing_date:string; customer_id:string; insurance_company_id:string; product_name:string; proposal_number:string; premium_paying_term:string|null; policy_duration:string|null; payment_frequency:string; payment_mode:string; premium_amount:number; intermediary_id:string|null; intermediary_type:string|null; intermediary_code:string|null; lead_source:string|null; rm_employee_id:string|null; rm_name:string|null; rm_code:string|null; remarks:string|null; details:Record<string,unknown>|null; final_policy_id:string|null };
type LifeHealthCommercial = { payinBasis:"NET_PREMIUM_PERCENT"|"FIXED_AMOUNT"; payinPercent:number; payinFixedAmount:number; insurerSchemeAmount:number; payoutBasis:"NET_PREMIUM_PERCENT"|"FIXED_AMOUNT"; payoutPercent:number; payoutFixedAmount:number; payinEntered:boolean; payoutEntered:boolean; payinBase:number; totalPayin:number; tdsPercent:number; tdsAmount:number; payinAfterTds:number; totalPayout:number; retention:number };

const clean=(value:unknown)=>String(value??"").trim();
const normalizePhone=(value:string)=>value.replace(/\D/g,"").slice(-10);
const normalizePolicyNumber=(value:string)=>value.trim().toUpperCase().replace(/\s+/g,"");
const validDate=(value:string)=>/^\d{4}-\d{2}-\d{2}$/.test(value);
const numberOrNull=(value:unknown)=>{const normalized=clean(value).replace(/,/g,"");if(!normalized)return null;const parsed=Number(normalized);return Number.isFinite(parsed)?parsed:null};
const numberOrZero=(value:unknown)=>numberOrNull(value)??0;
const customerCode=()=>`CUS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const caseNumber=()=>`LH-${new Date().toISOString().replace(/[-:TZ.]/g,"").slice(0,14)}-${Math.random().toString(36).slice(2,6).toUpperCase()}`;
const policyCode=()=>`POL-${new Date().toISOString().replace(/[-:TZ.]/g,"").slice(0,17)}`;
function safeFileName(name:string){return name.trim().replace(/[^a-zA-Z0-9._-]+/g,"-").replace(/-+/g,"-")||"document"}
function customerIdentityName(row:CustomerIdentityRow){return clean(row.company_name||row.contact_name).replace(/\s+/g," ").toLowerCase()}
function buildCommercial(formData:FormData,premiumAmount:number):{commercial:LifeHealthCommercial|null;error?:string}{
  const payinBasis=clean(formData.get("payinBasis"))||"NET_PREMIUM_PERCENT",payoutBasis=clean(formData.get("payoutBasis"))||"NET_PREMIUM_PERCENT";
  if(!COMMERCIAL_BASES.has(payinBasis)||!COMMERCIAL_BASES.has(payoutBasis))return{commercial:null,error:"Select a valid pay-in and payout basis."};
  const payinPercentEntered=clean(formData.get("payinPercent"))!=="",payinFixedEntered=clean(formData.get("payinFixedAmount"))!=="",schemeEntered=clean(formData.get("insurerSchemeAmount"))!=="",payoutPercentEntered=clean(formData.get("payoutPercent"))!=="",payoutFixedEntered=clean(formData.get("payoutFixedAmount"))!=="";
  const payinPercent=numberOrZero(formData.get("payinPercent")),payinFixedAmount=numberOrZero(formData.get("payinFixedAmount")),insurerSchemeAmount=numberOrZero(formData.get("insurerSchemeAmount")),payoutPercent=numberOrZero(formData.get("payoutPercent")),payoutFixedAmount=numberOrZero(formData.get("payoutFixedAmount"));
  if(payinPercent<0||payinPercent>100||payoutPercent<0||payoutPercent>100)return{commercial:null,error:"Pay-in and payout percentages must be between 0 and 100."};
  if(payinFixedAmount<0||insurerSchemeAmount<0||payoutFixedAmount<0)return{commercial:null,error:"Commercial amounts cannot be negative."};
  const payinEntered=payinPercentEntered||payinFixedEntered||schemeEntered,payoutEntered=payoutPercentEntered||payoutFixedEntered;
  const payinBase=payinBasis==="FIXED_AMOUNT"?payinFixedAmount:premiumAmount*payinPercent/100,totalPayin=payinBase+insurerSchemeAmount,tdsPercent=10,tdsAmount=totalPayin*tdsPercent/100,payinAfterTds=totalPayin-tdsAmount,totalPayout=payoutBasis==="FIXED_AMOUNT"?payoutFixedAmount:premiumAmount*payoutPercent/100,retention=payinAfterTds-totalPayout;
  return{commercial:{payinBasis:payinBasis as LifeHealthCommercial["payinBasis"],payinPercent,payinFixedAmount,insurerSchemeAmount,payoutBasis:payoutBasis as LifeHealthCommercial["payoutBasis"],payoutPercent,payoutFixedAmount,payinEntered,payoutEntered,payinBase,totalPayin,tdsPercent,tdsAmount,payinAfterTds,totalPayout,retention}};
}
function commercialFromDetails(details:Record<string,unknown>|null):LifeHealthCommercial|null{const value=details?.commercial;if(!value||typeof value!=="object"||Array.isArray(value))return null;const raw=value as Record<string,unknown>,payinBasis=clean(raw.payinBasis),payoutBasis=clean(raw.payoutBasis);if(!COMMERCIAL_BASES.has(payinBasis)||!COMMERCIAL_BASES.has(payoutBasis))return null;return{payinBasis:payinBasis as LifeHealthCommercial["payinBasis"],payinPercent:numberOrZero(raw.payinPercent),payinFixedAmount:numberOrZero(raw.payinFixedAmount),insurerSchemeAmount:numberOrZero(raw.insurerSchemeAmount),payoutBasis:payoutBasis as LifeHealthCommercial["payoutBasis"],payoutPercent:numberOrZero(raw.payoutPercent),payoutFixedAmount:numberOrZero(raw.payoutFixedAmount),payinEntered:Boolean(raw.payinEntered),payoutEntered:Boolean(raw.payoutEntered),payinBase:numberOrZero(raw.payinBase),totalPayin:numberOrZero(raw.totalPayin),tdsPercent:numberOrZero(raw.tdsPercent)||10,tdsAmount:numberOrZero(raw.tdsAmount),payinAfterTds:numberOrZero(raw.payinAfterTds),totalPayout:numberOrZero(raw.totalPayout),retention:numberOrZero(raw.retention)}}

async function uploadCaseDocumentInternal(admin:ReturnType<typeof createSupabaseAdminClient>,profileId:string,caseId:string,documentType:string,fileValue:File){
  if(!DOCUMENT_TYPES.has(documentType))return{ok:false as const,error:"Unsupported Life/Health document type."};
  if(fileValue.size<=0)return{ok:false as const,error:"Choose a document to upload."};
  if(fileValue.size>MAX_FILE_SIZE)return{ok:false as const,error:"Each document must be 4 MB or smaller."};
  if(!ALLOWED_MIME_TYPES.has(fileValue.type))return{ok:false as const,error:"Upload a PDF, JPG, PNG or WebP document."};
  const fileName=safeFileName(fileValue.name),storagePath=`life-health-cases/${caseId}/${documentType}/${crypto.randomUUID()}-${fileName}`,bytes=Buffer.from(await fileValue.arrayBuffer());
  const{error:storageError}=await admin.storage.from(DOCUMENT_BUCKET).upload(storagePath,bytes,{contentType:fileValue.type,upsert:false});if(storageError){console.error("Life/Health case storage upload failed",{caseId,documentType,code:storageError.name,message:storageError.message});return{ok:false as const,error:`Document storage rejected the upload: ${storageError.message}`}}
  const{data:existing}=await admin.from("life_health_case_documents").select("id,storage_bucket,storage_path").eq("case_id",caseId).eq("document_type",documentType).maybeSingle<{id:string;storage_bucket:string;storage_path:string}>();
  const values={file_name:fileValue.name,storage_bucket:DOCUMENT_BUCKET,storage_path:storagePath,mime_type:fileValue.type,file_size:fileValue.size,uploaded_by:profileId,updated_at:new Date().toISOString()};
  if(existing){const{error}=await admin.from("life_health_case_documents").update(values).eq("id",existing.id);if(error){await admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);return{ok:false as const,error:"The uploaded document record could not be saved."}}if(existing.storage_bucket===DOCUMENT_BUCKET&&existing.storage_path&&existing.storage_path!==storagePath)await admin.storage.from(DOCUMENT_BUCKET).remove([existing.storage_path]);return{ok:true as const,documentId:existing.id}}
  const{data:row,error}=await admin.from("life_health_case_documents").insert({case_id:caseId,document_type:documentType,...values}).select("id").single<{id:string}>();if(error||!row){await admin.storage.from(DOCUMENT_BUCKET).remove([storagePath]);return{ok:false as const,error:"The uploaded document record could not be saved."}}return{ok:true as const,documentId:row.id};
}

export async function createLifeHealthCase(formData:FormData):Promise<LifeHealthCaseResult>{
  const profile=await requirePolicyCreator(clean(formData.get("intermediaryCode"))),admin=createSupabaseAdminClient(),commercialAccess=canAccessPolicyCommercials(profile, profile.role === "operations_head_life");
  const businessLine=clean(formData.get("businessLine")),sourcingDate=clean(formData.get("sourcingDate")),intermediaryType=clean(formData.get("intermediaryType")),intermediaryCode=clean(formData.get("intermediaryCode")),leadSource=clean(formData.get("leadSource")),sourceId=clean(formData.get("sourceId")),rmName=clean(formData.get("rmName")),insuredName=clean(formData.get("insuredName")).replace(/\s+/g," "),phone=normalizePhone(clean(formData.get("phone"))),address=clean(formData.get("address")),insurerId=clean(formData.get("insurerId")),productName=clean(formData.get("productName")),proposalNumber=clean(formData.get("proposalNumber")).toUpperCase(),ppt=clean(formData.get("ppt")),pd=clean(formData.get("pd")),paymentFrequency=clean(formData.get("paymentFrequency")),paymentMode=clean(formData.get("paymentMode")),premiumAmount=numberOrNull(formData.get("premiumAmount")),remarks=clean(formData.get("remarks"));
  if(businessLine!=="Life"&&businessLine!=="Health")return{ok:false,error:"Select Life or Health in Policy type."};if(!validDate(sourcingDate))return{ok:false,error:"Enter a valid proposal date in Section 01."};if(!intermediaryType||!intermediaryCode||!leadSource||!sourceId)return{ok:false,error:"Complete Intermediary type and Lead source in Section 01."};if(!rmName)return{ok:false,error:"The selected source does not have an RM assignment. Update the intermediary master before creating the case."};if(!insurerId)return{ok:false,error:"Select the insurer."};if(!productName)return{ok:false,error:"Enter the product name."};if(!proposalNumber)return{ok:false,error:"Enter the Case / Proposal Number."};if(!PAYMENT_FREQUENCIES.has(paymentFrequency))return{ok:false,error:"Select a valid payment frequency."};if(!PAYMENT_MODES.has(paymentMode))return{ok:false,error:"Select a valid payment mode."};if(premiumAmount===null||premiumAmount<0)return{ok:false,error:"Enter a valid premium amount."};
  const commercialResult:{commercial:LifeHealthCommercial|null;error?:string}=commercialAccess?buildCommercial(formData,premiumAmount):{commercial:null};if(commercialResult.error)return{ok:false,error:commercialResult.error};
  const sourceResolution=await resolvePolicyIntermediarySource({intermediaryType,intermediaryCode,leadSource});if(!sourceResolution.ok)return{ok:false,error:sourceResolution.error};
  const{data:intermediary,error:intermediaryError}=await admin.from("intermediaries").select("id,application_id,intermediary_code,display_name,mobile,associate_employee_id").eq("id",sourceId).maybeSingle<{id:string;application_id:string|null;intermediary_code:string|null;display_name:string;mobile:string|null;associate_employee_id:string|null}>();if(intermediaryError||!intermediary)return{ok:false,error:"The selected lead source is no longer available. Refresh the page and try again."};if(clean(intermediary.intermediary_code)!==intermediaryCode||clean(intermediary.display_name).toLowerCase()!==leadSource.toLowerCase())return{ok:false,error:"Lead source details changed while this form was open. Refresh and select the source again."};
  // Partner/POSP/MISP current ownership is authoritative in the onboarding profile.
  // Direct intermediary assignments can be stale after an RM transfer. Never
  // resolve the booked RM from a submitted name/code string.
  const {data:currentOwner,error:ownerError}=intermediary.application_id
    ? await admin.from("posp_misp_onboarding_profiles").select("associate_employee_id").eq("application_id",intermediary.application_id).maybeSingle<{associate_employee_id:string|null}>()
    : {data:null,error:null};
  if(ownerError)return{ok:false,error:"Current RM assignment could not be verified. Refresh the source and try again."};
  const rmEmployeeId=currentOwner ? currentOwner.associate_employee_id : intermediary.associate_employee_id;
  if(!rmEmployeeId)return{ok:false,error:"This source does not have a current RM assignment. Update the intermediary master before booking."};
  const {data:currentRm,error:rmLookupError}=await admin.from("employees").select("id,full_name,employee_code,employment_status").eq("id",rmEmployeeId).maybeSingle<{id:string;full_name:string;employee_code:string;employment_status:string}>();
  if(rmLookupError||!currentRm||currentRm.employment_status!=="active")return{ok:false,error:"The current source RM is unavailable or inactive. Reassign the source before booking."};
  let customerId="",createdCustomerId:string|null=null,createdCaseId:string|null=null;const uploadedPaths:string[]=[];
  try{
    if(!insuredName)return{ok:false,error:"Enter the client / proposer name."};if(!/^[6-9][0-9]{9}$/.test(phone))return{ok:false,error:"Enter a valid 10 digit Indian mobile number."};const{data:matches,error}=await admin.from("customers").select("id,contact_name,company_name").eq("phone",phone).limit(10).returns<CustomerIdentityRow[]>();if(error)return{ok:false,error:"Customer validation is temporarily unavailable. Please try again."};const exact=(matches??[]).filter(row=>customerIdentityName(row)===insuredName.toLowerCase());if(exact.length>0)return{ok:false,error:"A customer with the same mobile number already exists. Life and Health onboarding requires a new customer record; use a different mobile number or review the existing customer first."};const{data:created,error:createError}=await admin.from("customers").insert({customer_code:customerCode(),company_name:null,contact_name:insuredName,phone,email:null,address:address||null,address_street:address||null,customer_type:"individual",partner_type:"individual_proprietor",source:leadSource,creation_channel:"policy_onboarding",created_by:profile.id}).select("id").single<{id:string}>();if(createError||!created)return{ok:false,error:"We couldn't create the customer record. Review the customer details and try again."};customerId=created.id;createdCustomerId=created.id;
    const details:Record<string,unknown>={source:"add_policy",customer_mode:"new",customer_address:address||null};if(commercialResult.commercial)details.commercial=commercialResult.commercial;
    const generatedCaseNumber=caseNumber();const{data:createdCase,error:caseError}=await admin.from("life_health_cases").insert({case_number:generatedCaseNumber,business_line:businessLine,status:"awaiting_policy",sourcing_date:sourcingDate,customer_id:customerId,insurance_company_id:insurerId,product_name:productName,proposal_number:proposalNumber,premium_paying_term:ppt||null,policy_duration:pd||null,payment_frequency:paymentFrequency,payment_mode:paymentMode,premium_amount:premiumAmount,intermediary_id:sourceId,intermediary_type:sourceResolution.source.intermediaryType,intermediary_code:sourceResolution.source.intermediaryCode,lead_source:sourceResolution.source.leadSource,intermediary_mobile:intermediary.mobile||null,rm_employee_id:rmEmployeeId,rm_name:currentRm.full_name,rm_code:currentRm.employee_code,remarks:remarks||null,details,created_by:profile.id}).select("id").single<{id:string}>();if(caseError||!createdCase)throw new Error(caseError?.message||"case_insert_failed");createdCaseId=createdCase.id;
    const uploads:Array<[string,FormDataEntryValue|null]>=[["policy_copy",formData.get("policyCopy")],["proposal_form",formData.get("proposalForm")],["kyc",formData.get("kyc")],["other_document",formData.get("otherDocument")],["benefit_illustration",formData.get("benefitIllustration")],["premium_receipt",formData.get("premiumReceipt")]];for(const[type,value]of uploads){if(!(value instanceof File)||value.size<=0)continue;const result=await uploadCaseDocumentInternal(admin,profile.id,createdCase.id,type,value);if(!result.ok)throw new Error(result.error);const{data:doc}=await admin.from("life_health_case_documents").select("storage_path").eq("id",result.documentId).maybeSingle<{storage_path:string}>();if(doc?.storage_path)uploadedPaths.push(doc.storage_path)}
    revalidatePath("/policies");revalidatePath("/policies/life-health-cases");return{ok:true,caseId:createdCase.id,caseNumber:generatedCaseNumber};
  }catch(error){if(createdCaseId)await admin.from("life_health_cases").delete().eq("id",createdCaseId);if(uploadedPaths.length)await admin.storage.from(DOCUMENT_BUCKET).remove(uploadedPaths);if(createdCustomerId)await admin.from("customers").delete().eq("id",createdCustomerId);return{ok:false,error:error instanceof Error&&error.message&&!error.message.includes("insert")?error.message:"We couldn't create the Life/Health case. Your form is still intact; please try again."}}
}

export async function uploadLifeHealthCaseDocument(formData:FormData):Promise<LifeHealthDocumentResult>{
  const caseId=clean(formData.get("caseId")),documentType=clean(formData.get("documentType")),file=formData.get("file");
  if(!caseId)return{ok:false,error:"The case reference is missing."};
  if(!(file instanceof File))return{ok:false,error:"Choose a document to upload."};
  if(file.size<=0)return{ok:false,error:"Choose a non-empty document."};
  if(file.size>MAX_FILE_SIZE)return{ok:false,error:"Document must be 4 MB or smaller."};
  if(!ALLOWED_MIME_TYPES.has(file.type))return{ok:false,error:"Upload a PDF, JPG, PNG or WebP document."};
  try{
    const {profile:requester}=await getAuthenticatedProfile(await getServerAccessToken());
    if(!requester?.id)return{ok:false,error:"Your session has expired. Sign in again and retry."};
    const profile=requester.role==="operations_head_life"
      ? await requireOperationsHeadRecordOwnership("life_health_case",caseId)
      : await requirePolicyCreator();
    await requireLifeTeamSalesCaseWrite(profile,caseId);
    const admin=createSupabaseAdminClient();
    const{data:caseRow,error}=await admin.from("life_health_cases").select("id,final_policy_id,status").eq("id",caseId).maybeSingle<{id:string;final_policy_id:string|null;status:string}>();
    if(error){console.error("Life/Health upload case lookup failed",{caseId,message:error.message});return{ok:false,error:"Could not verify this case. Please retry."}}
    if(!caseRow)return{ok:false,error:"This case is no longer available."};
    if(caseRow.final_policy_id||caseRow.status==="rejected")return{ok:false,error:"Issued or rejected cases cannot accept uploads."};
    const result=await uploadCaseDocumentInternal(admin,profile.id,caseId,documentType,file);
    if(!result.ok)return result;
    revalidatePath(`/policies/life-health-cases/${caseId}`);
    return result;
  }catch(cause){
    const message=cause instanceof Error?cause.message:String(cause);
    console.error("Life/Health case document upload failed",{caseId,documentType,message});
    if(message.includes("operations_head_record_access_denied"))return{ok:false,error:"You do not have permission to upload documents for this case. Contact your administrator."};
    if(message.includes("JWT")||message.includes("session")||message.includes("Authentication"))return{ok:false,error:"Your session may have expired. Sign in again and retry."};
    return{ok:false,error:"Document upload failed on the server. Please retry or contact support with the case reference."};
  }
}

export async function deleteLifeHealthCaseDocument(caseId:string,documentId:string):Promise<{ok:true}|{ok:false;error:string}>{
  if(!caseId||!documentId)return{ok:false,error:"The document reference is missing."};
  const {profile:requester}=await getAuthenticatedProfile(await getServerAccessToken());
  if(requester?.role==="operations_head_life"){
    await requireOperationsHeadRecordOwnership("life_health_case",caseId);
  }else{
    const profile=await requirePolicyCreator();
    await requireLifeTeamSalesCaseWrite(profile,caseId);
  }
  const admin=createSupabaseAdminClient();
  const{data:caseRow,error:caseError}=await admin.from("life_health_cases").select("id,final_policy_id,status").eq("id",caseId).maybeSingle<{id:string;final_policy_id:string|null;status:string}>();
  if(caseError||!caseRow)return{ok:false,error:"This case is no longer available."};
  if(caseRow.final_policy_id||caseRow.status==="rejected")return{ok:false,error:"Issued or rejected cases cannot have documents deleted."};
  const{data:document,error:documentError}=await admin.from("life_health_case_documents").select("id,storage_bucket,storage_path").eq("case_id",caseId).eq("id",documentId).maybeSingle<{id:string;storage_bucket:string;storage_path:string}>();
  if(documentError||!document)return{ok:false,error:"The document could not be found in this case."};
  if(document.storage_bucket!==DOCUMENT_BUCKET||!document.storage_path.startsWith(`life-health-cases/${caseId}/`))return{ok:false,error:"This document has an invalid storage reference."};
  const{error:storageError}=await admin.storage.from(DOCUMENT_BUCKET).remove([document.storage_path]);
  if(storageError)return{ok:false,error:"The uploaded file could not be removed from storage."};
  const{error:deleteError}=await admin.from("life_health_case_documents").delete().eq("case_id",caseId).eq("id",documentId);
  if(deleteError)return{ok:false,error:"File removed, but the document record could not be cleared. Contact support."};
  revalidatePath(`/policies/life-health-cases/${caseId}`);
  return{ok:true};
}

export async function convertLifeHealthCaseToPolicy(formData:FormData):Promise<LifeHealthConversionResult>{
  const caseId=clean(formData.get("caseId"));
  const {profile:requester}=await getAuthenticatedProfile(await getServerAccessToken());
  const profile=requester?.role==="operations_head_life"
    ?await requireOperationsHeadRecordOwnership("life_health_case",caseId)
    :await requirePolicyCreator();
  await requireLifeTeamSalesCaseWrite(profile,caseId);
  return convertLifeHealthCaseForVerifiedActor(formData,profile);
}
