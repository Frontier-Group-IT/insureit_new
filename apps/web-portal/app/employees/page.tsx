import { hasEffectiveCapability } from "@/lib/effective-permissions";
import Link from "next/link";
import { Plus } from "lucide-react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getEmployeeAccessScope } from "@/lib/employee-access-scope";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { appRoles, roleLabels } from "@/lib/roles";
import { type EmployeeRow } from "./employee-forms";
import { EmployeeDirectoryWorkspace } from "./employee-directory-workspace";

const NO_EMPLOYEE_ID = "00000000-0000-0000-0000-000000000000";

export default async function EmployeesPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string }> }) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !(await hasEffectiveCapability(profile, "view_employees", "view"))) redirect("/access-denied");

  const [canManage, canManagePortalAccess] = await Promise.all([
    hasEffectiveCapability(profile, "manage_employees", "edit"),
    hasEffectiveCapability(profile, "manage_users", "critical"),
  ]);
  const scope = await getEmployeeAccessScope(profile.id, profile.role);
  const params = (await searchParams) ?? {};
  const initialStatus = params.status === "active" || params.status === "inactive" ? params.status : "";
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("employees")
    .select("id, employee_code, full_name, phone, email, department, designation, vertical, location, reporting_manager_id, reporting_manager_employee_code, employment_status, portal_profile:profiles!profiles_employee_id_fkey(id, role)")
    .order("full_name");
  let managerQuery = supabase.from("employees").select("id, employee_code, full_name").eq("employment_status", "active").order("full_name");

  if (scope.mode !== "organization") {
    const employeeIds = scope.employeeIds.length ? scope.employeeIds : [NO_EMPLOYEE_ID];
    query = query.in("id", employeeIds);
    managerQuery = managerQuery.in("id", employeeIds);
  }

  const [{ data, error }, managerResult] = await Promise.all([query, managerQuery]);
  const profileRows = (data ?? []).map((row) => {
    const portalProfile = Array.isArray(row.portal_profile) ? row.portal_profile[0] : row.portal_profile;
    return { row, portalProfile };
  });

  const authStatusById = new Map<string, "invited" | "active">();
  const profileIds = profileRows.map(({ portalProfile }) => portalProfile?.id).filter((id): id is string => Boolean(id));
  if (profileIds.length) {
    const admin = createSupabaseAdminClient();
    const { data: authUsers, error: authUsersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (!authUsersError) {
      for (const user of authUsers.users) {
        if (!profileIds.includes(user.id)) continue;
        authStatusById.set(user.id, user.email_confirmed_at ? "active" : "invited");
      }
    }
  }

  const employees = profileRows.map(({ row, portalProfile }) => ({
    ...row,
    profile_id: portalProfile?.id ?? null,
    portal_role: portalProfile?.role ?? null,
    portal_status: portalProfile?.id ? (authStatusById.get(portalProfile.id) ?? "active") : "none",
  })) as EmployeeRow[];
  const managers = managerResult.data ?? [];
  const portalRoles = appRoles
    .filter((role) => role !== "customer" && role !== "intermediary")
    .map((role) => ({ value: role, label: roleLabels[role] }));
  const scopeLabel = scope.mode === "hierarchy" ? "Showing your reporting hierarchy." : scope.mode === "self" ? "Showing your employee record." : null;

  return (
    <AppShell title="Employee Directory">
      <div className="grid gap-3">
        <section className="rounded-lg border border-[#D7E6F5] bg-white p-4 shadow-[0_3px_12px_rgba(7,29,73,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-[20px] font-bold text-[#071D49]">Employee directory</h1>
              {scopeLabel ? <p className="mt-1 text-[10px] font-medium text-[#667085]">{scopeLabel}</p> : <p className="mt-1 text-[10px] font-medium text-[#667085]">Search, review and manage employee records.</p>}
            </div>
            {canManage ? <Link href="/employees/new" className="inline-flex h-10 items-center gap-2 rounded-md bg-[#071D49] px-4 text-[11px] font-semibold text-white"><Plus className="h-4 w-4" />Add employee</Link> : null}
          </div>
        </section>
        <EmployeeDirectoryWorkspace employees={employees} managers={managers} portalRoles={portalRoles} canManage={canManage} canManagePortalAccess={canManagePortalAccess} initialQuery={params.q?.trim() ?? ""} initialStatus={initialStatus} loadError={error?.message ?? null} />
      </div>
    </AppShell>
  );
}
