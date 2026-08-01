"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const reviewPath=(id:string)=>`/intermediaries/applications/${id}`;
type AdminClient=ReturnType<typeof createSupabaseAdminClient>;

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
 if(!sourceApp||!sourceProfile||sourceApp.partner_status!=="active_partner")redirectFresh(`${reviewPath(sourceApplicationId)}?error=partner_account_required`);

 const sourceDraft=object(sourceApp.draft_data);
 const sourceRaw=object(sourceProfile.raw_data);
 const isLegacy=
  sourceDraft.onboarding_mode==="legacy_existing_partner"||
  sourceDraft.record_source==="legacy_manual_pending_activation"||
  sourceProfile.record_source==="legacy_manual_pending_activation"||
  sourceProfile.record_source==="legacy_manual"||
  sourceProfile.existing_registration_confirmed===true;

 let partnerRecordId=plainText(sourceApp.partner_record_id)??plainText(sourceProfile.partner_record_id);
 if(!partnerRecordId&&isLegacy){
  try{partnerRecordId=await resolveLegacyPartnerRecordId(admin,sourceApplicationId,reviewer.id,sourceApp,sourceProfile)}
  catch(error){redirectFresh(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent(errorMessage(error,"The legacy Partner record could not be linked. Please try again."))}`)}
 }
 if(!partnerRecordId)redirectFresh(`${reviewPath(sourceApplicationId)}?error=partner_account_required`);

 const partnerCode=firstText(sourceProfile.partner_id,sourceDraft.legacy_partner_code,sourceRaw.legacy_partner_code);
 const reservedCode=firstText(sourceProfile.existing_registration_code,sourceProfile.external_onboarding_id,sourceDraft.legacy_registration_code,sourceRaw.legacy_registration_code);
 if(isLegacy&&(!reservedCode||reservedCode.startsWith("PENDING-"))){
  redirectFresh(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent("The existing POSP/MISP ID reserved during Partner onboarding is missing. Review the legacy application before creating the linked account.")}`);
 }
 if(isLegacy&&!partnerCode){
  redirectFresh(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent("The permanent Partner ID is missing from this legacy application.")}`);
 }

 const {data:existingApps}=await admin.from("intermediary_onboarding_applications").select("id,draft_data").eq("partner_record_id",partnerRecordId).neq("id",sourceApplicationId).returns<Array<{id:string;draft_data:Record<string,unknown>|null}>>();
 const existing=(existingApps??[]).find(row=>object(row.draft_data).account_context===requestedType);
 const now=new Date().toISOString();
 if(existing){await syncInheritedDocuments(admin,sourceApplicationId,existing.id,reviewer.id,now);revalidatePath(reviewPath(existing.id));redirectFresh(reviewPath(existing.id))}

 const inheritedRegistration=sourceApp.registration_record_id??sourceProfile.registration_record_id??null;
 const childDraft={...sourceDraft,account_context:requestedType,parent_partner_application_id:sourceApplicationId,linked_partner_code:partnerCode??sourceProfile.partner_id??null,record_source:isLegacy?"legacy_manual":sourceDraft.record_source,issued_registration_code:isLegacy?reservedCode:undefined};
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
  partner_record_id:partnerRecordId,partner_status:"active_partner",registration_status:registrationStatus
 }).select("id").single<{id:string}>();
 if(childError||!child)redirectFresh(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent(linkedAccountError(stepError("child_application",childError??new Error("The child application could not be created."))))}`);

 let registrationTransferred=false;
 let legacyReservationReleased=false;
 const previousReservation={
  external_onboarding_id:sourceProfile.external_onboarding_id??null,
  existing_registration_code:sourceProfile.existing_registration_code??null,
  existing_registration_confirmed:sourceProfile.existing_registration_confirmed??false,
  existing_registration_confirmed_at:sourceProfile.existing_registration_confirmed_at??null,
 };

 try{
  const historicalDate=legacyDate(sourceDraft.legacy_original_activation_date,now);

  if(isLegacy){
   const {error:releaseError}=await admin.from("posp_misp_onboarding_profiles").update({
    external_onboarding_id:partnerCode,
    existing_registration_code:null,
    existing_registration_confirmed:false,
    existing_registration_confirmed_at:null,
    updated_by:reviewer.id,
    updated_at:now,
   }).eq("application_id",sourceApplicationId);
   if(releaseError)throw stepError("release_legacy_registration_reservation",releaseError);
   legacyReservationReleased=true;
  }

  const childProfile={
   application_id:child.id,
   partner_type:requestedType,
   requested_account_type:requestedType,
   final_account_type:requestedType,
   partner_decision:"not_applicable",
   partner_id:partnerCode??sourceProfile.partner_id??null,
   partner_record_id:partnerRecordId,
   partner_status:"active_partner",
   registration_record_id:null,
   associate_employee_id:sourceProfile.associate_employee_id??null,
   associate_profile_id:sourceProfile.associate_profile_id??null,
   associate_name:sourceProfile.associate_name??null,
   associate_id:sourceProfile.associate_id??null,
   external_onboarding_id:issuedCode,
   document_received_at:sourceProfile.document_received_at??null,
   pos_name:requestedType==="posp"?(sourceProfile.pos_name??sourceDraft.pos_name??null):null,
   misp_name:requestedType==="misp"?(sourceProfile.misp_name??sourceDraft.misp_name??null):null,
   applicant_phone:sourceProfile.applicant_phone??sourceApp.applicant_phone??null,
   applicant_email:sourceProfile.applicant_email??sourceApp.applicant_email??null,
   pan_number:sourceProfile.pan_number??sourceDraft.pan_number??null,
   gst_number:sourceProfile.gst_number??sourceDraft.gst_number??null,
   address:sourceProfile.address??sourceDraft.address??null,
   city:sourceProfile.city??sourceDraft.city??null,
   state:sourceProfile.state??sourceDraft.state??null,
   postal_code:sourceProfile.postal_code??sourceDraft.postal_code??null,
   bank_id:sourceProfile.bank_id??sourceDraft.bank_id??null,
   bank_name:sourceProfile.bank_name??sourceDraft.bank_name??null,
   bank_account_number:sourceProfile.bank_account_number??null,
   bank_ifsc_code:sourceProfile.bank_ifsc_code??sourceDraft.bank_ifsc_code??null,
   oem_name:sourceProfile.oem_name??sourceDraft.oem_name??null,
   dp_first_name:requestedType==="misp"?(sourceProfile.dp_first_name??sourceDraft.dp_first_name??null):null,
   dp_middle_name:requestedType==="misp"?(sourceProfile.dp_middle_name??sourceDraft.dp_middle_name??null):null,
   dp_last_name:requestedType==="misp"?(sourceProfile.dp_last_name??sourceDraft.dp_last_name??null):null,
   dp_name:requestedType==="misp"?(sourceProfile.dp_name??sourceDraft.dp_name??null):null,
   dp_phone:requestedType==="misp"?(sourceProfile.dp_phone??sourceDraft.dp_phone??null):null,
   dp_email:requestedType==="misp"?(sourceProfile.dp_email??sourceDraft.dp_email??null):null,
   dp_pan_number:requestedType==="misp"?(sourceProfile.dp_pan_number??sourceDraft.dp_pan_number??null):null,
   dp_date_of_birth:requestedType==="misp"?(sourceProfile.dp_date_of_birth??sourceDraft.dp_date_of_birth??null):null,
   dp_aadhaar_last_four:requestedType==="misp"?(sourceProfile.dp_aadhaar_last_four??sourceDraft.dp_aadhaar_last_four??null):null,
   dp_aadhaar_hash:requestedType==="misp"?(sourceProfile.dp_aadhaar_hash??null):null,
   dp_aadhaar_number_encrypted:requestedType==="misp"?(sourceProfile.dp_aadhaar_number_encrypted??null):null,
   date_of_birth:requestedType==="posp"?(sourceProfile.date_of_birth??sourceDraft.date_of_birth??null):null,
   aadhaar_last_four:requestedType==="posp"?(sourceProfile.aadhaar_last_four??sourceDraft.aadhaar_last_four??null):null,
   aadhaar_hash:requestedType==="posp"?(sourceProfile.aadhaar_hash??null):null,
   aadhaar_number_encrypted:requestedType==="posp"?(sourceProfile.aadhaar_number_encrypted??null):null,
   education_status:sourceProfile.education_status??"not_received",
   workflow_stage:isLegacy?"completed":"training",
   training_status:isLegacy?"completed":"pending",
   training_certificate_number:isLegacy?`LEGACY-${issuedCode}`:null,
   training_start_date:isLegacy?historicalDate:null,
   training_end_date:isLegacy?historicalDate:null,
   exam_status:isLegacy?"passed":"not_allotted",
   iib_uploaded:isLegacy,
   iib_uploaded_at:isLegacy?historicalDate:null,
   iib_upload_status:isLegacy?"completed":"pending",
   iib_remarks:null,
   pre_iib_submitted_at:sourceProfile.pre_iib_submitted_at??now,
   onboarding_date:isLegacy?legacyDate(sourceDraft.legacy_original_onboarding_date,historicalDate):null,
   source:sourceProfile.source??"manual",
   record_source:isLegacy?"legacy_manual":sourceProfile.record_source??null,
   existing_registration_confirmed:isLegacy,
   existing_registration_code:isLegacy?issuedCode:null,
   existing_registration_confirmed_at:isLegacy?now:null,
   raw_data:{
    ...sourceRaw,
    account_context:requestedType,
    parent_partner_application_id:sourceApplicationId,
    linked_partner_code:partnerCode??sourceProfile.partner_id??null,
    issued_registration_code:issuedCode,
    record_source:isLegacy?"legacy_manual":sourceRaw.record_source,
   },
   created_by:reviewer.id,
   updated_by:reviewer.id,
   updated_at:now,
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
   const {data:existingRegistration,error:existingRegistrationError}=await admin.from("intermediary_registrations").select("id").eq("partner_id",partnerRecordId).maybeSingle<{id:string}>();
   if(existingRegistrationError)throw stepError("registration_lookup",existingRegistrationError);
   const registrationPayload={application_id:child.id,registration_type:requestedType,registration_code:issuedCode,registration_status:registrationStatus,training_status:isLegacy?"completed":"not_assigned",exam_status:isLegacy?"passed":"not_allotted",agreement_status:isLegacy?"signed":"not_started",iib_status:isLegacy?"registered":"pending",updated_at:now};
   const {data:registration,error:registrationError}=existingRegistration
    ?await admin.from("intermediary_registrations").update(registrationPayload).eq("id",existingRegistration.id).select("id").single<{id:string}>()
    :await admin.from("intermediary_registrations").insert({partner_id:partnerRecordId,...registrationPayload,created_by:reviewer.id}).select("id").single<{id:string}>();
   if(registrationError||!registration)throw stepError("registration_create",registrationError??new Error("The linked registration record could not be created."));
   const{error:childAppRegistrationError}=await admin.from("intermediary_onboarding_applications").update({registration_record_id:registration.id,updated_at:now}).eq("id",child.id);if(childAppRegistrationError)throw stepError("child_app_registration",childAppRegistrationError);
   const{error:childProfileRegistrationError}=await admin.from("posp_misp_onboarding_profiles").update({registration_record_id:registration.id,updated_at:now}).eq("application_id",child.id);if(childProfileRegistrationError)throw stepError("child_profile_registration",childProfileRegistrationError);
   await admin.from("posp_misp_onboarding_profiles").update({workflow_stage:"completed",updated_by:reviewer.id,updated_at:now}).eq("application_id",sourceApplicationId);
  }

  if(isLegacy){
   const {error:assignmentError}=await admin.from("intermediary_training_exam_assignments").insert({application_id:child.id,training_title:`Historical ${requestedType.toUpperCase()} training`,training_status:"completed",training_assigned_at:historicalDate,training_started_at:historicalDate,training_completed_at:historicalDate,exam_title:`Historical ${requestedType.toUpperCase()} examination`,exam_status:"passed",exam_completed_at:historicalDate,exam_passed_at:historicalDate,agreement_status:"signed",agreement_sent_at:historicalDate,agreement_opened_at:historicalDate,agreement_signed_at:historicalDate,created_at:now,updated_at:now});
   if(assignmentError)throw stepError("historical_stages",assignmentError);
   const {data:linkedRegister}=await admin.from("intermediaries").select("id").eq("application_id",child.id).maybeSingle<{id:string}>();
   if(linkedRegister){const {error:registerError}=await admin.from("intermediaries").update({intermediary_code:issuedCode,onboarding_id:issuedCode,intermediary_type:requestedType,requested_type:requestedType,account_status:"active",updated_at:now}).eq("id",linkedRegister.id);if(registerError)throw stepError("intermediary_register",registerError)}
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
  if(legacyReservationReleased){
   await admin.from("posp_misp_onboarding_profiles").update({...previousReservation,updated_by:reviewer.id,updated_at:now}).eq("application_id",sourceApplicationId);
  }
  redirectFresh(`${reviewPath(sourceApplicationId)}?error=${encodeURIComponent(linkedAccountError(error))}`);
 }
 revalidatePath(reviewPath(sourceApplicationId));
 revalidatePath("/intermediaries");
 redirectFresh(`${reviewPath(child.id)}?success=${isLegacy?"legacy_intermediary_imported":`linked_${requestedType}_account_created`}`);
}

