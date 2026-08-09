import { hasEffectiveCapability } from "@/lib/effective-permissions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { appRoles, isAppRole, roleCapabilities, roleLabels, type AppRole } from "@/lib/roles";
import { permissionDefinitions, permissionModules } from "@/lib/permission-management";

type ProfileRow = { id: string; role: string; is_active: boolean; employee_id: string | null };
type EmployeeRow = { id: string; employee_code: string; full_name: string; designation: string; department: string | null; location: string | null; employment_status: string };
type OverrideRow = { profile_id: string; capability: string };
type AuditRow = { id: string; target_profile_id: string | null; capability: string; new_access: string; reason: string; created_at: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccessControlPage({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; success?: string; error?: string }> }) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) redirect("/access-denied");
  const params = await searchParams;
  const q = params.q?.trim().toLowerCase() ?? "";
  const roleFilter = isAppRole(params.role) ? params.role : "";
  const admin = createSupabaseAdminClient();
  const [{ data: profiles }, { data: employees }, { data: overrides }, { data: audit }] = await Promise.all([
    admin.from("profiles").select("id,role,is_active,employee_id").eq("is_active", true).not("employee_id", "is", null).returns<ProfileRow[]>(),
    admin.from("employees").select("id,employee_code,full_name,designation,department,location,employment_status").order("full_name").returns<EmployeeRow[]>(),
    admin.from("employee_permission_overrides").select("profile_id,capability").returns<OverrideRow[]>(),
    admin.from("permission_change_logs").select("id,target_profile_id,capability,new_access,reason,created_at").order("created_at", { ascending: false }).limit(8).returns<AuditRow[]>(),
  ]);

  const employeeMap = new Map((employees ?? []).map((employee) => [employee.id, employee]));
  const overrideCount = new Map<string, number>();
  for (const row of overrides ?? []) overrideCount.set(row.profile_id, (overrideCount.get(row.profile_id) ?? 0) + 1);
  const users = (profiles ?? []).map((profile) => ({ profile, employee: profile.employee_id ? employeeMap.get(profile.employee_id) : undefined })).filter(({ profile, employee }) => {
    if (!employee) return false;
    if (roleFilter && profile.role !== roleFilter) return false;
    if (!q) return true;
    return [employee.full_name, employee.employee_code, employee.designation, employee.department, employee.location, profile.role].some((value) => value?.toLowerCase().includes(q));
  });
  const highPrivilege = (profiles ?? []).filter((profile) => ["it_super_user", "super_admin", "admin"].includes(profile.role)).length;
  const customUsers = new Set((overrides ?? []).map((row) => row.profile_id)).size;

  return <AppShell title="Access Control">
    <div className="mx-auto max-w-[1480px] space-y-4 pb-8">
      <PageHeader title="Employee Access & Permissions" description="Review portal roles, organisation access and employee-specific exceptions. Permission changes are recorded for audit." />
      {params.success ? <Notice tone="success" text={params.success} /> : null}
      {params.error ? <Notice tone="error" text={params.error} /> : null}

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Metric label="Active portal employees" value={(profiles ?? []).length} />
        <Metric label="Roles in use" value={new Set((profiles ?? []).map((row) => row.role)).size} />
        <Metric label="Custom access profiles" value={customUsers} />
        <Metric label="Administrative users" value={highPrivilege} />
        <Metric label="Available permissions" value={permissionDefinitions.length} />
      </section>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div><h2 className="text-[15px] font-semibold text-[#17203A]">Employees & effective access</h2><p className="mt-1 text-[10.5px] text-[#64748B]">Each employee starts with their assigned role. Approved exceptions are shown separately and can be reset when no longer required.</p></div>
          <form className="flex flex-wrap gap-2">
            <input name="q" defaultValue={params.q ?? ""} placeholder="Search employee, role or location" className="h-10 w-64 rounded-xl border border-[#D8E1EC] bg-white px-3 text-[10.5px]" />
            <select name="role" defaultValue={roleFilter} className="h-10 rounded-xl border border-[#D8E1EC] bg-white px-3 text-[10.5px]"><option value="">All roles</option>{appRoles.filter((role) => !["customer", "intermediary"].includes(role)).map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}</select>
            <button className="h-10 rounded-xl bg-[#1E2A5A] px-4 text-[10.5px] font-semibold text-white">Apply</button>
          </form>
        </div>
        <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[980px] text-left text-[10.5px]"><thead><tr className="border-y border-[#E2E8F0] bg-[#F8FAFC] text-[8.5px] uppercase tracking-[.05em] text-[#64748B]"><th className="px-3 py-3">Employee</th><th className="px-3 py-3">Designation</th><th className="px-3 py-3">Assigned role</th><th className="px-3 py-3">Role permissions</th><th className="px-3 py-3">Custom access</th><th className="px-3 py-3">Data scope</th><th className="px-3 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#EDF2F7]">{users.map(({ profile, employee }) => { const role = isAppRole(profile.role) ? profile.role : "customer"; return <tr key={profile.id} className="hover:bg-[#FAFCFF]"><td className="px-3 py-3"><p className="font-semibold text-[#0F2A55]">{employee!.full_name}</p><p className="mt-0.5 text-[9px] text-[#64748B]">{employee!.employee_code} · {employee!.location ?? "No location"}</p></td><td className="px-3 py-3"><p>{employee!.designation}</p><p className="mt-0.5 text-[9px] text-[#64748B]">{employee!.department ?? "-"}</p></td><td className="px-3 py-3"><Badge>{roleLabels[role]}</Badge></td><td className="px-3 py-3">{roleCapabilities[role].length} permissions</td><td className="px-3 py-3"><span className={overrideCount.get(profile.id) ? "font-semibold text-[#4F46E5]" : "text-[#94A3B8]"}>{overrideCount.get(profile.id) ?? 0} custom</span></td><td className="px-3 py-3">{defaultScope(role)}</td><td className="px-3 py-3 text-right"><Link href={`/system/access-control/employees/${profile.id}`} className="inline-flex h-9 items-center rounded-xl bg-[#172554] px-4 text-[10px] font-semibold text-white">Manage</Link></td></tr>; })}</tbody></table></div>
      </Card>

      <Card>
        <div className="flex items-center justify-between"><div><h2 className="text-[15px] font-semibold text-[#17203A]">Role permission overview</h2><p className="mt-1 text-[10.5px] text-[#64748B]">Standard role permissions grouped by business area.</p></div><span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[9px] font-semibold text-[#4338CA]">Standard role access</span></div>
        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">{permissionModules().map((module) => <div key={module} className="rounded-2xl border border-[#E2E8F0] bg-[#FAFCFF] p-4"><h3 className="text-[11px] font-semibold text-[#17203A]">{module}</h3><div className="mt-3 space-y-2">{permissionDefinitions.filter((item) => item.module === module).map((item) => <div key={item.capability} className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-medium text-[#24345A]">{item.label}</p><p className="mt-0.5 text-[8.5px] text-[#94A3B8]">{item.description}</p></div><Risk value={item.risk} /></div>)}</div></div>)}</div>
      </Card>

      <Card><h2 className="text-[15px] font-semibold text-[#17203A]">Recent access changes</h2><div className="mt-3 space-y-2">{audit?.length ? audit.map((row) => <div key={row.id} className="flex flex-col gap-1 rounded-xl border border-[#E2E8F0] px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-semibold text-[#24345A]">{friendlyCapability(row.capability)} → {row.new_access}</p><p className="text-[8.5px] text-[#64748B]">{row.reason}</p></div><span className="text-[8.5px] text-[#94A3B8]">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(row.created_at))}</span></div>) : <p className="text-[10px] text-[#94A3B8]">No access changes have been recorded yet.</p>}</div></Card>
    </div>
  </AppShell>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-white/75 bg-white/80 p-4 shadow-sm"><p className="text-2xl font-semibold text-[#172554]">{value}</p><p className="mt-1 text-[9px] font-semibold uppercase tracking-[.05em] text-[#64748B]">{label}</p></div>; }
function Badge({ children }: { children: React.ReactNode }) { return <span className="inline-flex rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[9px] font-semibold text-[#4338CA]">{children}</span>; }
function Risk({ value }: { value: string }) { const style = value === "critical" ? "bg-red-50 text-red-700" : value === "high" ? "bg-amber-50 text-amber-700" : value === "sensitive" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"; return <span className={`shrink-0 rounded-full px-2 py-1 text-[7.5px] font-bold uppercase ${style}`}>{value}</span>; }
function Notice({ tone, text }: { tone: "success" | "error"; text: string }) { return <div className={`rounded-xl border px-4 py-3 text-[10.5px] ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{text}</div>; }
function friendlyCapability(value: string) { return permissionDefinitions.find((item) => item.capability === value)?.label ?? value.replaceAll("_", " "); }
function defaultScope(role: AppRole) { if (["super_admin", "admin", "it_super_user", "manager", "director", "sales_operations_head", "backoffice_executive"].includes(role)) return "Entire organisation"; if (["sales_head", "zonal_head", "asm", "sales_manager"].includes(role)) return "Reporting hierarchy"; return "Own records"; }
