import { getBranchActivationStatuses } from "@/lib/branch-activation-status";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { getIntermediaryGroupManager, getIntermediaryGroupEmployeeScope } from "@/lib/intermediary-group-access";
import { FormSubmitButton } from "@/components/form-submit-button";
import { createBranchProfile } from "@/app/intermediaries/groups/branches/new/actions";
import { BranchRegisterWorkspace, type BranchRegisterRow } from "@/app/intermediaries/groups/branches/branch-register-workspace";

type Partner = {id:string;partner_code:string;display_name:string;source_application_id:string|null;parent_partner_id:string|null};
type Branch = {id:string;partner_code:string;display_name:string;partner_kind:string;partner_status:string;parent_partner_id:string|null};
type Owner = {application_id:string;associate_employee_id:string|null};

export async function PartnerBranchSections({applicationId}:{applicationId:string}) {
 const manager=await getIntermediaryGroupManager();
 const admin=createSupabaseAdminClient();
 const {data:partner,error:partnerError}=await admin.from("partners").select("id,partner_code,display_name,source_application_id,parent_partner_id").eq("source_application_id",applicationId).is("parent_partner_id",null).eq("partner_status","active_partner").maybeSingle<Partner>();
 if(partnerError||!partner) return {form:<Message>Active parent Partner mapping could not be resolved; Branch onboarding is unavailable.</Message>,register:<Message>Branch records cannot be loaded without a verified parent Partner.</Message>};
 // Scope is independently validated here AND again inside the create action.
 let canCreate=false;
 if(manager){
  const scope=await getIntermediaryGroupEmployeeScope(manager);
  if(scope.mode==="organization")canCreate=true;
  else {
   const [{data:intermediary},{data:onboarding}]=await Promise.all([
    admin.from("intermediaries").select("application_id,associate_employee_id").eq("application_id",applicationId).eq("intermediary_type","partner").maybeSingle<Owner>(),
    admin.from("posp_misp_onboarding_profiles").select("application_id,associate_employee_id").eq("application_id",applicationId).maybeSingle<Owner>(),
   ]);
   const owner=intermediary?.associate_employee_id??onboarding?.associate_employee_id;
   canCreate=Boolean(owner&&scope.employeeIds.includes(owner));
  }
 }
 const {data:branches,error:branchError}=await admin.from("partners").select("id,partner_code,display_name,partner_kind,partner_status,parent_partner_id").eq("parent_partner_id",partner.id).order("display_name").returns<Branch[]>();
 const {data:branchProfiles,error:profileError}=await admin.from("partner_branch_profiles").select("partner_id,email,phone,contact_name,address").in("partner_id",(branches??[]).map(p=>p.id).length?(branches??[]).map(p=>p.id):["00000000-0000-0000-0000-000000000000"]);
 const branchIds=new Set((branchProfiles??[]).map(x=>x.partner_id));
 const activation=await getBranchActivationStatuses([...branchIds]);
 const {data:logins}=await admin.from("portal_access_identities").select("entity_id,status").eq("entity_type","branch").in("entity_id",[...branchIds].length?[...branchIds]:["00000000-0000-0000-0000-000000000000"]);
 const disabled=new Set((logins??[]).filter(x=>x.status==="disabled").map(x=>x.entity_id));
 const profileById=new Map((branchProfiles??[]).map(x=>[x.partner_id,x]));
 const rows:BranchRegisterRow[]=(branches??[]).filter(x=>branchIds.has(x.id)).map(x=>({
   id:x.id,branch_code:x.partner_code,branch_name:x.display_name,branch_kind:x.partner_kind,branch_status:x.partner_status,email:profileById.get(x.id)?.email??null,phone:profileById.get(x.id)?.phone??null,contact_name:profileById.get(x.id)?.contact_name??null,address:profileById.get(x.id)?.address??null,login_disabled:disabled.has(x.id),invitation_status:activation.get(x.id)??"unknown",parent_partner_id:partner.id,parent_partner_code:partner.partner_code,parent_partner_name:partner.display_name,group_code:null,group_name:null,employee_code:null,employee_name:null
 }));
 const loadError=Boolean(branchError||profileError);
 const fieldClass="h-9 w-full rounded-lg border border-[#DCE5EF] bg-white px-3 text-[11px] text-[#17203A]";
 const labelClass="grid gap-1 text-[10px] font-semibold text-[#526178]";
 const field=(label:string,name:string,type="text")=><label className={labelClass} key={name}>{label} *<input name={name} type={type} required className={fieldClass}/></label>;
 return {
  form:<section className="bg-white">
    <div className="border-b border-[#E7ECF3] px-5 py-3"><h2 className="text-[13px] font-semibold text-[#17203A]">Branch Onboarding</h2></div>
    {!canCreate?<Message>You can view Branches for this Partner, but your account does not have permission to create Branches.</Message>:
    <form action={createBranchProfile} className="space-y-3 px-5 py-3">
      <input type="hidden" name="parent_partner_id" value={partner.id}/>
      <input type="hidden" name="return_application_id" value={applicationId}/>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">{field("Branch Name","branch_name")}{field("Phone Number","phone","tel")}{field("Email ID","email","email")}{field("Contact Name","contact_name")}</div>
      <div className="grid items-end gap-3 grid-cols-[minmax(0,1fr)_auto]">
        <label className={labelClass}>Address *<input name="address" required maxLength={500} className={fieldClass} placeholder="Enter branch address"/></label>
        <div className="flex justify-end"><FormSubmitButton label="Save" pendingLabel="Saving…"/></div>
      </div>
    </form>}
  </section>,
  register:<section aria-label="Branch Register"><BranchRegisterWorkspace rows={rows} canManage={canCreate} canPermanentDelete={manager?.role==="it_super_user"} loadError={loadError} embedded hideParentPartner applicationBranchView/></section>
 };
}
function Message({children}:{children:React.ReactNode}) {return <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-900">{children}</div>;}
