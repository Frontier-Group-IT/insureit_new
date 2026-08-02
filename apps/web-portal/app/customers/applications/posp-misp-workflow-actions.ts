"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const PAN_PATTERN=/^[A-Z]{5}[0-9]{4}[A-Z]$/;
const MATCHING_RECORD="Matching Record Found In DataBase";
const applicationPath=(id:string)=>`/intermediaries/applications/${id}`;
const partnersPath="/intermediaries/partner";

type PartnerActivationResult={partner_id?:unknown;identity_source?:unknown;already_active?:unknown};

export async function queuePospMispPanVerification(data:FormData){
 const {actorId,applicationId,admin}=await context(data);
 const {data:profile}=await admin.from("posp_misp_onboarding_profiles").select("id, partner_type, pan_number, dp_pan_number, workflow_stage").eq("application_id",applicationId).maybeSingle<{id:string;partner_type:"posp"|"misp";pan_number:string|null;dp_pan_number:string|null;workflow_stage:string}>();
 const panNumber=verificationPan(profile);if(!profile?.id||!PAN_PATTERN.test(panNumber))redirectTo(applicationId,"pan_verification_invalid");if(profile.workflow_stage!=="pre_iib")redirectTo(applicationId,"stage_locked");
 const now=new Date().toISOString();const {error}=await admin.from("pan_verification_jobs").upsert({application_id:applicationId,onboarding_profile_id:profile.id,partner_type:profile.partner_type,pan_number:panNumber,status:"pending",result_code:null,result_message:null,requested_at:now,started_at:null,completed_at:null,last_error:null,checked_by_device:null,requested_by:actorId,override_reason:null,overridden_by:null,overridden_at:null,updated_at:now},{onConflict:"application_id"});
 if(error)redirectTo(applicationId,"pan_verification_queue_failed");await admin.from("intermediary_onboarding_applications").update({registration_status:"pan_checking",updated_at:now}).eq("id",applicationId);revalidatePath(applicationPath(applicationId));redirectFresh(`${applicationPath(applicationId)}?success=pan_verification_queued`);
}

export async function retryPospMispPanVerification(data:FormData){
 const {actorId,applicationId,admin}=await context(data);
 const {data:profile}=await admin.from("posp_misp_onboarding_profiles").select("id, partner_type, pan_number, dp_pan_number, requested_account_type, partner_id").eq("application_id",applicationId).maybeSingle<{id:string;partner_type:"posp"|"misp";pan_number:string|null;dp_pan_number:string|null;requested_account_type:string|null;partner_id:string|null}>();
 const {data:application}=await admin.from("intermediary_onboarding_applications").select("draft_data").eq("id",applicationId).maybeSingle<{draft_data:Record<string,unknown>|null}>();
 const accountContext=application?.draft_data?.account_context==="posp"||application?.draft_data?.account_context==="misp"?application.draft_data.account_context:null;
 const fieldName=profile?.partner_type==="misp"?"dp_pan_number":"pan_number";const enteredPan=value(data,fieldName)?.replace(/\s/g,"").toUpperCase();const panNumber=enteredPan||verificationPan(profile);if(!profile?.id||!PAN_PATTERN.test(panNumber))redirectTo(applicationId,"pan_verification_invalid");
 const now=new Date().toISOString();const profilePanUpdate=profile.partner_type==="misp"?{dp_pan_number:panNumber}:{pan_number:panNumber};
 const resetStage=accountContext==="misp"?"agreement":accountContext==="posp"?"training":"pre_iib";
 const resetFinalType=accountContext?profile.partner_type:null;
 const {error:profileError}=await admin.from("posp_misp_onboarding_profiles").update({...profilePanUpdate,iib_remarks:null,iib_upload_status:"pending",iib_uploaded:false,iib_uploaded_at:null,iib_completed_at:null,requested_account_type:profile.partner_type,final_account_type:resetFinalType,partner_decision:"not_applicable",workflow_stage:resetStage,record_source:"new_onboarding",updated_by:actorId,updated_at:now}).eq("id",profile.id);
 if(profileError)redirectTo(applicationId,"pan_verification_reset_failed");await admin.from("pan_verification_jobs").delete().eq("application_id",applicationId);
 const {error:jobError}=await admin.from("pan_verification_jobs").insert({application_id:applicationId,onboarding_profile_id:profile.id,partner_type:profile.partner_type,pan_number:panNumber,status:"pending",result_code:null,result_message:null,requested_at:now,started_at:null,completed_at:null,attempt_count:0,last_error:null,checked_by_device:null,requested_by:actorId,updated_at:now});
 if(jobError)redirectTo(applicationId,"pan_verification_queue_failed");await admin.from("intermediary_onboarding_applications").update({registration_status:"pan_checking",updated_at:now}).eq("id",applicationId);revalidatePath(applicationPath(applicationId));redirectFresh(`${applicationPath(applicationId)}?success=pan_verification_requeued`);
}

