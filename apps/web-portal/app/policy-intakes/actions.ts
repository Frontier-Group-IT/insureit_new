"use server";

import { revalidatePath } from "next/cache";
import { extractPolicyIntakeDocument, type PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";
import { canAccessIntermediary } from "@/lib/employee-access-scope";
import { requirePolicyIntakeCreator, requirePolicyIntakeFinalizer, requirePolicyIntakeReviewer, requirePolicyIntakeViewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const BUCKET = "policy-documents";
const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

function cleanMobile(value: string) { return value.replace(/\D/g, "").slice(-10); }
function safeName(value: string) { return value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^[-.]+|[-.]+$/g, "") || "policy-copy"; }
function intakeNumber() { return `PIR-${new Date().toISOString().slice(2,10).replace(/-/g, "")}-${crypto.randomUUID().slice(0,6).toUpperCase()}`; }

type UploadMeta = { name:string; type:string; size:number };
type PreparedUpload = { ok:true; id:string; number:string; storagePath:string; signedUrl:string } | { ok:false; error:string };
export type SubmitPolicyIntakeResult = { ok:true; id:string; number:string; status:"ready_for_review"|"needs_attention" } | { ok:false; error:string };

function validateMeta(meta:UploadMeta) {
  if (!meta.name?.trim() || !meta.size) return "Upload the policy PDF or image.";
  if (!ALLOWED_TYPES.has(meta.type)) return "Upload a PDF, JPG, PNG or WebP policy copy.";
  if (meta.size > MAX_FILE_SIZE) return "Policy copy must be 15 MB or smaller.";
  return null;
}

async function validSource(profile:{id:string;role:string|null}, leadSourceId:string) {
  if (!leadSourceId) return { ok:false as const, error:"Select an assigned Partner, POSP or MISP." };
  const allowed = await canAccessIntermediary(profile.id, profile.role, leadSourceId, "view_intermediaries");
  if (!allowed) return { ok:false as const, error:"This lead source is outside your permitted sales scope." };
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.from("intermediaries").select("id,intermediary_type,display_name,intermediary_code,account_status").eq("id",leadSourceId).maybeSingle<{id:string;intermediary_type:"posp"|"misp"|"partner";display_name:string;intermediary_code:string|null;account_status:string}>();
  if(error||!data||data.account_status!=="active") return {ok:false as const,error:"The selected lead source is no longer active."};
  return {ok:true as const,source:data};
}

export async function preparePolicyIntakeUpload(input:{leadSourceId:string;customerMobile:string;file:UploadMeta}):Promise<PreparedUpload>{
  const profile=await requirePolicyIntakeCreator();
  const customerMobile=cleanMobile(input.customerMobile);
  if(customerMobile.length!==10)return{ok:false,error:"Enter a valid 10 digit customer mobile number."};
  const metaError=validateMeta(input.file); if(metaError)return{ok:false,error:metaError};
  const source=await validSource(profile,input.leadSourceId); if(!source.ok)return source;
  const admin=createSupabaseAdminClient();
  const id=crypto.randomUUID(); const number=intakeNumber();
  const storagePath=`intakes/${id}/${crypto.randomUUID()}-${safeName(input.file.name)}`;
  const {data,error}=await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath,{upsert:false});
  if(error||!data?.signedUrl)return{ok:false,error:"Could not prepare the policy upload. Please try again."};
  return{ok:true,id,number,storagePath,signedUrl:data.signedUrl};
}

export async function completePolicyIntakeUpload(input:{id:string;number:string;leadSourceId:string;customerMobile:string;storagePath:string;file:UploadMeta}):Promise<SubmitPolicyIntakeResult>{
  const profile=await requirePolicyIntakeCreator();
  const customerMobile=cleanMobile(input.customerMobile);
  if(customerMobile.length!==10)return{ok:false,error:"Enter a valid 10 digit customer mobile number."};
  const metaError=validateMeta(input.file); if(metaError)return{ok:false,error:metaError};
  if(!input.id||!input.storagePath.startsWith(`intakes/${input.id}/`)||input.storagePath.includes(".."))return{ok:false,error:"The upload reference is invalid. Please try again."};
  const sourceResult=await validSource(profile,input.leadSourceId); if(!sourceResult.ok)return sourceResult;
  const admin=createSupabaseAdminClient();
  const {data:blob,error:downloadError}=await admin.storage.from(BUCKET).download(input.storagePath);
  if(downloadError||!blob)return{ok:false,error:"The policy upload did not complete. Please try again."};
  if(blob.size>MAX_FILE_SIZE){await admin.storage.from(BUCKET).remove([input.storagePath]);return{ok:false,error:"Policy copy must be 15 MB or smaller."};}
  const {data:customers}=await admin.from("customers").select("id").eq("phone",customerMobile).limit(1).returns<Array<{id:string}>>();
  const matchedCustomerId=customers?.[0]?.id??null;
  const source=sourceResult.source;
  const {error:insertError}=await admin.from("policy_intake_requests").insert({id:input.id,intake_number:input.number,status:"processing",submitted_by_profile_id:profile.id,lead_source_id:source.id,lead_source_type:source.intermediary_type,lead_source_name:source.display_name,lead_source_code:source.intermediary_code,customer_mobile:customerMobile,matched_customer_id:matchedCustomerId,storage_bucket:BUCKET,storage_path:input.storagePath,file_name:input.file.name,mime_type:input.file.type,file_size:blob.size,ocr_status:"processing"});
  if(insertError){await admin.storage.from(BUCKET).remove([input.storagePath]);return{ok:false,error:"Policy intake could not be created. Please try again."};}
  return runStoredOcr({id:input.id,number:input.number,blob,fileName:input.file.name,mimeType:input.file.type});
}

