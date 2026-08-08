"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type Application={id:string;requested_type:"posp"|"misp";status:string};
type OnboardingProfile={id:string;workflow_stage:string;final_account_type:"posp"|"misp"|"partner"|null;partner_type:"posp"|"misp";partner_decision:string;iib_remarks:string|null};
const path=(id:string)=>`/intermediaries/applications/${id}`;

export async function approvePospMispApplication(formData:FormData){
 const applicationId=value(formData,"application_id");if(!applicationId)redirect("/customers/posp-misp?error=missing_application");
 const reviewer=await requireScopedPospMispManager(applicationId);if(!reviewer?.id)redirectFresh(`${path(applicationId)}?error=unauthorized`);
 const admin=createSupabaseAdminClient();
 const {data:application,error:applicationError}=await admin.from("intermediary_onboarding_applications").select("id,requested_type,status").eq("id",applicationId).maybeSingle<Application>();
 if(applicationError||!application)redirectFresh(`${path(applicationId)}?error=application_not_found`);
 const {data:onboarding,error:onboardingError}=await admin.from("posp_misp_onboarding_profiles").select("id,workflow_stage,final_account_type,partner_type,partner_decision,iib_remarks").eq("application_id",applicationId).maybeSingle<OnboardingProfile>();
 if(onboardingError||!onboarding)redirectFresh(`${path(applicationId)}?error=posp_misp_profile_missing`);if(onboarding.workflow_stage!=="completed")redirectFresh(`${path(applicationId)}?error=application_not_ready`);
 const finalType=onboarding.final_account_type??onboarding.partner_type;const normalRoute=onboarding.iib_remarks==="No Data Found In POS System"&&["posp","misp"].includes(finalType);const partnerRoute=onboarding.iib_remarks==="Matching Record Found In DataBase"&&onboarding.partner_decision==="convert_to_partner"&&finalType==="partner";if(!normalRoute&&!partnerRoute)redirectFresh(`${path(applicationId)}?error=application_not_ready`);
 const now=new Date().toISOString();const {data:intermediary,error:intermediaryError}=await admin.from("intermediaries").update({intermediary_type:finalType,account_status:"active",compliance_status:finalType==="partner"?"restricted_partner":"approved",visibility_level:finalType==="partner"?"restricted":"standard",activated_at:now,updated_by:reviewer.id,updated_at:now}).eq("onboarding_profile_id",onboarding.id).select("id").maybeSingle<{id:string}>();if(intermediaryError||!intermediary?.id)redirectFresh(`${path(applicationId)}?error=intermediary_activation_failed`);
 const {error:applicationUpdateError}=await admin.from("intermediary_onboarding_applications").update({status:"approved",final_type:finalType,reviewed_by:reviewer.id,reviewed_at:now,completed_at:now,updated_at:now}).eq("id",applicationId);if(applicationUpdateError)redirectFresh(`${path(applicationId)}?error=intermediary_activation_failed`);
 revalidatePath("/intermediaries");revalidatePath("/customers/posp-misp");revalidatePath(path(applicationId));redirectFresh(`${path(applicationId)}?success=intermediary_activated`);
}
function redirectFresh(href:string):never{redirect(href)}
function value(formData:FormData,name:string){const field=formData.get(name);return typeof field==="string"&&field.trim()?field.trim():null}
