"use server";

import { hasEffectiveCapability, hasAnyEffectiveCapability } from "@/lib/effective-permissions";

import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManagePospMispOnboarding } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type PartnerType="posp"|"misp";
type RowRecord={id:string;row_number:number;partner_type:PartnerType;source_data:Record<string,unknown>;normalized_data:Record<string,unknown>};
type PanJobRecord={id:string;status:string};
type ProfileRecord={id:string;application_id:string};

export async function submitPospMispImportBatchV2(data:FormData){
  const manager=await currentManager();
  const batchId=value(data,"batch_id");
  const retryFailed=data.get("retry_failed")==="true";
  if(!batchId)redirect("/customers/posp-misp/import?error=batch_missing");
  const admin=createSupabaseAdminClient();
  const expected=retryFailed?"failed":"parsed";
  const{data:rows,error}=await admin.from("posp_misp_import_rows").select("id,row_number,partner_type,source_data,normalized_data").eq("import_batch_id",batchId).eq("status",expected).order("row_number").returns<RowRecord[]>();
  if(error||!rows?.length)redirect(`/customers/posp-misp/import/${batchId}?error=no_valid_rows`);

  for(const row of rows){
    const{data:claimed}=await admin.from("posp_misp_import_rows").update({status:"processing",error_message:null}).eq("id",row.id).eq("status",expected).select("id").maybeSingle<{id:string}>();
    if(!claimed)continue;

    let applicationId:string|null=null;
    let onboardingId:string|null=null;
    try{
      const n=row.normalized_data??{};
      validate(n,row.partner_type);
      onboardingId=string(n.external_onboarding_id)!;
      const{data:duplicate}=await admin.from("posp_misp_onboarding_profiles").select("id,application_id").eq("external_onboarding_id",onboardingId).maybeSingle<ProfileRecord>();
      if(duplicate)throw new Error(`Onboarding ID ${onboardingId} already exists.`);

      // An earlier failed import could have created the intermediary through a database
      // trigger before a later step failed. The application was removed, but the generated
      // intermediary code could remain. It is safe to remove it here because no onboarding
      // profile exists for this external ID.
      if(retryFailed){
        const{error:orphanCleanupError}=await admin.from("intermediaries").delete().eq("intermediary_code",onboardingId);
        if(orphanCleanupError)throw stage("Clean previous failed intermediary",orphanCleanupError);
      }

      const now=new Date().toISOString();
      const applicantPhone=string(n.applicant_phone);
      const applicantEmail=string(n.applicant_email)?.toLowerCase()??null;
      const{data:application,error:applicationError}=await admin.from("intermediary_onboarding_applications").insert({initiated_by:manager.id,source:"excel_import",requested_type:row.partner_type,final_type:null,status:"submitted",registration_status:"pan_checking",current_step:1,applicant_phone:applicantPhone,applicant_email:applicantEmail,draft_data:n,submitted_at:now,updated_at:now}).select("id").single<{id:string}>();
      if(applicationError||!application)throw stage("Create application",applicationError);
      applicationId=application.id;

      const isMisp=row.partner_type==="misp";
      const profilePayload={
        application_id:application.id,partner_type:row.partner_type,requested_account_type:row.partner_type,final_account_type:null,partner_decision:"not_applicable",
        associate_employee_id:string(n.associate_employee_id),associate_profile_id:string(n.associate_profile_id),associate_name:string(n.associate_name),associate_id:string(n.associate_id),external_onboarding_id:onboardingId,document_received_at:string(n.document_received_at),
        pos_first_name:isMisp?null:string(n.pos_first_name),pos_middle_name:isMisp?null:string(n.pos_middle_name),pos_last_name:isMisp?null:string(n.pos_last_name),pos_name:isMisp?null:string(n.pos_name),misp_name:isMisp?string(n.misp_name):null,
        applicant_phone:applicantPhone,applicant_email:applicantEmail,pan_number:string(n.pan_number)?.toUpperCase()??null,gst_number:string(n.gst_number)?.toUpperCase()??null,address:string(n.address),city:string(n.city),state:string(n.state),postal_code:string(n.postal_code),
        bank_id:string(n.bank_id),bank_name:string(n.bank_name),bank_account_number:string(n.bank_account_number),bank_ifsc_code:string(n.bank_ifsc_code)?.toUpperCase()??null,oem_name:isMisp?string(n.oem_name):null,
        dp_first_name:isMisp?string(n.dp_first_name):null,dp_middle_name:isMisp?string(n.dp_middle_name):null,dp_last_name:isMisp?string(n.dp_last_name):null,dp_name:isMisp?string(n.dp_name):null,dp_phone:isMisp?string(n.dp_phone):null,dp_email:isMisp?string(n.dp_email)?.toLowerCase()??null:null,dp_pan_number:isMisp?string(n.dp_pan_number)?.toUpperCase()??null:null,
        dp_date_of_birth:isMisp?string(n.dp_date_of_birth):null,dp_aadhaar_last_four:isMisp?string(n.dp_aadhaar_last_four):null,dp_aadhaar_hash:isMisp?string(n.dp_aadhaar_hash):null,dp_aadhaar_number_encrypted:isMisp?string(n.dp_aadhaar_number_encrypted):null,
        date_of_birth:isMisp?null:string(n.date_of_birth),aadhaar_last_four:isMisp?null:string(n.aadhaar_last_four),aadhaar_hash:isMisp?null:string(n.aadhaar_hash),aadhaar_number_encrypted:isMisp?null:string(n.aadhaar_number_encrypted),
        education_status:"not_received",iib_remarks:null,iib_upload_status:"pending",iib_uploaded:false,workflow_stage:"pre_iib",pre_iib_submitted_at:now,source:"excel_import",import_batch_id:batchId,import_row_number:row.row_number,raw_data:row.source_data??{},created_by:manager.id,updated_by:manager.id,updated_at:now
      };

      let profileResult=await admin.from("posp_misp_onboarding_profiles").insert(profilePayload).select("id").single<{id:string}>();
      if(profileResult.error&&isIntermediaryCodeDuplicate(profileResult.error)&&onboardingId){
        await admin.from("intermediaries").delete().eq("intermediary_code",onboardingId);
        profileResult=await admin.from("posp_misp_onboarding_profiles").insert(profilePayload).select("id").single<{id:string}>();
      }
      const profile=profileResult.data;
      if(profileResult.error||!profile)throw stage("Create profile",profileResult.error);

      const fullName=isMisp?string(n.dp_name):string(n.pos_name);
      const{error:contactError}=await admin.from("intermediary_onboarding_contacts").upsert({application_id:application.id,contact_role:isMisp?"misp_dp":"posp",full_name:fullName,phone:applicantPhone,email:applicantEmail,is_designated_person:isMisp,login_required:false,membership_status:"pending"},{onConflict:"application_id,contact_role"});
      if(contactError)throw stage("Create contact",contactError);

      const verificationPan=(isMisp?string(n.dp_pan_number):string(n.pan_number))?.replace(/\s/g,"").toUpperCase();
      const{data:existingJob,error:jobLookupError}=await admin.from("pan_verification_jobs").select("id,status").eq("application_id",application.id).maybeSingle<PanJobRecord>();
      if(jobLookupError)throw stage("Check PAN verification queue",jobLookupError);
      if(existingJob){
        const{error:jobUpdateError}=await admin.from("pan_verification_jobs").update({onboarding_profile_id:profile.id,partner_type:row.partner_type,pan_number:verificationPan,status:"pending",result_code:null,result_message:null,started_at:null,completed_at:null,last_error:null,checked_by_device:null,lease_expires_at:null,requested_by:manager.id,requested_at:now,updated_at:now}).eq("id",existingJob.id);
        if(jobUpdateError)throw stage("Confirm PAN verification queue",jobUpdateError);
      }else{
        const{error:jobInsertError}=await admin.from("pan_verification_jobs").insert({application_id:application.id,onboarding_profile_id:profile.id,partner_type:row.partner_type,pan_number:verificationPan,status:"pending",result_code:null,result_message:null,requested_at:now,started_at:null,completed_at:null,attempt_count:0,last_error:null,checked_by_device:null,requested_by:manager.id,updated_at:now});
        if(jobInsertError)throw stage("Queue PAN verification",jobInsertError);
      }

      const{error:rowError}=await admin.from("posp_misp_import_rows").update({status:"submitted",application_id:application.id,error_message:null}).eq("id",row.id);
      if(rowError)throw stage("Finalize import row",rowError);
    }catch(error){
      if(applicationId){
        await admin.from("pan_verification_jobs").delete().eq("application_id",applicationId);
        await admin.from("intermediary_onboarding_contacts").delete().eq("application_id",applicationId);
        await admin.from("posp_misp_onboarding_profiles").delete().eq("application_id",applicationId);
        await admin.from("intermediary_onboarding_applications").delete().eq("id",applicationId);
      }
      if(onboardingId)await admin.from("intermediaries").delete().eq("intermediary_code",onboardingId);
      const ref=randomUUID().slice(0,8);
      console.error(`POSP/MISP v2 import row ${row.row_number} failed [${ref}]`,error);
      await admin.from("posp_misp_import_rows").update({status:"failed",application_id:null,error_message:`${errorMessage(error)} Reference ${ref}.`}).eq("id",row.id);
    }
  }
  await refreshBatch(batchId);
  redirect(`/customers/posp-misp/import/${batchId}?success=${retryFailed?"retried":"submitted"}`);
}

