import {createSupabaseAdminClient} from "@/lib/supabase-admin";
import {getIntermediaryGroupManager,getIntermediaryGroupEmployeeScope} from "@/lib/intermediary-group-access";
import {GroupHeaderPartnerAssignForm} from "./header-partner-assign-form";

export async function GroupHeaderPartnerAssignment({groupId}:{groupId:string}) {
 const manager=await getIntermediaryGroupManager();
 if(!manager) return null;
 const scope=await getIntermediaryGroupEmployeeScope(manager);
 if(scope.mode!=="organization") return null;
 const admin=createSupabaseAdminClient();
 const [{data:group},{data:candidates,error:candidateError},{data:occupied,error:occupiedError}]=await Promise.all([
  admin.from("intermediary_groups").select("status,group_mode").eq("id",groupId).maybeSingle(),
  admin.from("partners").select("id,display_name,partner_code").is("parent_partner_id",null).eq("partner_status","active_partner").order("display_name").limit(500),
  admin.from("intermediary_group_memberships").select("partner_id").is("effective_to",null)
 ]);
 if(group?.status!=="active"||group?.group_mode!=="business"||candidateError||occupiedError) return null;
 const assigned=new Set((occupied??[]).map(p=>p.partner_id));
 const choices=(candidates??[]).filter(p=>!assigned.has(p.id));
 return <GroupHeaderPartnerAssignForm groupId={groupId} choices={choices}/>;
}
