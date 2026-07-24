import { redirect } from "next/navigation";
import { FormSubmitButton } from "@/components/form-submit-button";
import { AppShell } from "@/components/shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { appRoles, canManageUsers, roleLabels } from "@/lib/roles";
import { setEmployeeStatus } from "./actions";
import { EmployeeCreateForm, EmployeeEditForm, type EmployeeRow } from "./employee-forms";

export default async function EmployeesPage({ searchParams }: { searchParams?: Promise<{ q?: string; status?: string }> }) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!canManageUsers(profile?.role)) redirect("/access-denied");

  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const status = params.status ?? "";
  const supabase = await createServerSupabaseClient();
  let query = supabase
    .from("employees")
    .select("id, employee_code, full_name, phone, email, department, designation, vertical, location, reporting_manager_id, reporting_manager_employee_code, employment_status, portal_profile:profiles!profiles_employee_id_fkey(id)")
    .order("full_name");

  if (q) query = query.or(`employee_code.ilike.%${q}%,full_name.ilike.%${q}%,phone.ilike.%${q}%,email.ilike.%${q}%,department.ilike.%${q}%,designation.ilike.%${q}%`);
  if (status === "active" || status === "inactive") query = query.eq("employment_status", status);

  const [{ data, error }, managerResult] = await Promise.all([
    query,
    supabase.from("employees").select("id, employee_code, full_name").eq("employment_status", "active").order("full_name"),
  ]);

  const employees = (data ?? []).map((row) => {
    const portalProfile = Array.isArray(row.portal_profile) ? row.portal_profile[0] : row.portal_profile;
    return { ...row, profile_id: portalProfile?.id ?? null } as EmployeeRow;
  });
  const managers = managerResult.data ?? [];
  const portalRoles = appRoles.filter((role) => role !== "customer").map((role) => ({ value: role, label: roleLabels[role] }));
  const activeCount = employees.filter((employee) => employee.employment_status === "active").length;
  const portalCount = employees.filter((employee) => employee.profile_id).length;

  return (
    <AppShell title="Employees">
      <div className="grid gap-3">
        <section className="rounded-lg border border-[#D7E6F5] bg-white p-4 shadow-[0_3px_12px_rgba(7,29,73,0.05)]">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E7EEF6] pb-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#0B63CE]">People operations</p>
              <h1 className="mt-1 text-[20px] font-bold text-[#071D49]">Employee onboarding</h1>
              <p className="mt-1 text-[11px] text-[#667085]">Create the authoritative employee record and optionally issue portal access.</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <Summary value={employees.length} label="Listed" />
              <Summary value={activeCount} label="Active" />
              <Summary value={portalCount} label="Portal" />
            </div>
          </div>
          <div className="pt-4"><EmployeeCreateForm managers={managers} portalRoles={portalRoles} /></div>
        </section>

      </div>

      <section className="mt-3 rounded-lg border border-[#D7E6F5] bg-white p-4 shadow-[0_3px_12px_rgba(7,29,73,0.05)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#071D49]">Employee directory</h2>
            <p className="mt-0.5 text-[10px] text-[#667085]">Search, review, and maintain employee records.</p>
          </div>
          <form className="flex flex-wrap gap-2">
            <input name="q" defaultValue={q} placeholder="Search employees" className="h-9 w-56 rounded-md border border-[#CBD8E8] bg-[#F8FBFF] px-3 text-[11px] outline-none focus:border-[#0B63CE]" />
            <select name="status" defaultValue={status} className="h-9 rounded-md border border-[#CBD8E8] bg-white px-3 text-[11px]">
              <option value="">All status</option><option value="active">Active</option><option value="inactive">Inactive</option>
            </select>
            <button className="h-9 rounded-md bg-[#0B63CE] px-4 text-[11px] font-semibold text-white">Apply</button>
          </form>
        </div>

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-[11px] text-red-700">{error.message}</p>
        ) : employees.length ? (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[900px] border-collapse text-left">
              <thead><tr className="border-y border-[#E7EEF6] bg-[#F8FBFF] text-[9px] font-bold uppercase tracking-[0.06em] text-[#667085]">
                <th className="px-3 py-2">Employee</th><th className="px-3 py-2">Function</th><th className="px-3 py-2">Location</th><th className="px-3 py-2">Manager</th><th className="px-3 py-2">Access</th><th className="px-3 py-2 text-right">Status</th>
              </tr></thead>
              <tbody className="divide-y divide-[#EDF2F7]">
                {employees.map((employee) => {
                  const manager = managers.find((item) => item.id === employee.reporting_manager_id);
                  const nextStatus = employee.employment_status === "active" ? "inactive" : "active";
                  const statusAction = setEmployeeStatus.bind(null, employee.id, nextStatus);
                  return (
                    <tr key={employee.id} className="align-top text-[11px] text-[#344054]">
                      <td className="px-3 py-3"><p className="font-semibold text-[#071D49]">{employee.full_name}</p><p className="mt-0.5 text-[10px] text-[#667085]">{employee.employee_code} · {employee.email ?? employee.phone ?? "No contact"}</p></td>
                      <td className="px-3 py-3"><p>{employee.designation}</p><p className="mt-0.5 text-[10px] text-[#667085]">{employee.department}{employee.vertical ? ` · ${employee.vertical}` : ""}</p></td>
                      <td className="px-3 py-3">{employee.location ?? "-"}</td>
                      <td className="px-3 py-3">{manager?.full_name ?? employee.reporting_manager_employee_code ?? "-"}</td>
                      <td className="px-3 py-3"><span className={`rounded-full px-2 py-1 text-[9px] font-semibold ${employee.profile_id ? "bg-[#EAF8F2] text-[#087A55]" : "bg-[#F1F4F8] text-[#667085]"}`}>{employee.profile_id ? "Portal enabled" : "Directory only"}</span></td>
                      <td className="px-3 py-3 text-right">
                        <details className="relative inline-block text-left">
                          <summary className="cursor-pointer list-none rounded-md border border-[#CBD8E8] px-3 py-1.5 text-[10px] font-semibold text-[#071D49]">Manage</summary>
                          <div className="absolute right-0 z-20 mt-2 w-[680px] max-w-[calc(100vw-300px)] rounded-lg border border-[#CBD8E8] bg-white p-4 text-left shadow-[0_18px_45px_rgba(7,29,73,0.16)]">
                            <EmployeeEditForm employee={employee} managers={managers} />
                            <form action={statusAction} className="mt-3 border-t border-[#E7EEF6] pt-3">
                              <FormSubmitButton label={nextStatus === "inactive" ? "Deactivate employee" : "Reactivate employee"} pendingLabel={nextStatus === "inactive" ? "Deactivating" : "Reactivating"} className="inline-flex h-9 items-center justify-center rounded-md border border-[#CBD8E8] px-4 text-[10px] font-semibold text-[#344054] disabled:opacity-70" />
                            </form>
                          </div>
                        </details>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="mt-4 rounded-md border border-dashed border-[#CBD8E8] bg-[#F8FBFF] p-8 text-center text-[11px] text-[#667085]">No employees match these filters.</div>
        )}
      </section>
    </AppShell>
  );
}

function Summary({ value, label }: { value: number; label: string }) {
  return <div className="min-w-14 rounded-md border border-[#D7E6F5] bg-[#F8FBFF] px-2.5 py-2"><p className="text-[15px] font-bold text-[#071D49]">{value}</p><p className="text-[8px] font-semibold uppercase tracking-[0.05em] text-[#667085]">{label}</p></div>;
}
