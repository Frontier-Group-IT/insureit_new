import type { SupabaseClient } from "@supabase/supabase-js";

type PartnerType="individual_proprietor"|"dealership"|"corporate"|"group"|"posp"|"misp";
type BeginApplicationInput={profileId?:string|null;initiatedBy:string;partnerType:PartnerType;phone:string;email?:string|null;draftData:Record<string,unknown>};
type PortalCustomerMembershipInput={profileId:string;phone:string;email?:string|null};

export async function beginPortalOnboardingApplication(admin:SupabaseClient,input:BeginApplicationInput){
 const now=new Date().toISOString();
 if(input.partnerType==="posp"||input.partnerType==="misp"){
  const payload={profile_id:input.profileId??null,initiated_by:input.initiatedBy,source:"manager_portal",requested_type:input.partnerType,final_type:null,status:"submitted",current_step:1,applicant_phone:input.phone,applicant_email:input.email??null,draft_data:input.draftData,submitted_at:now,updated_at:now};
  let existingQuery=admin.from("intermediary_onboarding_applications").select("id").not("status","in","(approved,rejected,cancelled)").order("created_at",{ascending:false}).limit(1);
  existingQuery=input.profileId?existingQuery.eq("profile_id",input.profileId):existingQuery.eq("source","manager_portal").eq("requested_type",input.partnerType).eq("applicant_phone",input.phone);
  const {data:existing,error:lookupError}=await existingQuery.maybeSingle<{id:string}>();if(lookupError)throw lookupError;
  if(existing){const {data,error}=await admin.from("intermediary_onboarding_applications").update(payload).eq("id",existing.id).select("id").single<{id:string}>();if(error||!data)throw error??new Error("Unable to update intermediary onboarding application.");return data}
  const {data,error}=await admin.from("intermediary_onboarding_applications").insert(payload).select("id").single<{id:string}>();if(error||!data)throw error??new Error("Unable to create intermediary onboarding application.");return data;
 }
 const payload={profile_id:input.profileId??null,initiated_by:input.initiatedBy,source:"manager_portal",partner_type:input.partnerType,status:"submitted",current_step:4,applicant_phone:input.phone,applicant_email:input.email??null,draft_data:input.draftData,submitted_at:now};
 let existingQuery=admin.from("customer_onboarding_applications").select("id").not("status","in","(approved,rejected,cancelled)").order("created_at",{ascending:false}).limit(1);
 existingQuery=input.profileId?existingQuery.eq("profile_id",input.profileId):existingQuery.eq("source","manager_portal").eq("partner_type",input.partnerType).eq("applicant_phone",input.phone);
 const {data:existing,error:lookupError}=await existingQuery.maybeSingle<{id:string}>();if(lookupError)throw lookupError;
 if(existing){const {data,error}=await admin.from("customer_onboarding_applications").update(payload).eq("id",existing.id).select("id").single<{id:string}>();if(error||!data)throw error??new Error("Unable to update onboarding application.");return data}
 const {data,error}=await admin.from("customer_onboarding_applications").insert(payload).select("id").single<{id:string}>();if(error||!data)throw error??new Error("Unable to create onboarding application.");return data;
}

export async function approvePortalOnboardingApplication(admin:SupabaseClient,applicationId:string,customerId:string,reviewerId:string,membership?:PortalCustomerMembershipInput){
 if(membership){
  const {error}=await admin.rpc("finalize_portal_customer_onboarding",{
   p_application_id:applicationId,
   p_customer_id:customerId,
   p_profile_id:membership.profileId,
   p_reviewer_id:reviewerId,
   p_phone:membership.phone,
   p_email:membership.email??null,
  });
  if(error)throw error;
  return;
 }
 const now=new Date().toISOString();
 const {error}=await admin.from("customer_onboarding_applications").update({status:"approved",customer_id:customerId,reviewed_by:reviewerId,reviewed_at:now,completed_at:now}).eq("id",applicationId);
 if(error)throw error;
}

export async function markPortalOnboardingForCorrection(admin:SupabaseClient,applicationId:string,message:string){
 const {data:intermediary}=await admin.from("intermediary_onboarding_applications").select("draft_data").eq("id",applicationId).maybeSingle<{draft_data:Record<string,unknown>|null}>();
 if(intermediary){await admin.from("intermediary_onboarding_applications").update({status:"changes_requested",draft_data:{...(intermediary.draft_data??{}),processing_error:message},updated_at:new Date().toISOString()}).eq("id",applicationId);return}
 const {data}=await admin.from("customer_onboarding_applications").select("draft_data").eq("id",applicationId).maybeSingle<{draft_data:Record<string,unknown>|null}>();await admin.from("customer_onboarding_applications").update({status:"changes_requested",draft_data:{...(data?.draft_data??{}),processing_error:message}}).eq("id",applicationId);
}