async function runStoredOcr({id,number,blob,fileName,mimeType}:{id:string;number:string;blob:Blob;fileName:string;mimeType:string}):Promise<SubmitPolicyIntakeResult>{
  const admin=createSupabaseAdminClient();
  const file=new File([await blob.arrayBuffer()],fileName,{type:mimeType});
  const ocrForm=new FormData(); ocrForm.set("policy_document",file);
  const ocr=await extractPolicyIntakeDocument(ocrForm);
  if(!ocr.ok){await admin.from("policy_intake_requests").update({status:"needs_attention",ocr_status:"failed",attention_reason:ocr.error}).eq("id",id);revalidatePath("/policy-intakes");return{ok:true,id,number,status:"needs_attention"};}
  await admin.from("policy_intake_requests").update({status:"ready_for_review",ocr_status:"completed",ocr_fields:ocr.fields,ocr_parser_id:ocr.parserId,ocr_parser_version:ocr.parserVersion,ocr_warnings:ocr.warnings,attention_reason:null}).eq("id",id);
  revalidatePath("/policy-intakes"); revalidatePath(`/policy-intakes/${id}`);
  return{ok:true,id,number,status:"ready_for_review"};
}

export async function preparePolicyIntakeResponseUpload(id:string,file:UploadMeta):Promise<PreparedUpload>{
  const profile=await requirePolicyIntakeCreator(); const metaError=validateMeta(file); if(metaError)return{ok:false,error:metaError};
  const admin=createSupabaseAdminClient();
  const {data}=await admin.from("policy_intake_requests").select("id,intake_number,status,submitted_by_profile_id").eq("id",id).maybeSingle<{id:string;intake_number:string;status:string;submitted_by_profile_id:string}>();
  if(!data||data.submitted_by_profile_id!==profile.id)return{ok:false,error:"You do not have access to respond to this intake."};
  if(data.status!=="needs_attention")return{ok:false,error:"Operations has not requested a replacement document for this intake."};
  const storagePath=`intakes/${id}/responses/${crypto.randomUUID()}-${safeName(file.name)}`;
  const {data:signed,error}=await admin.storage.from(BUCKET).createSignedUploadUrl(storagePath,{upsert:false});
  if(error||!signed?.signedUrl)return{ok:false,error:"Could not prepare the replacement upload. Please try again."};
  return{ok:true,id,number:data.intake_number,storagePath,signedUrl:signed.signedUrl};
}