export async function decidePospMispPartnerRoute(data:FormData){
 const {actorId,applicationId,admin}=await context(data);const decision=value(data,"partner_decision");const remark=value(data,"partner_decision_remark");
 if(!decision||!["import_existing_posp","do_not_proceed"].includes(decision))redirectTo(applicationId,"partner_decision_required");
 const {data:profile}=await admin.from("posp_misp_onboarding_profiles").select("id, partner_type, external_onboarding_id, workflow_stage, iib_remarks").eq("application_id",applicationId).maybeSingle<{id:string;partner_type:"posp"|"misp";external_onboarding_id:string|null;workflow_stage:string;iib_remarks:string|null}>();
 if(!profile?.id||profile.workflow_stage!=="pre_iib")redirectTo(applicationId,"stage_locked");if(profile.iib_remarks!==MATCHING_RECORD)redirectTo(applicationId,"partner_decision_not_available");
 const now=new Date().toISOString();
 if(decision==="import_existing_posp"){
  const confirmed=value(data,"existing_registration_confirmed")==="yes";const existingCode=value(data,"existing_registration_code")??profile.external_onboarding_id;if(profile.partner_type!=="posp"||!confirmed||!existingCode)redirectTo(applicationId,"existing_posp_confirmation_required");
  const {error}=await admin.from("posp_misp_onboarding_profiles").update({partner_decision:"not_applicable",requested_account_type:"posp",final_account_type:"posp",workflow_stage:"iib_processing",record_source:"legacy_import",existing_registration_confirmed:true,existing_registration_confirmed_by:actorId,existing_registration_confirmed_at:now,existing_registration_code:existingCode,existing_registration_remarks:remark,pre_iib_submitted_at:now,updated_by:actorId,updated_at:now}).eq("id",profile.id);if(error)redirectTo(applicationId,"partner_decision_failed");
  await admin.from("intermediary_onboarding_applications").update({final_type:"posp",status:"submitted",registration_status:"existing_posp_documents_pending",updated_at:now}).eq("id",applicationId);revalidatePath(applicationPath(applicationId));redirectFresh(`${applicationPath(applicationId)}?stage=documents&success=existing_posp_imported`);
 }
 const {error}=await admin.from("posp_misp_onboarding_profiles").update({partner_decision:decision,partner_decision_at:now,partner_decision_by:actorId,partner_decision_remark:remark,updated_by:actorId,updated_at:now}).eq("id",profile.id);if(error)redirectTo(applicationId,"partner_decision_failed");
 await admin.from("intermediary_onboarding_applications").update({status:"rejected",registration_status:"rejected",updated_at:now}).eq("id",applicationId);revalidatePath(applicationPath(applicationId));redirectFresh(`${applicationPath(applicationId)}?success=application_closed`);
}

