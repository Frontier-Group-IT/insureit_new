import { getAccessibleIntermediaryIds } from "@/lib/employee-access-scope";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canAccessOperationsHeadIntake, getOperationsHeadDownlinePolicyScope } from "@/lib/policy-access-scope";
import { redirect } from "next/navigation";
import { requireAnyCapability, requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PolicyIntakeSource={id:string;intermediary_type:"posp"|"misp"|"partner";display_name:string;intermediary_code:string|null};
async function operationsHeadProfile() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  return profile?.role === "operations_head_life" ? profile : null;
}
export async function requirePolicyIntakeCreator(sourceId?: string) {
  const profile = await operationsHeadProfile();
  if (!profile) return requireCapability("create_policy_intakes", "edit");
  if (!sourceId) redirect("/access-denied");
  const scope = await getOperationsHeadDownlinePolicyScope(profile.id);
  const admin = createSupabaseAdminClient();
  const { data } = await admin.from("intermediaries")
    .select("intermediary_code").eq("id", sourceId)
    .maybeSingle<{ intermediary_code: string | null }>();
  if (!data?.intermediary_code || !scope.intermediaryCodes.includes(data.intermediary_code.trim())) redirect("/access-denied");
  return profile;
}
export async function requirePolicyIntakeViewer(intakeId?: string) {
  const profile = await operationsHeadProfile();
  if (!profile) return requireAnyCapability([{ capability: "view_policy_intakes" }, { capability: "review_policy_intakes", minimumAccess: "edit" }, { capability: "finalize_policy_intakes", minimumAccess: "approve" }]);
  if (!intakeId || !(await canAccessOperationsHeadIntake(profile.id, intakeId))) redirect("/access-denied");
  return profile;
}
export async function requirePolicyIntakeReviewer(intakeId?: string) {
  const profile = await operationsHeadProfile();
  if (!profile) return requireCapability("review_policy_intakes", "edit");
  if (!intakeId || !(await canAccessOperationsHeadIntake(profile.id, intakeId))) redirect("/access-denied");
  return profile;
}
export async function requirePolicyIntakeFinalizer(intakeId?: string) {
  const profile = await operationsHeadProfile();
  if (!profile) return requireCapability("finalize_policy_intakes", "approve");
  if (!intakeId || !(await canAccessOperationsHeadIntake(profile.id, intakeId))) redirect("/access-denied");
  return profile;
}
export async function loadEligiblePolicyIntakeSources(profile:{id:string;role:string|null}){const admin=createSupabaseAdminClient();const ids=await getAccessibleIntermediaryIds(profile.id,profile.role,"create_policy_intakes");if(ids!==null&&!ids.length)return[] as PolicyIntakeSource[];let query=admin.from("intermediaries").select("id,intermediary_type,display_name,intermediary_code").in("intermediary_type",["posp","misp","partner"]).eq("account_status","active").order("display_name",{ascending:true});if(ids!==null)query=query.in("id",ids);const{data,error}=await query.returns<PolicyIntakeSource[]>();if(error)throw new Error("policy_intake_sources_unavailable");return(data??[]).filter(item=>item.display_name?.trim());}
