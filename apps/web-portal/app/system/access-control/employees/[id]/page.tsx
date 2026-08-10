import { hasEffectiveCapability } from "@/lib/effective-permissions";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { isAppRole, roleLabels, type AppRole } from "@/lib/roles";
import { permissionDefinitions, rolePermissionAccess } from "@/lib/permission-management";
import { roleMatrixV2 } from "@/lib/access-control-role-matrix-v2";
import { resetEmployeePermissionOverrides, saveEmployeePermissionOverride } from "../../actions";

type ProfileRow = { id: string; role: string; is_active: boolean; employee_id: string | null; email: string | null };
type EmployeeRow = { id: string; employee_code: string; full_name: string; designation: string; department: string | null; location: string | null; email: string | null; employment_status: string };
type OverrideRow = { capability: string; access_level: string; scope_type: string; reason: string; expires_at: string | null; updated_at: string };
type AuditRow = { id: string; capability: string; previous_access: string | null; new_access: string; previous_scope: string | null; new_scope: string | null; reason: string; created_at: string };
type LifecycleAuditRow = { id: string; action: string; old_data: Record<string, unknown> | null; new_data: Record<string, unknown> | null; created_at: string };
type AccessView = "overview" | "roles" | "permissions" | "scope" | "portal" | "history";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EmployeePermissionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; module?: string; success?: string; error?: string }> }) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) redirect("/access-denied");

  const { id } = await params;
  const query = await searchParams;
  const view = normalizeView(query.view);
  const admin = createSupabaseAdminClient();
  const [{ data: profile }, { data: overrides }, { data: audit }] = await Promise.all([
    admin.from("profiles").select("id,role,is_active,employee_id,email").eq("id", id).maybeSingle<ProfileRow>(),
    admin.from("employee_permission_overrides").select("capability,access_level,scope_type,reason,expires_at,updated_at").eq("profile_id", id).returns<OverrideRow[]>(),
    admin.from("permission_change_logs").select("id,capability,previous_access,new_access,previous_scope,new_scope,reason,created_at").eq("target_profile_id", id).order("created_at", { ascending: false }).limit(30).returns<AuditRow[]>(),
  ]);
  if (!profile?.employee_id || !isAppRole(profile.role)) notFound();

  const [{ data: employee }, { data: lifecycleAudit }] = await Promise.all([
    admin.from("employees").select("id,employee_code,full_name,designation,department,location,email,employment_status").eq("id", profile.employee_id).maybeSingle<EmployeeRow>(),
    admin.from("audit_logs").select("id,action,old_data,new_data,created_at").eq("table_name", "employees").eq("record_id", profile.employee_id).in("action", ["employee_portal_invited", "employee_portal_reinvited", "employee_portal_suspended", "employee_portal_restored", "employee_deactivated", "employee_reactivated"]).order("created_at", { ascending: false }).limit(30).returns<LifecycleAuditRow[]>(),
  ]);
  if (!employee) notFound();

  const role = profile.role as AppRole;
  const overrideMap = new Map((overrides ?? []).map((row) => [row.capability, row]));
  const modules = Array.from(new Set(permissionDefinitions.map((item) => item.module)));
  const activeModule = query.module && modules.includes(query.module) ? query.module : modules[0];
  const activeOverrides = (overrides ?? []).filter(isCurrentOverride);
  const expiringOverrides = activeOverrides.filter((row) => row.expires_at && new Date(row.expires_at) > new Date()).length;
  const roleV2 = roleMatrixV2.find((item) => item.code === role);
  const history = buildHistory(audit ?? [], lifecycleAudit ?? []);

  return <AppShell title="Employee Access" backHref="/system/access-control">
    <div className="mx-auto max-w-[1420px] space-y-4 pb-8">
      <PageHeader title={employee.full_name} description={`${employee.employee_code} · ${employee.designation} · ${roleLabels[role]}`} action={<Link href="/system/access-control?view=users" className="inline-flex h-10 items-center rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] font-semibold text-[#172554]">Back to Access Control</Link>} />
      {query.success ? <Notice tone="success" text={query.success} /> : null}
      {query.error ? <Notice tone="error" text={query.error} /> : null}

      <section className="grid gap-3 md:grid-cols-5">
        <Summary label="Assigned role" value={roleLabels[role]} />
        <Summary label="Portal status" value={profile.is_active ? "Active" : "Inactive"} />
        <Summary label="Employment" value={titleCase(employee.employment_status)} />
        <Summary label="Custom access" value={String(activeOverrides.length)} />
        <Summary label="Default scope" value={scopeLabel(defaultScope(role))} />
      </section>

      <nav className="flex flex-wrap gap-2 rounded-2xl border border-[#DCE4EF] bg-white p-2 shadow-sm">
        <Tab current={view} value="overview" label="Overview" />
        <Tab current={view} value="roles" label="Roles" />
        <Tab current={view} value="permissions" label="Permissions" count={activeOverrides.length} />
        <Tab current={view} value="scope" label="Data Scope" />
        <Tab current={view} value="portal" label="Portal Access" />
        <Tab current={view} value="history" label="History" count={history.length} />
      </nav>

      {view === "overview" ? <Overview employee={employee} profile={profile} role={role} overrides={activeOverrides} expiringOverrides={expiringOverrides} /> : null}
      {view === "roles" ? <Roles role={role} roleV2={roleV2} /> : null}
      {view === "permissions" ? <Permissions profile={profile} role={role} overrides={overrideMap} modules={modules} activeModule={activeModule} /> : null}
      {view === "scope" ? <DataScope role={role} overrides={activeOverrides} /> : null}
      {view === "portal" ? <PortalAccess employee={employee} profile={profile} role={role} /> : null}
      {view === "history" ? <History events={history} /> : null}
    </div>
  </AppShell>;
}

