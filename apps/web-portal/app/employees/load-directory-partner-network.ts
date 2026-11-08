import { getAccessibleIntermediaryIds } from "@/lib/employee-access-scope";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { getPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import type { DirectoryPartner } from "./employee-organization-tree";

// Use precisely the same intermediary access scope as the existing register.
// No unrestricted service-role results may be sent to the browser.
export async function loadDirectoryPartnerNetwork(visibleEmployeeIds: string[]): Promise<{ partners: DirectoryPartner[]; error: boolean }> {
  const viewer = await getPospMispManager(true);
  if (!viewer || !visibleEmployeeIds.length) return { partners: [], error: false };
  const allowed = await getAccessibleIntermediaryIds(viewer.id, viewer.role);
  if (allowed !== null && !allowed.length) return { partners: [], error: false };

  const admin = createSupabaseAdminClient();
  type Intermediary = { id: string; application_id: string | null; display_name: string; intermediary_code: string | null; intermediary_type: string; requested_type: string; account_status: string };
  type Onboarding = { application_id: string; associate_employee_id: string | null };
  type Application = { id: string; requested_type: string; final_type: string | null; partner_status: string | null; partner_record_id: string | null };
  type Partner = { id: string; parent_partner_id: string | null; display_name: string; partner_code: string | null };

  // The intermediary register may have multiple pages; never silently truncate the network.
  const intermediaryRows: Intermediary[] = [];
  const batches = allowed === null ? [null] : Array.from({ length: Math.ceil(allowed.length / 100) }, (_, i) => allowed.slice(i * 100, i * 100 + 100));
  for (const ids of batches) {
    const result = await fetchAllPages<Intermediary, unknown>((from, to) => {
      let q = admin.from("intermediaries").select("id,application_id,display_name,intermediary_code,intermediary_type,requested_type,account_status").order("id").range(from, to);
      if (ids) q = q.in("id", ids);
      return q.returns<Intermediary[]>();
    });
    if (result.error) return { partners: [], error: true };
    intermediaryRows.push(...(result.data ?? []));
  }
  const appIds = [...new Set(intermediaryRows.map((p) => p.application_id).filter((v): v is string => Boolean(v)))];
  const onboarding = new Map<string, Onboarding>();
  const applications = new Map<string, Application>();
  for (let i = 0; i < appIds.length; i += 100) {
    const batch = appIds.slice(i, i + 100);
    const [onboardingResult, applicationResult] = await Promise.all([
      admin.from("posp_misp_onboarding_profiles").select("application_id,associate_employee_id").in("application_id", batch).returns<Onboarding[]>(),
      admin.from("intermediary_onboarding_applications").select("id,requested_type,final_type,partner_status,partner_record_id").in("id", batch).returns<Application[]>(),
    ]);
    if (onboardingResult.error || applicationResult.error) return { partners: [], error: true };
    for (const row of onboardingResult.data ?? []) onboarding.set(row.application_id, row);
    for (const row of applicationResult.data ?? []) applications.set(row.id, row);
  }

  const partnerRecordIds = [...new Set([...applications.values()].map((a) => a.partner_record_id).filter((v): v is string => Boolean(v)))];
  const branches = new Map<string, DirectoryPartner["branches"]>();
  for (let i = 0; i < partnerRecordIds.length; i += 100) {
    const { data, error } = await admin.from("partners").select("id,parent_partner_id,display_name,partner_code").in("parent_partner_id", partnerRecordIds.slice(i, i + 100)).returns<Partner[]>();
    if (error) return { partners: [], error: true };
    for (const branch of data ?? []) {
      if (!branch.parent_partner_id) continue;
      const list = branches.get(branch.parent_partner_id) ?? [];
      if (!list.some((item) => item.id === branch.id)) list.push({ id: branch.id, name: branch.display_name, code: branch.partner_code });
      branches.set(branch.parent_partner_id, list);
    }
  }

  // Load only accounts attached to intermediaries in the viewer-scoped register.
  // Never return authentication IDs, emails, phones or addresses in this directory view.
  type Associate = { id: string; intermediary_id: string; name: string; designation: string | null; role: string | null; status: string };
  const associates = new Map<string, DirectoryPartner["associates"]>();
  const intermediaryIds = [...new Set(intermediaryRows.map((row) => row.id))];
  for (let i = 0; i < intermediaryIds.length; i += 100) {
    const { data, error } = await admin.from("partner_portal_associate_accounts")
      .select("id,intermediary_id,name,designation,role,status")
      .in("intermediary_id", intermediaryIds.slice(i, i + 100))
      .returns<Associate[]>();
    if (error) return { partners: [], error: true };
    for (const account of data ?? []) {
      const list = associates.get(account.intermediary_id) ?? [];
      if (!list.some((item) => item.id === account.id)) list.push({ id: account.id, name: account.name, designation: account.designation, role: account.role, status: account.status });
      associates.set(account.intermediary_id, list);
    }
  }
  const visible = new Set(visibleEmployeeIds);
  const result: DirectoryPartner[] = [];
  const seen = new Set<string>();
  for (const intermediary of intermediaryRows) {
    const applicationId = intermediary.application_id;
    if (!applicationId || seen.has(intermediary.id)) continue;
    const employeeId = onboarding.get(applicationId)?.associate_employee_id;
    if (!employeeId || !visible.has(employeeId)) continue;
    const app = applications.get(applicationId);
    if (!app) continue;
    // The primary partner identity is shown once. Linked POSP/MISP accounts
    // remain separate only when they have their own intermediary record.
    const kind = intermediary.intermediary_type === "partner"
      ? "partner"
      : app.final_type === "misp" || (app.final_type !== "posp" && app.requested_type === "misp")
        ? "misp"
        : "posp";
    result.push({
      id: intermediary.id,
      applicationId,
      employeeId,
      name: intermediary.display_name,
      code: intermediary.intermediary_code,
      kind,
      status: app.partner_status ?? intermediary.account_status,
      branches: app.partner_record_id ? branches.get(app.partner_record_id) ?? [] : [],
      associates: (associates.get(intermediary.id) ?? []).sort((a, b) => a.name.localeCompare(b.name)),
    });
    seen.add(intermediary.id);
  }
  return { partners: result, error: false };
}