async function resolveLegacyPartnerRecordId(admin:AdminClient,sourceApplicationId:string,actorId:string,sourceApp:Record<string,unknown>,sourceProfile:Record<string,unknown>){
 const draft=object(sourceApp.draft_data);const raw=object(sourceProfile.raw_data);const partnerCode=firstText(sourceProfile.partner_id,draft.legacy_partner_code,raw.legacy_partner_code);let partnerId:string|null=null;
 const {data:bySource,error:sourceLookupError}=await admin.from("partners").select("id").eq("source_application_id",sourceApplicationId).maybeSingle<{id:string}>();if(sourceLookupError)throw stepError("partner_source_lookup",sourceLookupError);partnerId=bySource?.id??null;
 if(!partnerId&&partnerCode){const {data:byCode,error:codeLookupError}=await admin.from("partners").select("id").eq("partner_code",partnerCode).maybeSingle<{id:string}>();if(codeLookupError)throw stepError("partner_code_lookup",codeLookupError);partnerId=byCode?.id??null}
 if(!partnerId){const {data:ensured,error:ensureError}=await admin.rpc("ensure_legacy_partner_record",{p_application_id:sourceApplicationId,p_actor_id:actorId});if(ensureError)throw stepError("partner_record_create",ensureError);partnerId=plainText(ensured)}
 if(!partnerId)throw new Error("The active legacy Partner could not be connected to its Partner record.");
 const updatedAt=new Date().toISOString();
 const [{error:applicationLinkError},{error:profileLinkError}]=await Promise.all([admin.from("intermediary_onboarding_applications").update({partner_record_id:partnerId,updated_at:updatedAt}).eq("id",sourceApplicationId),admin.from("posp_misp_onboarding_profiles").update({partner_record_id:partnerId,updated_by:actorId,updated_at:updatedAt}).eq("application_id",sourceApplicationId)]);
 if(applicationLinkError)throw stepError("application_partner_link",applicationLinkError);if(profileLinkError)throw stepError("profile_partner_link",profileLinkError);return partnerId;
}
function text(data:FormData,key:string){const value=data.get(key);return typeof value==="string"&&value.trim()?value.trim():null}
function plainText(value:unknown){return typeof value==="string"&&value.trim()?value.trim():null}
function object(value:unknown):Record<string,unknown>{return value&&typeof value==="object"&&!Array.isArray(value)?value as Record<string,unknown>: {}}
function firstText(...values:unknown[]){for(const value of values){if(typeof value==="string"&&value.trim())return value.trim().toUpperCase()}return null}
function legacyDate(value:unknown,fallback:string){if(typeof value!=="string"||!value.trim())return fallback;const date=new Date(value);return Number.isNaN(date.getTime())?fallback:date.toISOString()}
function stepError(step:string,error:unknown){const detail=errorMessage(error,"Unknown database error");return new Error(`[${step}] ${detail}`)}
async function syncInheritedDocuments(admin:AdminClient,sourceApplicationId:string,targetApplicationId:string,uploadedBy:string,now:string){const{data:documents,error:readError}=await admin.from("intermediary_onboarding_documents").select("document_type,file_name,storage_bucket,storage_path,mime_type,file_size,verification_status,verified_by,verified_at").eq("application_id",sourceApplicationId).returns<Array<Record<string,unknown>>>();if(readError)throw readError;if(!documents?.length)return;const rows=documents.map(row=>({...row,id:randomUUID(),application_id:targetApplicationId,uploaded_by:uploadedBy,created_at:now,updated_at:now}));const{error}=await admin.from("intermediary_onboarding_documents").upsert(rows,{onConflict:"application_id,document_type",ignoreDuplicates:true});if(error)throw error}
function errorMessage(error:unknown,fallback:string){if(error instanceof Error&&error.message)return error.message;if(error&&typeof error==="object"&&"message" in error&&typeof (error as {message?:unknown}).message==="string")return (error as {message:string}).message;return fallback}
function linkedAccountError(error:unknown){const message=errorMessage(error,"");if(message.includes("intermediary_onboarding_applications_registration_status_check"))return "The linked account could not be completed because its legacy status is not supported by the live database. Apply the latest migrations and try again.";if(message.includes("duplicate key")||message.includes("unique constraint"))return "The existing POSP or MISP ID is already used by another account.";if(message.startsWith("[release_legacy_registration_reservation]"))return "The reserved existing POSP/MISP ID could not be transferred from the Partner to the linked account.";if(message.startsWith("[profile]"))return `The linked profile could not be created: ${message.slice(message.indexOf("]")+1).trim()}`;if(message.startsWith("[registration"))return "The linked registration record could not be prepared for this Partner.";if(message.startsWith("[historical_stages]"))return "The historical training, exam and agreement completion could not be recorded. No linked account was retained.";if(message.startsWith("["))return `Unable to create the linked account at ${message.slice(1,message.indexOf("]"))}. No changes were made.`;return "Unable to create the linked account. No changes were made. Please try again."}
function redirectFresh(href:string):never{redirect(`${href}${href.includes("?")?"&":"?"}fresh=${Date.now()}`)}