function Overview({ employee, profile, role, overrides, expiringOverrides }: { employee: EmployeeRow; profile: ProfileRow; role: AppRole; overrides: OverrideRow[]; expiringOverrides: number }) {
  const posture = !profile.is_active || employee.employment_status !== "active" ? "Needs review" : overrides.length ? "Custom access" : "Standard access";
  return <div className="grid gap-4 xl:grid-cols-[1.1fr_.9fr]">
    <Card>
      <h2 className="text-[15px] font-semibold text-[#17203A]">Access overview</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <Detail label="Employee" value={employee.full_name} />
        <Detail label="Work email" value={employee.email ?? profile.email ?? "Not recorded"} />
        <Detail label="Department" value={employee.department ?? "Not recorded"} />
        <Detail label="Location" value={employee.location ?? "Not recorded"} />
        <Detail label="Role" value={roleLabels[role]} />
        <Detail label="Default data scope" value={scopeLabel(defaultScope(role))} />
      </div>
    </Card>
    <Card>
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-[15px] font-semibold text-[#17203A]">Access posture</h2><p className="mt-1 text-[10px] text-[#64748B]">Current access state and exceptions.</p></div><StatusBadge value={posture} /></div>
      <div className="mt-4 space-y-3">
        <Posture label="Portal account" value={profile.is_active ? "Active" : "Inactive"} tone={profile.is_active ? "ok" : "warn"} />
        <Posture label="Employee record" value={titleCase(employee.employment_status)} tone={employee.employment_status === "active" ? "ok" : "warn"} />
        <Posture label="Custom permissions" value={`${overrides.length} active`} tone={overrides.length ? "info" : "ok"} />
        <Posture label="Temporary access" value={`${expiringOverrides} with expiry`} tone={expiringOverrides ? "warn" : "ok"} />
      </div>
    </Card>
  </div>;
}

function Roles({ role, roleV2 }: { role: AppRole; roleV2: (typeof roleMatrixV2)[number] | undefined }) {
  return <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
    <Card>
      <h2 className="text-[15px] font-semibold text-[#17203A]">Current live role</h2>
      <div className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#FAFCFF] p-4">
        <div className="flex items-center justify-between gap-3"><div><p className="text-[13px] font-semibold text-[#172554]">{roleLabels[role]}</p><p className="mt-1 text-[9px] text-[#64748B]">Legacy production role currently used for authorization.</p></div><Badge>Live</Badge></div>
        <div className="mt-4 grid grid-cols-2 gap-3"><MiniStat label="Default scope" value={scopeLabel(defaultScope(role))} /><MiniStat label="Model" value="Current RBAC" /></div>
      </div>
      <p className="mt-3 text-[9px] leading-4 text-[#64748B]">Role assignment remains governed through User Management until the V2 database migration is activated.</p>
      <Link href="/users" className="mt-4 inline-flex h-9 items-center rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] font-semibold text-[#334155]">Open User Management</Link>
    </Card>
    <Card>
      <div className="flex items-start justify-between gap-3"><div><h2 className="text-[15px] font-semibold text-[#17203A]">V2 role definition</h2><p className="mt-1 text-[10px] text-[#64748B]">Read-only migration preview.</p></div><span className="rounded-full bg-[#EEF2FF] px-3 py-1 text-[8px] font-semibold text-[#4338CA]">Shadow model</span></div>
      {roleV2 ? <div className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#FAFCFF] p-4"><p className="text-[13px] font-semibold text-[#172554]">{roleV2.label}</p><p className="mt-2 text-[9px] leading-4 text-[#64748B]">{roleV2.purpose}</p><div className="mt-4 grid grid-cols-3 gap-2"><MiniStat label="Permissions" value={String(roleV2.grants.length)} /><MiniStat label="Scope" value={scopeLabel(roleV2.defaultScope)} /><MiniStat label="Status" value={titleCase(roleV2.status)} /></div></div> : <p className="mt-4 text-[10px] text-[#94A3B8]">No V2 role definition found.</p>}
    </Card>
  </div>;
}

function Permissions({ profile, role, overrides, modules, activeModule }: { profile: ProfileRow; role: AppRole; overrides: Map<string, OverrideRow>; modules: string[]; activeModule: string }) {
  return <>
    <Card>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between"><div><h2 className="text-[15px] font-semibold text-[#17203A]">Permissions</h2><p className="mt-1 text-[10.5px] text-[#64748B]">Live employee overrides. Settings inherit from the assigned role unless a custom access level or scope is saved.</p></div><div className="flex flex-wrap gap-2">{modules.map((module) => <Link key={module} href={`?view=permissions&module=${encodeURIComponent(module)}`} className={`rounded-full px-3 py-1.5 text-[9px] font-semibold ${activeModule === module ? "bg-[#172554] text-white" : "bg-[#F1F5F9] text-[#475569]"}`}>{module}</Link>)}</div></div>
      <div className="mt-4 space-y-3">{permissionDefinitions.filter((item) => item.module === activeModule).map((item) => { const current = overrides.get(item.capability); const inherited = rolePermissionAccess(role, item.capability); const returnTo = `/system/access-control/employees/${profile.id}?view=permissions&module=${encodeURIComponent(activeModule)}`; return <form key={item.capability} action={saveEmployeePermissionOverride} className="grid gap-3 rounded-2xl border border-[#E2E8F0] bg-[#FAFCFF] p-4 xl:grid-cols-[minmax(280px,1fr)_150px_170px_minmax(210px,1fr)_150px_110px] xl:items-end">
        <input type="hidden" name="profile_id" value={profile.id} /><input type="hidden" name="capability" value={item.capability} /><input type="hidden" name="return_to" value={returnTo} />
        <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-[11px] font-semibold text-[#17203A]">{item.label}</h3><Risk value={item.risk} /></div><p className="mt-1 text-[9px] leading-4 text-[#64748B]">{item.description}</p><p className="mt-1 text-[8.5px] font-medium text-[#4F46E5]">Role default: {inherited}</p></div>
        <Field label="Access"><select name="access_level" defaultValue={current?.access_level ?? "inherit"} className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10px]"><option value="inherit">Inherit role</option><option value="none">No access</option><option value="view">View only</option><option value="edit">View & edit</option><option value="approve">Approve / critical</option></select></Field>
        <Field label="Data scope"><select name="scope_type" defaultValue={current?.scope_type ?? "inherit"} className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10px]"><option value="inherit">Inherit role</option><option value="self">Own records</option><option value="hierarchy">Reporting hierarchy</option><option value="organization">Entire organisation</option></select></Field>
        <Field label="Reason"><input name="reason" defaultValue={current?.reason ?? ""} placeholder="Why is this access needed?" className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10px]" /></Field>
        <Field label="Expires"><input name="expires_at" type="datetime-local" defaultValue={toLocalInput(current?.expires_at)} className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10px]" /></Field>
        <FormSubmitButton label="Save" pendingLabel="Saving…" className="inline-flex h-10 items-center justify-center rounded-xl bg-[#172554] px-4 text-[10px] font-semibold text-white" />
      </form>; })}</div>
    </Card>
    <Card><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-[15px] font-semibold text-[#17203A]">Reset custom access</h2><p className="mt-1 text-[10px] text-[#64748B]">Remove every employee-specific override and return fully to role defaults.</p></div><form action={resetEmployeePermissionOverrides} className="flex flex-wrap gap-2"><input type="hidden" name="profile_id" value={profile.id} /><input name="reason" placeholder="Reason for reset" className="h-10 rounded-xl border border-[#CBD5E1] px-3 text-[10px]" /><FormSubmitButton label="Reset overrides" pendingLabel="Resetting…" className="inline-flex h-10 items-center justify-center rounded-xl border border-red-200 bg-red-50 px-4 text-[10px] font-semibold text-red-700" /></form></div></Card>
  </>;
}

function DataScope({ role, overrides }: { role: AppRole; overrides: OverrideRow[] }) {
  const scoped = overrides.filter((row) => row.scope_type !== "inherit");
  return <div className="grid gap-4 xl:grid-cols-[.8fr_1.2fr]">
    <Card><h2 className="text-[15px] font-semibold text-[#17203A]">Default scope</h2><p className="mt-1 text-[10px] text-[#64748B]">Inherited from the assigned role.</p><div className="mt-4 rounded-2xl border border-[#E2E8F0] bg-[#FAFCFF] p-5"><p className="text-[18px] font-semibold text-[#172554]">{scopeLabel(defaultScope(role))}</p><p className="mt-2 text-[9px] leading-4 text-[#64748B]">Individual permission overrides can narrow or broaden scope where explicitly configured.</p></div></Card>
    <Card><div className="flex items-center justify-between gap-3"><div><h2 className="text-[15px] font-semibold text-[#17203A]">Scope exceptions</h2><p className="mt-1 text-[10px] text-[#64748B]">Permission-specific data boundaries currently overriding the role.</p></div><Badge>{scoped.length} exceptions</Badge></div><div className="mt-4 space-y-2">{scoped.length ? scoped.map((row) => <div key={row.capability} className="flex flex-col gap-2 rounded-xl border border-[#E2E8F0] px-3 py-3 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-semibold text-[#24345A]">{friendlyCapability(row.capability)}</p><p className="mt-0.5 text-[8.5px] text-[#64748B]">{row.reason}</p></div><span className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[8.5px] font-semibold text-[#475569]">{scopeLabel(row.scope_type)}</span></div>) : <p className="text-[10px] text-[#94A3B8]">No scope exceptions. All permissions use the role default.</p>}</div></Card>
  </div>;
}

function PortalAccess({ employee, profile, role }: { employee: EmployeeRow; profile: ProfileRow; role: AppRole }) {
  const aligned = employee.employment_status === "active" ? profile.is_active : !profile.is_active;
  return <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
    <Card><div className="flex items-start justify-between gap-3"><div><h2 className="text-[15px] font-semibold text-[#17203A]">Portal account</h2><p className="mt-1 text-[10px] text-[#64748B]">Authentication and profile state.</p></div><StatusBadge value={profile.is_active ? "Active" : "Inactive"} /></div><div className="mt-4 grid gap-3 sm:grid-cols-2"><Detail label="Login email" value={profile.email ?? employee.email ?? "Not recorded"} /><Detail label="Portal role" value={roleLabels[role]} /><Detail label="Employee status" value={titleCase(employee.employment_status)} /><Detail label="State alignment" value={aligned ? "Aligned" : "Review required"} /></div></Card>
    <Card><h2 className="text-[15px] font-semibold text-[#17203A]">Governed lifecycle</h2><p className="mt-1 text-[10px] leading-4 text-[#64748B]">Invitations, suspension, restoration and offboarding use the centralized employee portal governance service. Access Control does not maintain a second mutation path.</p><div className="mt-4 flex flex-wrap gap-2"><Link href={`/employees/${employee.id}`} className="inline-flex h-9 items-center rounded-xl bg-[#172554] px-4 text-[10px] font-semibold text-white">Open employee record</Link><Link href="/users" className="inline-flex h-9 items-center rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] font-semibold text-[#334155]">Open User Management</Link></div><p className="mt-4 rounded-xl bg-[#F8FAFC] px-3 py-2 text-[8.5px] leading-4 text-[#64748B]">Protected-role safeguards, self-suspension protection and final Super Admin / IT Super User protection remain enforced by the server-side governance layer.</p></Card>
  </div>;
}

function History({ events }: { events: Array<{ id: string; type: "permission" | "lifecycle"; title: string; detail: string; created_at: string }> }) {
  return <Card><h2 className="text-[15px] font-semibold text-[#17203A]">Access history</h2><p className="mt-1 text-[10px] text-[#64748B]">Permission changes and portal lifecycle events in one timeline.</p><div className="mt-4 space-y-2">{events.length ? events.map((event) => <div key={`${event.type}-${event.id}`} className="rounded-xl border border-[#E2E8F0] px-3 py-3"><div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[7.5px] font-bold uppercase ${event.type === "permission" ? "bg-indigo-50 text-indigo-700" : "bg-emerald-50 text-emerald-700"}`}>{event.type}</span><p className="text-[10px] font-semibold text-[#24345A]">{event.title}</p></div><span className="text-[8.5px] text-[#94A3B8]">{formatDate(event.created_at)}</span></div><p className="mt-1 text-[8.5px] text-[#64748B]">{event.detail}</p></div>) : <p className="text-[10px] text-[#94A3B8]">No access events recorded.</p>}</div></Card>;
}

function buildHistory(permissionAudit: AuditRow[], lifecycleAudit: LifecycleAuditRow[]) {
  return [
    ...permissionAudit.map((row) => ({ id: row.id, type: "permission" as const, title: `${friendlyCapability(row.capability)}: ${row.previous_access ?? "inherit"} → ${row.new_access}`, detail: `${scopeLabel(row.previous_scope ?? "inherit")} → ${scopeLabel(row.new_scope ?? "inherit")} · ${row.reason}`, created_at: row.created_at })),
    ...lifecycleAudit.map((row) => ({ id: row.id, type: "lifecycle" as const, title: lifecycleLabel(row.action), detail: lifecycleDetail(row), created_at: row.created_at })),
  ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50);
}

function lifecycleDetail(row: LifecycleAuditRow) {
  const reason = valueFromData(row.new_data, "reason") ?? valueFromData(row.old_data, "reason");
  const role = valueFromData(row.new_data, "role");
  return [role ? `Role: ${roleLabels[role as AppRole] ?? role}` : null, reason].filter(Boolean).join(" · ") || "Portal lifecycle state updated.";
}
function valueFromData(data: Record<string, unknown> | null, key: string) { const value = data?.[key]; return typeof value === "string" && value.trim() ? value : null; }
function lifecycleLabel(action: string) { return ({ employee_portal_invited: "Portal invitation sent", employee_portal_reinvited: "Portal invitation resent", employee_portal_suspended: "Portal access suspended", employee_portal_restored: "Portal access restored", employee_deactivated: "Employee deactivated", employee_reactivated: "Employee reactivated" } as Record<string, string>)[action] ?? action.replaceAll("_", " "); }
function normalizeView(value?: string): AccessView { return (["overview", "roles", "permissions", "scope", "portal", "history"] as const).includes(value as AccessView) ? value as AccessView : "overview"; }
function Tab({ current, value, label, count }: { current: AccessView; value: AccessView; label: string; count?: number }) { return <Link href={`?view=${value}`} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-semibold ${current === value ? "bg-[#172554] text-white" : "text-[#475569] hover:bg-[#F1F5F9]"}`}>{label}{typeof count === "number" ? <span className={`rounded-full px-2 py-0.5 text-[8px] ${current === value ? "bg-white/15 text-white" : "bg-[#E2E8F0] text-[#64748B]"}`}>{count}</span> : null}</Link>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="text-[8.5px] font-semibold uppercase tracking-[.05em] text-[#64748B]">{label}<div className="mt-1">{children}</div></label>; }
function Summary({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl border border-white/75 bg-white/80 p-4 shadow-sm"><p className="text-[9px] font-semibold uppercase tracking-[.05em] text-[#64748B]">{label}</p><p className="mt-1 text-[12px] font-semibold text-[#172554]">{value}</p></div>; }
function Detail({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-[#E2E8F0] bg-[#FAFCFF] px-3 py-3"><p className="text-[8px] font-semibold uppercase tracking-[.05em] text-[#94A3B8]">{label}</p><p className="mt-1 text-[10.5px] font-semibold text-[#334155]">{value}</p></div>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div><p className="text-[7.5px] font-semibold uppercase tracking-[.05em] text-[#94A3B8]">{label}</p><p className="mt-1 text-[9.5px] font-semibold text-[#334155]">{value}</p></div>; }
function Posture({ label, value, tone }: { label: string; value: string; tone: "ok" | "warn" | "info" }) { const style = tone === "ok" ? "text-emerald-700" : tone === "warn" ? "text-amber-700" : "text-indigo-700"; return <div className="flex items-center justify-between rounded-xl border border-[#E2E8F0] px-3 py-3"><span className="text-[9.5px] text-[#64748B]">{label}</span><span className={`text-[9.5px] font-semibold ${style}`}>{value}</span></div>; }
function Badge({ children }: { children: React.ReactNode }) { return <span className="inline-flex rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[8.5px] font-semibold text-[#4338CA]">{children}</span>; }
function StatusBadge({ value }: { value: string }) { const warn = value === "Needs review" || value === "Inactive"; return <span className={`rounded-full px-2.5 py-1 text-[8.5px] font-semibold ${warn ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>{value}</span>; }
function Risk({ value }: { value: string }) { const style = value === "critical" ? "bg-red-50 text-red-700" : value === "high" ? "bg-amber-50 text-amber-700" : value === "sensitive" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600"; return <span className={`rounded-full px-2 py-1 text-[7px] font-bold uppercase ${style}`}>{value}</span>; }
function Notice({ tone, text }: { tone: "success" | "error"; text: string }) { return <div className={`rounded-xl border px-4 py-3 text-[10.5px] ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{text}</div>; }
function friendlyCapability(value: string) { return permissionDefinitions.find((item) => item.capability === value)?.label ?? value.replaceAll("_", " "); }
function defaultScope(role: AppRole) { return ["super_admin", "admin", "it_super_user", "manager", "director", "sales_operations_head", "backoffice_executive"].includes(role) ? "organization" : ["sales_head", "zonal_head", "asm", "sales_manager"].includes(role) ? "hierarchy" : "self"; }
function scopeLabel(value: string) { return ({ inherit: "Inherit role", self: "Own records", hierarchy: "Reporting hierarchy", organization: "Entire organisation" } as Record<string, string>)[value] ?? titleCase(value); }
function titleCase(value: string) { return value.replaceAll("_", " ").replace(/\b\w/g, (match) => match.toUpperCase()); }
function isCurrentOverride(row: OverrideRow) { return !row.expires_at || new Date(row.expires_at) > new Date(); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
function toLocalInput(value: string | null | undefined) { if (!value) return ""; const date = new Date(value); if (Number.isNaN(date.getTime())) return ""; const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000); return local.toISOString().slice(0, 16); }
