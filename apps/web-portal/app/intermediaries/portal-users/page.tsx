import { getIntermediaryGroupEmployeeScope, requireIntermediaryGroupViewer } from "@/lib/intermediary-group-access";
import { AppShell } from "@/components/shell";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { IntermediaryPortalUsersWorkspace } from "../portal-users-workspace";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Account = {
  id: string;
  intermediary_id: string;
  application_id: string | null;
  email: string;
  status: string;
  invited_at: string | null;
  created_at: string;
};

type Intermediary = {
  id: string;
  display_name: string;
  intermediary_code: string | null;
  intermediary_type: string;
  portal_access_status: string;
  email: string | null;
  application_id: string | null;
  updated_at: string;
};

export type PortalUserRow = {
  intermediary: Intermediary;
  account: Account | null;
};

export type AdditionalPortalAccount = {
 id:string; name:string; code:string; email:string|null; type:"Group"|"Branch"|"Group Associate"|"Partner Associate"; status:string; manageHref:string; reviewHref?:string; context:string; invitationStatus?:string; loginEmail?:string; phone?:string; contactName?:string; branchName?:string; branchId?:string;
};

type StatusFilter = "all" | "active" | "inactive";

export default async function IntermediaryPortalUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; type?: string; success?: string; error?: string }>;
}) {
  await requirePospMispManager();
  const query = await searchParams;
  const q = query.q?.trim().slice(0, 100) ?? "";
  const statusFilter: StatusFilter = query.status === "active" || query.status === "inactive" ? query.status : "all";
  const admin = createSupabaseAdminClient();

  const [accountsResult, intermediariesResult] = await Promise.all([
    admin
      .from("intermediary_portal_accounts")
      .select("id,intermediary_id,application_id,email,status,invited_at,created_at")
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<Account[]>(),
    admin
      .from("intermediaries")
      .select("id,display_name,intermediary_code,intermediary_type,portal_access_status,email,application_id,updated_at")
      .eq("intermediary_type", "partner")
      .order("updated_at", { ascending: false })
      .limit(500)
      .returns<Intermediary[]>(),
  ]);

  // Reuse the group hierarchy access scope; never expose organisation-wide
  // account data to a restricted intermediary manager.
  const viewer = await requireIntermediaryGroupViewer();
  const scope = await getIntermediaryGroupEmployeeScope(viewer);
  const extraRows: AdditionalPortalAccount[] = [];
  let extraLoadError = false;
  if (scope.mode === "organization") {
    const [{data: groups,error:groupError},{data:partners,error:partnerError},{data:branches,error:branchError},{data:identities,error:identityError},{data:groupAssociates,error:groupAssociateError},{data:partnerAssociates,error:partnerAssociateError}] = await Promise.all([
      admin.from("intermediary_groups").select("id,group_name,group_code,status").eq("status","active"),
      admin.from("partners").select("id,display_name,partner_code,parent_partner_id,source_application_id"),
      admin.from("partner_branch_profiles").select("partner_id,branch_name,contact_name,email,phone"),
      admin.from("portal_access_identities").select("entity_type,entity_id,login_email,status,created_at"),
      admin.from("group_portal_associate_accounts").select("id,group_id,name,phone_number,email,status"),
      admin.from("partner_portal_associate_accounts").select("id,intermediary_id,name,phone_number,email,status"),
    ]);
    extraLoadError = Boolean(groupError||partnerError||branchError||identityError||groupAssociateError||partnerAssociateError);
    if (!extraLoadError) {
      const groupById = new Map((groups??[]).map(g=>[g.id,g]));
      const partnerById = new Map((partners??[]).map(p=>[p.id,p]));
      const branchById = new Map((branches??[]).map(p=>[p.partner_id,p]));
      const branchIds = new Set(branchById.keys());
      const identityByEntity = new Map((identities??[]).map(a=>[`${a.entity_type}:${a.entity_id}`,a]));
      for (const g of groups??[]) {
        const login=identityByEntity.get(`group:${g.id}`);
        extraRows.push({id:`group:${g.id}`,name:g.group_name,code:g.group_code,email:login?.login_email??null,type:"Group",status:login?.status??"not_created",manageHref:"/intermediaries/groups/login-access",context:"Group login"});
      }
      for (const p of partners??[]) {
        if (!branchIds.has(p.id)) continue;
        const login=identityByEntity.get(`branch:${p.id}`);
        const parent = partnerById.get(p.parent_partner_id??"");
        const applicationId = parent?.source_application_id ?? p.source_application_id;
        const branchProfile = branchById.get(p.id);
        extraRows.push({id:`branch:${p.id}`,name:p.display_name,code:p.partner_code,email:login?.login_email??branchProfile?.email??null,type:"Branch",status:login?.status??"not_created",manageHref:"/intermediaries/groups/login-access",reviewHref:applicationId?`/intermediaries/applications/${applicationId}`:undefined,context:parent?.display_name??"Branch login",invitationStatus:login?.created_at?"Sent":"Not Sent",loginEmail:branchProfile?.email??null,phone:branchProfile?.phone??null,contactName:branchProfile?.contact_name??null,branchName:branchProfile?.branch_name??null,branchId:p.id});
      }
      for (const a of groupAssociates??[]) {
        const group=groupById.get(a.group_id);
        if (!group) continue;
        extraRows.push({id:`group-associate:${a.id}`,name:a.name,code:group.group_code,email:a.email,phone:a.phone_number,type:"Group Associate",status:a.status,manageHref:`/intermediaries/groups/${a.group_id}/associate-accounts`,context:group.group_name});
      }
      const partnerByIntermediary = new Map((intermediariesResult.data??[]).map(p=>[p.id,p]));
      for (const a of partnerAssociates??[]) {
        const partner=partnerByIntermediary.get(a.intermediary_id);
        if (!partner?.application_id) continue;
        extraRows.push({id:`partner-associate:${a.id}`,name:a.name,code:partner.intermediary_code??"",email:a.email,phone:a.phone_number,type:"Partner Associate",status:a.status,manageHref:`/intermediaries/applications/${partner.application_id}/associate-accounts`,context:partner.display_name});
      }
    }
  }
  const loadError = accountsResult.error ?? intermediariesResult.error ?? (extraLoadError ? new Error("Additional portal accounts could not be loaded") : null);
  const accountMap = new Map((accountsResult.data ?? []).map((item) => [item.intermediary_id, item]));
  const allRows: PortalUserRow[] = (intermediariesResult.data ?? []).map((intermediary) => ({
    intermediary,
    account: accountMap.get(intermediary.id) ?? null,
  }));

  return (
    <AppShell title="Intermediary Portal Users">
      <IntermediaryPortalUsersWorkspace rows={allRows} extraRows={extraRows} initialType={["Partner","Group","Branch","Group Associate","Partner Associate"].includes(query.type??"") ? query.type! : "all"} initialQuery={q} initialStatus={statusFilter} success={query.success} error={query.error} loadError={Boolean(loadError)} />
    </AppShell>
  );
}
