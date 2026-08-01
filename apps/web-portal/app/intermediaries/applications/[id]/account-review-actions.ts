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
 if(!sourceApp||!sourceProfile||sourceApp.partner_status!=="active_partner"||!sourceApp.partner_record_id)redirectFresh(`${reviewPath(sourceApplicationId)}?error=partner_account_required`);
 const sourceDraft=object(sourceApp.draft_data);
 const sourceRaw=object(sourceProfile.raw_data);
 const isLegacy=
  sourceDraft.onboarding_mode==="legacy_existing_partner"||
  sourceDraft.record_source==="legacy_manual_pending_activation"||
  sourceProfile.record_source==="legacy_manual_pending_activation"||
  sourceProfile.record_source==="legacy_manual"||
  sourceProfile.existing_registration_confirmed===true;
 const reservedCode=firstText(
  sourceProfile.existing_registration_code,
  sourceProfile.external_onboarding_id,
  sourceDraft.legacy_registration_code,
  sourceRaw.legacy_registration_code
 );
 if(isLegacy&&(!reservedCode||reservedCode.startsWith("PENDING-"))){
  redirectFresh(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent("The existing POSP/MISP ID reserved during Partner onboarding is missing. Review the legacy application before creating the linked account.")}`);
 }
 const {data:existingApps}=await admin.from("intermediary_onboarding_applications").select("id,draft_data").eq("partner_record_id",String(sourceApp.partner_record_id)).neq("id",sourceApplicationId).returns<Array<{id:string;draft_data:Record<string,unknown>|null}>>();
 const existing=(existingApps??[]).find(row=>object(row.draft_data).account_context===requestedType);

 const now=new Date().toISOString();
 if(existing){await syncInheritedDocuments(admin,sourceApplicationId,existing.id,reviewer.id,now);revalidatePath(reviewPath(existing.id));redirectFresh(reviewPath(existing.id))}
 const inheritedRegistration=sourceApp.registration_record_id??sourceProfile.registration_record_id??null;
 const childDraft={...sourceDraft,account_context:requestedType,parent_partner_application_id:sourceApplicationId,linked_partner_code:sourceProfile.partner_id??null,record_source:isLegacy?"legacy_manual":sourceDraft.record_source,issued_registration_code:isLegacy?reservedCode:undefined};
 const registrationStatus=isLegacy?"iib_registered":"training_pending";
 let issuedCode:string;
 if(isLegacy){
  issuedCode=reservedCode!;
  const duplicateChecks=await Promise.all([
   admin.from("intermediary_registrations").select("id").eq("registration_code",issuedCode).limit(1),
   admin.from("intermediaries").select("id").eq("intermediary_code",issuedCode).limit(1),
   admin.from("posp_misp_onboarding_profiles").select("application_id").eq("external_onboarding_id",issuedCode).neq("application_id",sourceApplicationId).limit(1)
  ]);
  if(duplicateChecks.some(result=>(result.data?.length??0)>0))redirectFresh(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent("The reserved existing POSP/MISP ID is already used by another account.")}`);
 }else{
  const {data,error}=await admin.rpc("next_registration_code",{p_type:requestedType});
  if(error||typeof data!=="string"||!data)redirectFresh(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent("The POSP/MISP ID could not be allotted. Please try again.")}`);
  issuedCode=data;
 }
 const {data:child,error:childError}=await admin.from("intermediary_onboarding_applications").insert({
  initiated_by:reviewer.id,source:isLegacy?"legacy_manual":"partner_account",requested_type:requestedType,final_type:requestedType,status:isLegacy?"approved":"submitted",current_step:isLegacy?6:3,
  applicant_phone:sourceApp.applicant_phone,applicant_email:sourceApp.applicant_email,draft_data:childDraft,submitted_at:isLegacy?legacyDate(sourceDraft.legacy_original_onboarding_date,now):now,updated_at:now,
  partner_record_id:sourceApp.partner_record_id,partner_status:"active_partner",registration_status:registrationStatus
 }).select("id").single<{id:string}>();
 if(childError||!child)redirectFresh(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent(linkedAccountError(stepError("child_application",childError??new Error("The child application could not be created."))))}`);

 let registrationTransferred=false;
 try{
  const original={...sourceProfile};
  for(const key of ["id","application_id","customer_id","posp_id","partner_record_id","registration_record_id","intermediary_id","created_at","updated_at"]){delete original[key]}
  const historicalDate=legacyDate(sourceDraft.legacy_original_activation_date,now);
  const childProfile={...original,
   application_id:child.id,
   partner_id:sourceProfile.partner_id,
   partner_record_id:sourceApp.partner_record_id,
   partner_type:requestedType,
   requested_account_type:requestedType,
   final_account_type:requestedType,
   external_onboarding_id:issuedCode,
   workflow_stage:isLegacy?"completed":"training",
   partner_status:"active_partner",
   registration_record_id:null,
   training_status:isLegacy?"completed":"pending",
   training_certificate_number:isLegacy?`LEGACY-${issuedCode}`:sourceProfile.training_certificate_number??null,
   training_start_date:isLegacy?historicalDate:null,
   training_end_date:isLegacy?historicalDate:null,
   exam_status:isLegacy?"passed":"not_allotted",
   iib_uploaded:isLegacy,
   iib_uploaded_at:isLegacy?historicalDate:null,
   iib_upload_status:isLegacy?"completed":"pending",
   iib_remarks:isLegacy?"Legacy registration confirmed":null,
   onboarding_date:isLegacy?legacyDate(sourceDraft.legacy_original_onboarding_date,historicalDate):null,
   record_source:isLegacy?"legacy_manual":sourceProfile.record_source,
   existing_registration_confirmed:isLegacy,
   existing_registration_code:isLegacy?issuedCode:null,
   existing_registration_confirmed_at:isLegacy?now:null,
   created_by:reviewer.id,
   updated_by:reviewer.id,
   updated_at:now,
   raw_data:{...object(original.raw_data),account_context:requestedType,parent_partner_application_id:sourceApplicationId,linked_partner_code:sourceProfile.partner_id??null,issued_registration_code:issuedCode,record_source:isLegacy?"legacy_manual":undefined}
  };
  const{error:profileError}=await admin.from("posp_misp_onboarding_profiles").insert(childProfile);if(profileError)throw stepError("profile",profileError);

  const{data:contacts}=await admin.from("intermediary_onboarding_contacts").select("contact_role,full_name,phone,email,is_designated_person,login_required,membership_status").eq("application_id",sourceApplicationId).returns<Array<Record<string,unknown>>>();
  if(contacts?.length){const{error}=await admin.from("intermediary_onboarding_contacts").insert(contacts.map(row=>({...row,application_id:child.id})));if(error)throw stepError("contacts",error)}

  await syncInheritedDocuments(admin,sourceApplicationId,child.id,reviewer.id,now).catch(error=>{throw stepError("documents",error)});

  if(inheritedRegistration){
   const {error:clearSourceAppError}=await admin.from("intermediary_onboarding_applications").update({registration_record_id:null,updated_at:now}).eq("id",sourceApplicationId);if(clearSourceAppError)throw stepError("clear_source_app",clearSourceAppError);
   const {error:clearSourceProfileError}=await admin.from("posp_misp_onboarding_profiles").update({registration_record_id:null,workflow_stage:"completed",updated_by:reviewer.id,updated_at:now}).eq("application_id",sourceApplicationId);if(clearSourceProfileError)throw stepError("clear_source_profile",clearSourceProfileError);
   const{error:registrationError}=await admin.from("intermediary_registrations").update({application_id:child.id,registration_type:requestedType,registration_code:issuedCode,registration_status:registrationStatus,training_status:isLegacy?"completed":"not_assigned",exam_status:isLegacy?"passed":"not_allotted",agreement_status:isLegacy?"signed":"not_started",iib_status:isLegacy?"registered":"pending",updated_at:now}).eq("id",String(inheritedRegistration));if(registrationError)throw stepError("registration_transfer",registrationError);
   const{error:childAppLinkError}=await admin.from("intermediary_onboarding_applications").update({registration_record_id:inheritedRegistration}).eq("id",child.id);if(childAppLinkError)throw stepError("child_app_link",childAppLinkError);
   const{error:childProfileLinkError}=await admin.from("posp_misp_onboarding_profiles").update({registration_record_id:inheritedRegistration}).eq("application_id",child.id);if(childProfileLinkError)throw stepError("child_profile_link",childProfileLinkError);
   registrationTransferred=true;
  }else{
   const {data:existingRegistration,error:existingRegistrationError}=await admin.from("intermediary_registrations").select("id").eq("partner_id",String(sourceApp.partner_record_id)).maybeSingle<{id:string}>();
   if(existingRegistrationError)throw stepError("registration_lookup",existingRegistrationError);
   const registrationPayload={application_id:child.id,registration_type:requestedType,registration_code:issuedCode,registration_status:registrationStatus,training_status:isLegacy?"completed":"not_assigned",exam_status:isLegacy?"passed":"not_allotted",agreement_status:isLegacy?"signed":"not_started",iib_status:isLegacy?"registered":"pending",updated_at:now};
   const {data:registration,error:registrationError}=existingRegistration
    ? await admin.from("intermediary_registrations").update(registrationPayload).eq("id",existingRegistration.id).select("id").single<{id:string}>()
    : await admin.from("intermediary_registrations").insert({partner_id:sourceApp.partner_record_id,...registrationPayload,created_by:reviewer.id}).select("id").single<{id:string}>();
   if(registrationError||!registration)throw stepError("registration_create",registrationError??new Error("The linked registration record could not be created."));
   const{error:childAppRegistrationError}=await admin.from("intermediary_onboarding_applications").update({registration_record_id:registration.id,updated_at:now}).eq("id",child.id);if(childAppRegistrationError)throw stepError("child_app_registration",childAppRegistrationError);
   const{error:childProfileRegistrationError}=await admin.from("posp_misp_onboarding_profiles").update({registration_record_id:registration.id,updated_at:now}).eq("application_id",child.id);if(childProfileRegistrationError)throw stepError("child_profile_registration",childProfileRegistrationError);
   await admin.from("posp_misp_onboarding_profiles").update({workflow_stage:"completed",updated_by:reviewer.id,updated_at:now}).eq("application_id",sourceApplicationId);
  }

  if(isLegacy){
   const historicalDate=legacyDate(sourceDraft.legacy_original_activation_date,now);
   const {error:assignmentError}=await admin.from("intermediary_training_exam_assignments").insert({
    application_id:child.id,
    training_title:`Historical ${requestedType.toUpperCase()} training`,
    training_status:"completed",
    training_assigned_at:historicalDate,
    training_started_at:historicalDate,
    training_completed_at:historicalDate,
    exam_title:`Historical ${requestedType.toUpperCase()} examination`,
    exam_status:"passed",
    exam_completed_at:historicalDate,
    exam_passed_at:historicalDate,
    agreement_status:"signed",
    agreement_sent_at:historicalDate,
    agreement_opened_at:historicalDate,
    agreement_signed_at:historicalDate,
    created_at:now,
    updated_at:now
   });
   if(assignmentError)throw stepError("historical_stages",assignmentError);

   const {data:linkedRegister}=await admin.from("intermediaries").select("id").eq("application_id",child.id).maybeSingle<{id:string}>();
   if(linkedRegister){
    const {error:registerError}=await admin.from("intermediaries").update({intermediary_code:issuedCode,onboarding_id:issuedCode,intermediary_type:requestedType,requested_type:requestedType,account_status:"active",updated_at:now}).eq("id",linkedRegister.id);
    if(registerError)throw stepError("intermediary_register",registerError);
   }
  }
 }catch(error){
  if(inheritedRegistration&&registrationTransferred){
   await admin.from("intermediary_registrations").update({application_id:sourceApplicationId,registration_type:sourceApp.requested_type,registration_status:sourceApp.registration_status,updated_at:now}).eq("id",String(inheritedRegistration));
   await admin.from("intermediary_onboarding_applications").update({registration_record_id:inheritedRegistration,registration_status:sourceApp.registration_status,updated_at:now}).eq("id",sourceApplicationId);
   await admin.from("posp_misp_onboarding_profiles").update({registration_record_id:inheritedRegistration,workflow_stage:sourceProfile.workflow_stage,updated_by:reviewer.id,updated_at:now}).eq("application_id",sourceApplicationId);
  }
  await admin.from("intermediary_training_exam_assignments").delete().eq("application_id",child.id);
  await admin.from("intermediary_onboarding_documents").delete().eq("application_id",child.id);
  await admin.from("intermediary_onboarding_contacts").delete().eq("application_id",child.id);
  await admin.from("intermediaries").delete().eq("application_id",child.id);
  await admin.from("intermediary_registrations").delete().eq("application_id",child.id);
  await admin.from("posp_misp_onboarding_profiles").delete().eq("application_id",child.id);
  await admin.from("intermediary_onboarding_applications").delete().eq("id",child.id);
  redirectFresh(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent(linkedAccountError(error))}`);
 }
 revalidatePath(reviewPath(sourceApplicationId));
 revalidatePath("/intermediaries");
 redirectFresh(`${reviewPath(child.id)}?success=${isLegacy?"legacy_intermediary_imported":`linked_${requestedType}_account_created`}`);
}

function text(data:FormData,key:string){const value=data.get(key);return typeof value==="string"&&value.trim()?value.trim():null}
function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>: {}}
function firstText(...values:unknown[]){for(const value of values){if(typeof value==="string"&&value.trim())return value.trim().toUpperCase()}return null}
function legacyDate(value:unknown,fallback:string){if(typeof value!=="string"||!value.trim())return fallback;const date=new Date(value);return Number.isNaN(date.getTime())?fallback:date.toISOString()}
function stepError(step:string,error:unknown){const detail=errorMessage(error,"Unknown database error");return new Error(`[${step}] ${detail}`)}
async function syncInheritedDocuments(admin:ReturnType<typeof createSupabaseAdminClient>,sourceApplicationId:string,targetApplicationId:string,uploadedBy:string,now:string){
 const{data:documents,error:readError}=await admin.from("intermediary_onboarding_documents").select("document_type,file_name,storage_bucket,storage_path,mime_type,file_size,verification_status,verified_by,verified_at").eq("application_id",sourceApplicationId).returns<Array<Record<string,unknown>>>();
 if(readError)throw readError;
 if(!documents?.length)return;
 const rows=documents.map(row=>({...row,id:randomUUID(),application_id:targetApplicationId,uploaded_by:uploadedBy,created_at:now,updated_at:now}));
 const{error}=await admin.from("intermediary_onboarding_documents").upsert(rows,{onConflict:"application_id,document_type",ignoreDuplicates:true});
 if(error)throw error;
}
function errorMessage(error:unknown,fallback:string){if(error instanceof Error&&error.message)return error.message;if(error&&typeof error==="object"&&"message" in error&&typeof (error as {message?:unknown}).message==="string")return (error as {message:string}).message;return fallback}
function linkedAccountError(error:unknown){const message=errorMessage(error,"");if(message.includes("intermediary_onboarding_applications_registration_status_check"))return "The linked account could not be completed because its legacy status is not supported by the live database. Apply the latest migrations and try again.";if(message.includes("duplicate key")||message.includes("unique constraint"))return "The existing POSP or MISP ID is already used by another account.";if(message.startsWith("[profile]"))return "The linked profile could not be created. Parent-only identifiers were detected on the new account profile.";if(message.startsWith("[registration"))return "The linked registration record could not be prepared for this Partner.";if(message.startsWith("[historical_stages]"))return "The historical training, exam and agreement completion could not be recorded. No linked account was retained.";if(message.startsWith("["))return `Unable to create the linked account at ${message.slice(1,message.indexOf("]"))}. No changes were made.`;return "Unable to create the linked account. No changes were made. Please try again."}
function redirectFresh(href:string):never{redirect(`${href}${href.includes("?")?"&":"?"}fresh=${Date.now()}`)}