function validate(n:Record<string,unknown>,type:PartnerType){
  const required=["associate_employee_id","external_onboarding_id","applicant_phone","applicant_email","address","city","state","postal_code","bank_id","bank_account_number","bank_ifsc_code"];
  for(const key of required)if(!string(n[key]))throw new Error(`Required field ${key.replaceAll("_"," ")} is missing.`);
  if(type==="posp"&&(!string(n.pos_first_name)||!string(n.pos_last_name)||!string(n.pan_number)||!string(n.date_of_birth)||!string(n.aadhaar_hash)))throw new Error("POSP identity fields are incomplete.");
  if(type==="misp"&&(!string(n.misp_name)||!string(n.dp_first_name)||!string(n.dp_last_name)||!string(n.dp_pan_number)||!string(n.dp_date_of_birth)||!string(n.dp_aadhaar_hash)||!string(n.oem_name)))throw new Error("MISP designated-person fields are incomplete.");
}
async function currentManager(){const token=await getServerAccessToken();const{profile}=await getAuthenticatedProfile(token);if(!profile?.id||!(await hasAnyEffectiveCapability(profile, ["create_intermediary_application", "review_intermediary_application"])))throw new Error("Not authorized.");return{id:profile.id}}
async function refreshBatch(batchId:string){const admin=createSupabaseAdminClient();const{data}=await admin.from("posp_misp_import_rows").select("status").eq("import_batch_id",batchId).returns<Array<{status:string}>>();const rows=data??[];const count=(s:string)=>rows.filter(r=>r.status===s).length;const submitted=count("submitted"),failed=count("failed"),parsed=count("parsed"),processing=count("processing"),invalid=count("invalid");const status=processing?"processing":rows.length&&submitted===rows.length?"submitted":submitted?"partially_submitted":failed&&!parsed?"failed":"parsed";await admin.from("posp_misp_import_batches").update({total_rows:rows.length,valid_rows:parsed,invalid_rows:invalid,pending_rows:parsed+processing,submitted_rows:submitted,failed_rows:failed,status,submitted_at:submitted?new Date().toISOString():null}).eq("id",batchId)}
function string(value:unknown){return typeof value==="string"&&value.trim()?value.trim():null}
function value(data:FormData,key:string){const current=data.get(key);return typeof current==="string"&&current.trim()?current.trim():null}
function stage(name:string,error:unknown){return new Error(`${name} failed${error?`: ${errorMessage(error)}`:"."}`)}
function errorMessage(error:unknown){if(error instanceof Error)return error.message;if(error&&typeof error==="object"&&"message" in error)return String((error as{message?:unknown}).message??"Unknown database error");return String(error??"Unknown error")}
function isIntermediaryCodeDuplicate(error:unknown){const message=errorMessage(error);return message.includes("intermediaries_intermediary_code_key")||message.includes("intermediary_code")&&message.includes("duplicate key")}
