import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAppRole, roleLabels } from "@/lib/roles";
import { permissionDefinitions, rolePermissionAccess } from "@/lib/permission-management";
import { resetEmployeePermissionOverrides, saveEmployeePermissionOverride } from "../../actions";

type ProfileRow = { id: string; role: string; is_active: boolean; employee_id: string | null };
type EmployeeRow = { id: string; employee_code: string; full_name: string; designation: string; department: string | null; location: string | null; email: string | null };
type OverrideRow = { capability: string; access_level: string; scope_type: string; reason: string; expires_at: string | null; updated_at: string };
type AuditRow = { id: string; capability: string; previous_access: string | null; new_access: string; previous_scope: string | null; new_scope: string | null; reason: string; created_at: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EmployeePermissionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ module?: string; success?: string; error?: string }> }) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || !["it_super_user", "super_admin"].includes(viewer.role ?? "")) redirect("/access-denied");
  const { id } = await params;
  const query = await searchParams;
  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: overrides }, { data: audit }] = await Promise.all([
    admin.from("profiles").select("id,role,is_active,employee_id").eq("id", id).maybeSingle<ProfileRow>(),
    admin.from("employee_permission_overrides").select("capability,access_level,scope_type,reason,expires_at,updated_at").eq("profile_id", id).returns<OverrideRow[]>(),
    admin.from("permission_change_logs").select("id,capability,previous_access,new_access,previous_scope,new_scope,reason,created_at").eq("target_profile_id", id).order("created_at", { ascending: false }).limit(20).returns<AuditRow[]>(),
  ]);
  if (!profile?.employee_id || !isAppRole(profile.role)) notFound();
  const { data: employee } = await admin.from("employees").select("id,employee_code,full_name,designation,department,location,email").eq("id", profile.employee_id).maybeSingle<EmployeeRow>();
  if (!employee) notFound();
  const overrideMap = new Map((overrides ?? []).map((row) => [row.capability, row]));
  const modules = Array.from(new Set(permissionDefinitions.map((item) => item.module)));
  const activeModule = query.module && modules.includes(query.module) ? query.module : modules[0];

  return <AppShell title="Employee Permissions" backHref="/system/access-control">
    <div className="mx-auto max-w-[1380px] space-y-4 pb-8">
      <PageHeader title={employee.full_name} description={`${employee.employee_code} · ${employee.designation} · ${roleLabels[profile.role]}`} action={<Link href="/system/access-control" className="inline-flex h-10 items-center rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] font-semibold text-[#172554]">Back to employees</Link>} />
      {query.success ? <Notice tone="success" text={query.success} /> : null}
      {query.error ? <Notice tone="error" text={query.error} /> : null}

      <section className="grid gap-3 md:grid-cols-4"><Summary label="Assigned role" value={roleLabels[profile.role]} /><Summary label="Custom overrides" value={String(overrides?.length ?? 0)} /><Summary label="Default scope" value={defaultScope(profile.role)} /><Summary label="Portal status" value={profile.is_active ? "Active" : "Inactive"} /></section>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-[15px] font-semibold text-[#17203A]">Permissions</h2><p className="mt-1 text-[10.5px] text-[#64748B]">Each setting inherits from the assigned role unless a custom access level or scope is saved.</p></div><div className="flex flex-wrap gap-2">{modules.map((module) => <Link key={module} href={`?module=${encodeURIComponent(module)}`} className={`rounded-full px-3 py-1.5 text-[9px] font-semibold ${activeModule === module ? "bg-[#172554] text-white" : "bg-[#F1F5F9] text-[#475569]"}`}>{module}</Link>)}</div></div>
        <div className="mt-4 space-y-3">{permissionDefinitions.filter((item) => item.module === activeModule).map((item) => { const current = overrideMap.get(item.capability); const inherited = rolePermissionAccess(profile.role, item.capability); const returnTo = `/system/access-control/employees/${profile.id}?module=${encodeURIComponent(activeModule)}`; return <form key={item.capability} action={saveEmployeePermissionOverride} className="grid gap-3 rounded-2xl border border-[#E2E8F0] bg-[#FAFCFF] p-4 xl:grid-cols-[minmax(280px,1fr)_160px_170px_minmax(220px,1fr)_120px] xl:items-end">
          <input type="hidden" name="profile_id" value={profile.id} /><input type="hidden" name="capability" value={item.capability} /><input type="hidden" name="return_to" value={returnTo} />
          <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[11px] font-semibold text-[#17203A]">{item.label}</h3><Risk value={item.risk} /></div><p className="mt-1 text-[9px] leading-4 text-[#64748B]">{item.description}</p><p className="mt-1 text-[8.5px] font-medium text-[#4F46E5]">Role default: {inherited}</p></div>
          <label className="text-[8.5px] font-semibold uppercase tracking-[.05em] text-[#64748B]">Access<select name="access_level" defaultValue={current?.access_level ?? "inherit"} className="mt-1 h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10px]"><option value="inherit">Inherit role</option><option value="none">No access</option><option value="view">View only</option><option value="edit">View & edit</option><option value="approve">Approve / critical</option></select></label>
          <label className="text-[8.5px] font-semibold uppercase tracking-[.05em] text-[#64748B]">Data scope<select name="scope_type" defaultValue={current?.scope_type ?? "inherit"} className="mt-1 h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10px]"><option value="inherit">Inherit role</option><option value="self">Own records</option><option value="hierarchy">Reporting hierarchy</option><option value="organization">Entire organisation</option></select></label>
          <label className="text-[8.5px] font-semibold uppercase tracking-[.05em] text-[#64748B]">Reason<input name="reason" defaultValue={current?.reason ?? ""} placeholder="Why is this access needed?" className="mt-1 h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10px]" /></label>
          <FormSubmitButton label="Save" pendingLabel="Saving…" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#172554] px-4 text-[10px] font-semibold text-white" />
        </form>; })}</div>
      </Card>

      <Card><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-[15px] font-semibold text-[#17203A]">Reset custom access</h2><p className="mt-1 text-[10px] text-[#64748B]">Remove every employee-specific override and return fully to the assigned role defaults.</p></div><form action={resetEmployeePermissionOverrides} className="flex flex-wrap gap-2"><input type="hidden" name="profile_id" value={profile.id} /><input name="reason" placeholder="Reason for reset" className="h-10 rounded-xl border border-[#CBD5E1] px-3 text-[10px]" /><FormSubmitButton label="Reset overrides" pendingLabel="Resetting…" className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-[10px] font-semibold text-red-700" /></form></div></Card>

      <Card><h2 className="text-[15px] font-semibold text-[#17203A]">Change history</h2><div className="mt-3 space-y-2">{audit?.length ? audit.map((row) => <div key={row.id} className="rounded-xl border border-[#E2E8F0] px-3 py-2.5"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><p className="text-[10px] font-semibold text-[#24345A]">{friendlyCapability(row.capability)}: {row.previous_access ?? "inherit"} → {row.new_access}</p><span className="text-[8.5px] text-[#94A3B8]">{new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(row.created_at))}</span></div><p className="mt-1 text-[8.5px] text-[#64748B]">{row.reason}</p></div>) : <p className="text-[10px] text-[#94A3B8]">No permission changes recorded.</p>}</div></Card>
    </div>
  </AppShell>;
}

function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/75 bg-white/80 p-4 shadow-sm"><p className="text-[9px] font-semibold uppercase tracking-[.05em] text-[#64748B]">{label}</p><p className="mt-1 text-[12px] font-semibold text-[#172554]">{value}</p></div>; }
function Risk({ value }: { value: string }) { const style = value === "critical" ? "bg-red-50 text-red-700" : value === "high" ? "bg-amber-50 text-amber-700" : value === "sensitive" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"; return <span className={`rounded-full px-2 py-1 text-[7px] font-bold uppercase ${style}`}>{value}</span>; }
function Notice({ tone, text }: { tone: "success" | "error"; text: string }) { return <div className={`rounded-xl border px-4 py-3 text-[10.5px] ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{text}</div>; }
function friendlyCapability(value: string) { return permissionDefinitions.find((item) => item.capability === value)?.label ?? value.replaceAll("_", " "); }
function defaultScope(role: string) { return ["super_admin", "admin", "it_super_user", "manager", "director", "sales_operations_head", "backoffice_executive"].includes(role) ? "Entire organisation" : ["sales_head", "zonal_head", "asm", "sales_manager"].includes(role) ? "Reporting hierarchy" : "Own records"; }