export async function movePospMispToIib(data:FormData){
 const {actorId,applicationId,admin}=await context(data);
 const {data:profile}=await admin.from("posp_misp_onboarding_profiles").select("id, bank_id, workflow_stage, iib_remarks, final_account_type, requested_account_type, partner_type").eq("application_id",applicationId).maybeSingle<{id:string;bank_id:string|null;workflow_stage:string;iib_remarks:string|null;final_account_type:string|null;requested_account_type:string|null;partner_type:"posp"|"misp"}>();
 if(!profile?.id||!profile.bank_id)redirectTo(applicationId,"pre_iib_incomplete");if(profile.workflow_stage!=="pre_iib")redirectTo(applicationId,"stage_locked");
 const normalRoute=profile.iib_remarks==="No Data Found In POS System";if(!normalRoute&&profile.iib_remarks!==MATCHING_RECORD)redirectTo(applicationId,"pan_verification_required");
 const now=new Date().toISOString();const finalType=profile.partner_type;
 const {data:updated,error}=await admin.from("posp_misp_onboarding_profiles").update({workflow_stage:"iib_processing",requested_account_type:profile.partner_type,final_account_type:finalType,pre_iib_submitted_at:now,iib_match_warning_text:profile.iib_remarks===MATCHING_RECORD?MATCHING_RECORD:null,updated_by:actorId,updated_at:now}).eq("id",profile.id).eq("workflow_stage","pre_iib").select("id").maybeSingle<{id:string}>();
 if(error||!updated)redirectTo(applicationId,"workflow_save_failed");await admin.from("intermediary_onboarding_applications").update({final_type:finalType,registration_status:"documents_pending",updated_at:now}).eq("id",applicationId);revalidatePath(applicationPath(applicationId));redirectFresh(`${applicationPath(applicationId)}?stage=documents&success=documents_started`);
}

export async function completePospMispDocumentStage(data:FormData){
 const {actorId,applicationId,admin}=await context(data);
 const {data:profile}=await admin.from("posp_misp_onboarding_profiles").select("id, workflow_stage, existing_registration_confirmed").eq("application_id",applicationId).maybeSingle<{id:string;workflow_stage:string;existing_registration_confirmed:boolean}>();
 if(!profile?.id||profile.workflow_stage!=="iib_processing")redirectTo(applicationId,"stage_locked");
 const {data:documents}=await admin.from("intermediary_onboarding_documents").select("document_type").eq("application_id",applicationId).returns<Array<{document_type:string}>>();
 const types=new Set((documents??[]).map(item=>item.document_type));
 for(const required of ["aadhaar_front","pan_copy","cancelled_cheque"]){if(!types.has(required))redirectTo(applicationId,"partner_documents_incomplete")}
 const {data:activationData,error}=await admin.rpc("finalize_partner_activation_v2",{p_application_id:applicationId,p_actor_id:actorId});
 if(error||!activationData)redirectTo(applicationId,"partner_activation_failed");
 const result=activationData as PartnerActivationResult;const partnerId=typeof result.partner_id==="string"?result.partner_id:null;
 if(!partnerId)redirectTo(applicationId,"partner_activation_failed");
 revalidatePartnerViews(applicationId);
 if(profile.existing_registration_confirmed)redirect(`${partnersPath}?success=partner_activated&partner_id=${encodeURIComponent(partnerId)}`);
 redirect(`${partnersPath}?success=documents_completed&partner_id=${encodeURIComponent(partnerId)}`);
}

export async function requestPartnerPospConversion(data:FormData){
 const applicationId=value(data,"application_id");if(!applicationId)redirect("/customers/posp-misp");await requireScopedPospMispManager(applicationId);redirectFresh(`${applicationPath(applicationId)}?error=registration_type_locked`);
}

function revalidatePartnerViews(applicationId:string){revalidatePath(applicationPath(applicationId));revalidatePath("/customers/posp-misp");revalidatePath("/intermediaries");revalidatePath(partnersPath);revalidatePath("/intermediaries/posp");revalidatePath("/intermediaries/misp")}
function verificationPan(profile:{partner_type:"posp"|"misp";pan_number:string|null;dp_pan_number:string|null}|null|undefined){return (profile?.partner_type==="misp"?profile.dp_pan_number:profile?.pan_number)?.replace(/\s/g,"").toUpperCase()??""}
async function context(data:FormData){const applicationId=value(data,"application_id");if(!applicationId)redirect("/customers/posp-misp");const profile=await requireScopedPospMispManager(applicationId);return{actorId:profile.id,applicationId,admin:createSupabaseAdminClient()}}
function value(data:FormData,key:string){const current=data.get(key);return typeof current==="string"&&current.trim()?current.trim():null}
function redirectTo(applicationId:string,error:string):never{redirectFresh(`${applicationPath(applicationId)}?error=${error}`)}
function redirectFresh(href:string):never{redirect(`${href}${href.includes("?")?"&":"?"}fresh=${Date.now()}`)}