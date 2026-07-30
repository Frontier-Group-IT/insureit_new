"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const reviewPath=(id:string)=>`/intermediaries/applications/${id}`;

export async function createLinkedIntermediaryAccount(formData:FormData){
 const reviewer=await requirePospMispManager();
 const sourceApplicationId=text(formData,"application_id");
 const requestedType=text(formData,"registration_type")==="misp"?"misp":"posp";
 if(!reviewer?.id||!sourceApplicationId)redirect("/intermediaries?error=linked_account_invalid");
 const admin=createSupabaseAdminClient();
 const [{data:sourceApp},{data:sourceProfile}]=await Promise.all([
  admin.from("intermediary_onboarding_applications").select("id,initiated_by,source,requested_type,status,registration_status,partner_status,applicant_phone,applicant_email,draft_data,partner_record_id,registration_record_id").eq("id",sourceApplicationId).maybeSingle<Record<string,unknown>>(),
  admin.from("posp_misp_onboarding_profiles").select("*").eq("application_id",sourceApplicationId).maybeSingle<Record<string,unknown>>()
 ]);
 if(!sourceApp||!sourceProfile||sourceApp.partner_status!=="active_partner"||!sourceApp.partner_record_id)redirect(`${reviewPath(sourceApplicationId)}?error=partner_account_required`);
 const sourceDraft=object(sourceApp.draft_data);
 const {data:existingApps}=await admin.from("intermediary_onboarding_applications").select("id,draft_data").eq("partner_record_id",String(sourceApp.partner_record_id)).neq("id",sourceApplicationId).returns<Array<{id:string;draft_data:Record<string,unknown>|null}>>();
 const existing=(existingApps??[]).find(row=>object(row.draft_data).account_context===requestedType);
 if(existing)redirect(reviewPath(existing.id));
 const now=new Date().toISOString();
 const childDraft={...sourceDraft,account_context:requestedType,parent_partner_application_id:sourceApplicationId,linked_partner_code:sourceProfile.partner_id??null};
 const childStatus=requestedType==="posp"?"training_pending":"agreement_pending";
 const {data:child,error:childError}=await admin.from("intermediary_onboarding_applications").insert({
  initiated_by:reviewer.id,source:"partner_account",requested_type:requestedType,final_type:requestedType,status:"submitted",current_step:3,
  applicant_phone:sourceApp.applicant_phone,applicant_email:sourceApp.applicant_email,draft_data:childDraft,submitted_at:now,updated_at:now,
  partner_record_id:sourceApp.partner_record_id,partner_status:"active_partner",registration_status:childStatus
 }).select("id").single<{id:string}>();
 if(childError||!child)redirect(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent(childError?.message??"linked_account_create_failed")}`);
 try{
  const original={...sourceProfile};
  for(const key of ["id","application_id","created_at","updated_at"]){delete original[key]}
  const inheritedRegistration=sourceApp.registration_record_id??sourceProfile.registration_record_id??null;
  const childProfile={...original,application_id:child.id,partner_type:requestedType,requested_account_type:requestedType,final_account_type:requestedType,
   external_onboarding_id:`PENDING-${requestedType.toUpperCase()}-${child.id}`,workflow_stage:"training",partner_status:"active_partner",
   registration_record_id:inheritedRegistration,training_status:requestedType==="posp"?"pending":"not_required",exam_status:requestedType==="posp"?"not_allotted":"not_required",
   iib_uploaded:false,iib_uploaded_at:null,iib_upload_status:"pending",onboarding_date:null,created_by:reviewer.id,updated_by:reviewer.id,updated_at:now,
   raw_data:{...object(original.raw_data),account_context:requestedType,parent_partner_application_id:sourceApplicationId}
  };
  const{error:profileError}=await admin.from("posp_misp_onboarding_profiles").insert(childProfile);if(profileError)throw profileError;
  const{data:contacts}=await admin.from("intermediary_onboarding_contacts").select("contact_role,full_name,phone,email,is_designated_person,login_required,membership_status").eq("application_id",sourceApplicationId).returns<Array<Record<string,unknown>>>();
  if(contacts?.length){const{error}=await admin.from("intermediary_onboarding_contacts").insert(contacts.map(row=>({...row,application_id:child.id})));if(error)throw error}
  const{data:documents}=await admin.from("intermediary_onboarding_documents").select("document_type,file_name,storage_bucket,storage_path,mime_type,file_size,verification_status,verified_by,verified_at,review_notes").eq("application_id",sourceApplicationId).returns<Array<Record<string,unknown>>>();
  if(documents?.length){const{error}=await admin.from("intermediary_onboarding_documents").insert(documents.map(row=>({...row,id:randomUUID(),application_id:child.id,uploaded_by:reviewer.id,created_at:now})));if(error)throw error}
  if(inheritedRegistration){
   const{error:registrationError}=await admin.from("intermediary_registrations").update({application_id:child.id,registration_type:requestedType,registration_status:childStatus,updated_at:now}).eq("id",String(inheritedRegistration));if(registrationError)throw registrationError;
   await admin.from("intermediary_onboarding_applications").update({registration_record_id:inheritedRegistration}).eq("id",child.id);
  }
  await admin.from("intermediary_onboarding_applications").update({registration_record_id:null,registration_status:"partner_created",updated_at:now}).eq("id",sourceApplicationId);
  await admin.from("posp_misp_onboarding_profiles").update({registration_record_id:null,workflow_stage:"completed",updated_by:reviewer.id,updated_at:now}).eq("application_id",sourceApplicationId);
 }catch(error){
  await admin.from("intermediary_onboarding_documents").delete().eq("application_id",child.id);await admin.from("intermediary_onboarding_contacts").delete().eq("application_id",child.id);await admin.from("posp_misp_onboarding_profiles").delete().eq("application_id",child.id);await admin.from("intermediary_onboarding_applications").delete().eq("id",child.id);
  redirect(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent(message(error))}`);
 }
 revalidatePath(reviewPath(sourceApplicationId));redirect(`${reviewPath(child.id)}?success=linked_${requestedType}_account_created`);
}

function text(data:FormData,key:string){const value=data.get(key);return typeof value==="string"&&value.trim()?value.trim():null}
function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>: {}}
function message(error:unknown){return error instanceof Error&&error.message?error.message:"linked_account_create_failed"}