export async function completePolicyIntakeResponseUpload(input:{id:string;storagePath:string;file:UploadMeta}):Promise<SubmitPolicyIntakeResult>{
  const profile=await requirePolicyIntakeCreator(); const metaError=validateMeta(input.file); if(metaError)return{ok:false,error:metaError};
  if(!input.storagePath.startsWith(`intakes/${input.id}/responses/`)||input.storagePath.includes(".."))return{ok:false,error:"The replacement upload reference is invalid."};
  const admin=createSupabaseAdminClient();
  const {data:intake}=await admin.from("policy_intake_requests").select("intake_number,status,submitted_by_profile_id,storage_path").eq("id",input.id).maybeSingle<{intake_number:string;status:string;submitted_by_profile_id:string;storage_path:string}>();
  if(!intake||intake.submitted_by_profile_id!==profile.id)return{ok:false,error:"You do not have access to respond to this intake."};
  if(intake.status!=="needs_attention")return{ok:false,error:"This intake no longer needs a response."};
  const {data:blob,error}=await admin.storage.from(BUCKET).download(input.storagePath); if(error||!blob)return{ok:false,error:"The replacement upload did not complete. Please try again."};
  if(blob.size>MAX_FILE_SIZE){await admin.storage.from(BUCKET).remove([input.storagePath]);return{ok:false,error:"Policy copy must be 15 MB or smaller."};}
  const {error:updateError}=await admin.from("policy_intake_requests").update({status:"processing",storage_path:input.storagePath,file_name:input.file.name,mime_type:input.file.type,file_size:blob.size,ocr_status:"processing",attention_reason:null,assigned_to_profile_id:null}).eq("id",input.id).eq("status","needs_attention").eq("submitted_by_profile_id",profile.id);
  if(updateError){await admin.storage.from(BUCKET).remove([input.storagePath]);return{ok:false,error:"Could not attach the replacement policy copy."};}
  if(intake.storage_path&&intake.storage_path!==input.storagePath)await admin.storage.from(BUCKET).remove([intake.storage_path]);
  return runStoredOcr({id:input.id,number:intake.intake_number,blob,fileName:input.file.name,mimeType:input.file.type});
}

export async function openPolicyIntakeDocument(id:string){
  const profile=await requirePolicyIntakeViewer(); const admin=createSupabaseAdminClient();
  const {data}=await admin.from("policy_intake_requests").select("submitted_by_profile_id,storage_bucket,storage_path").eq("id",id).maybeSingle<{submitted_by_profile_id:string;storage_bucket:string;storage_path:string}>();
  if(!data)return{ok:false as const,error:"Policy copy is unavailable."};
  const canReview=await reviewerAccess(profile.id,profile.role); if(!canReview&&data.submitted_by_profile_id!==profile.id)return{ok:false as const,error:"You do not have access to this intake."};
  const {data:signed}=await admin.storage.from(data.storage_bucket).createSignedUrl(data.storage_path,300); return signed?.signedUrl?{ok:true as const,url:signed.signedUrl}:{ok:false as const,error:"Could not open the policy copy."};
}

export async function claimPolicyIntakeForReview(id:string){
  const profile=await requirePolicyIntakeReviewer(); const admin=createSupabaseAdminClient();
  const {data,error}=await admin.from("policy_intake_requests").update({status:"in_review",assigned_to_profile_id:profile.id,attention_reason:null}).eq("id",id).in("status",["ready_for_review","in_review"]).or(`assigned_to_profile_id.is.null,assigned_to_profile_id.eq.${profile.id}`).select("id").maybeSingle<{id:string}>();
  if(error||!data)return{ok:false as const,error:"This intake is already being reviewed by another Operations user."}; revalidatePath(`/policy-intakes/${id}`);revalidatePath("/policy-intakes");return{ok:true as const};
}

export async function updatePolicyIntakeStatus(id:string,status:"needs_attention"|"rejected",reason:string){
  const profile=await requirePolicyIntakeReviewer(); const clean=reason.trim(); if(!clean)return{ok:false as const,error:"Add a short reason."}; const admin=createSupabaseAdminClient();
  const {error}=await admin.from("policy_intake_requests").update({status,attention_reason:clean,assigned_to_profile_id:profile.id}).eq("id",id).in("status",["ready_for_review","in_review","needs_attention"]); if(error)return{ok:false as const,error:"Could not update this intake."}; revalidatePath(`/policy-intakes/${id}`);revalidatePath("/policy-intakes");return{ok:true as const};
}

export async function completePolicyIntakeByPolicyCode(id:string,policyCode:string){
  const profile=await requirePolicyIntakeFinalizer(); const admin=createSupabaseAdminClient(); const {data:policy}=await admin.from("policies").select("id").eq("policy_code",policyCode).maybeSingle<{id:string}>(); if(!policy)return{ok:false as const,error:"Final policy could not be linked to the intake."};
  const {data:completed,error}=await admin.from("policy_intake_requests").update({status:"completed",final_policy_id:policy.id,finalized_by_profile_id:profile.id,finalized_at:new Date().toISOString(),attention_reason:null}).eq("id",id).eq("status","in_review").eq("assigned_to_profile_id",profile.id).select("id").maybeSingle<{id:string}>();
  if(error||!completed)return{ok:false as const,error:"Policy was booked but the intake could not be closed automatically."}; revalidatePath("/policy-intakes");return{ok:true as const};
}

async function reviewerAccess(profileId:string,role:string|null|undefined){const{hasEffectiveCapability}=await import("@/lib/effective-permissions");return hasEffectiveCapability({id:profileId,role},"review_policy_intakes","edit");}
export type StoredPolicyIntakeField=PolicyIntakeOcrField;
