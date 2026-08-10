import { hasEffectiveCapability } from "@/lib/effective-permissions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell, Card, PageHeader } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { appRoles, isAppRole, roleLabels, type AppRole } from "@/lib/roles";
import { permissionDefinitions } from "@/lib/permission-management";
import { permissionCatalogueV2 } from "@/lib/access-control-catalogue-v2";
import { roleMatrixV2 } from "@/lib/access-control-role-matrix-v2";

type ProfileRow = {
  id: string;
  role: string;
  is_active: boolean;
  employee_id: string | null;
  email: string | null;
};

type EmployeeRow = {
  id: string;
  employee_code: string;
  full_name: string;
  designation: string;
  department: string | null;
  location: string | null;
  employment_status: string;
};

type OverrideRow = {
  profile_id: string;
  capability: string;
  access_level: string;
  expires_at: string | null;
};

type PermissionAuditRow = {
  id: string;
  actor_profile_id: string | null;
  target_profile_id: string | null;
  capability: string;
  old_access: string | null;
  new_access: string;
  reason: string;
  created_at: string;
};

type LifecycleAuditRow = {
  id: string;
  actor_id: string | null;
  action: string;
  record_id: string | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
  created_at: string;
};

type WorkspaceView = "users" | "roles" | "permissions" | "reviews" | "audit";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AccessControlPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; q?: string; role?: string; success?: string; error?: string }>;
}) {
  const viewer = (await getAuthenticatedProfile(await getServerAccessToken())).profile;
  if (!viewer?.id || !(await hasEffectiveCapability(viewer, "manage_system", "approve"))) redirect("/access-denied");

  const params = await searchParams;
  const view = normalizeView(params.view);
  const q = params.q?.trim().toLowerCase() ?? "";
  const roleFilter = isAppRole(params.role) ? params.role : "";
  const admin = createSupabaseAdminClient();
  const now = new Date();
  const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    { data: profiles },
    { data: employees },
    { data: overrides },
    { data: permissionAudit },
    { data: lifecycleAudit },
  ] = await Promise.all([
    admin
      .from("profiles")
      .select("id,role,is_active,employee_id,email")
      .not("employee_id", "is", null)
      .returns<ProfileRow[]>(),
    admin
      .from("employees")
      .select("id,employee_code,full_name,designation,department,location,employment_status")
      .order("full_name")
      .returns<EmployeeRow[]>(),
    admin
      .from("employee_permission_overrides")
      .select("profile_id,capability,access_level,expires_at")
      .returns<OverrideRow[]>(),
    admin
      .from("permission_change_logs")
      .select("id,actor_profile_id,target_profile_id,capability,old_access,new_access,reason,created_at")
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<PermissionAuditRow[]>(),
    admin
      .from("audit_logs")
      .select("id,actor_id,action,record_id,old_data,new_data,created_at")
      .eq("table_name", "employees")
      .in("action", ["employee_portal_invited", "employee_portal_reinvited", "employee_portal_suspended", "employee_portal_restored", "employee_deactivated", "employee_reactivated"])
      .order("created_at", { ascending: false })
      .limit(50)
      .returns<LifecycleAuditRow[]>(),
  ]);

  const employeeMap = new Map((employees ?? []).map((employee) => [employee.id, employee]));
  const profileMap = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const employeeProfileMap = new Map((profiles ?? []).filter((profile) => profile.employee_id).map((profile) => [profile.employee_id!, profile]));
  const overrideByProfile = new Map<string, OverrideRow[]>();
  for (const row of overrides ?? []) {
    const list = overrideByProfile.get(row.profile_id) ?? [];
    list.push(row);
    overrideByProfile.set(row.profile_id, list);
  }

  const employeeUsers = (employees ?? []).map((employee) => {
    const profile = employeeProfileMap.get(employee.id) ?? null;
    const employeeOverrides = profile ? overrideByProfile.get(profile.id) ?? [] : [];
    return { employee, profile, overrides: employeeOverrides };
  });

  const activePortalUsers = employeeUsers.filter(({ employee, profile }) => employee.employment_status === "active" && profile?.is_active).length;
  const inactivePortalProfiles = employeeUsers.filter(({ profile }) => profile && !profile.is_active).length;
  const employeesWithoutPortal = employeeUsers.filter(({ profile }) => !profile).length;
  const customAccessUsers = employeeUsers.filter(({ overrides: rows }) => rows.some(isCurrentOverride)).length;
  const privilegedUsers = employeeUsers.filter(({ profile }) => profile && profile.is_active && ["super_admin", "admin", "it_super_user"].includes(profile.role)).length;
  const expiringOverrides = (overrides ?? []).filter((row) => {
    if (!row.expires_at) return false;
    const expiry = new Date(row.expires_at);
    return expiry > now && expiry <= thirtyDaysFromNow;
  }).length;

  const filteredUsers = employeeUsers.filter(({ employee, profile }) => {
    if (roleFilter && profile?.role !== roleFilter) return false;
    if (!q) return true;
    return [employee.full_name, employee.employee_code, employee.designation, employee.department, employee.location, profile?.role, profile?.email]
      .some((value) => value?.toLowerCase().includes(q));
  });

  const reviewItems = buildReviewItems(employeeUsers, now, thirtyDaysFromNow);
  const auditEvents = buildAuditEvents(permissionAudit ?? [], lifecycleAudit ?? [], employeeMap, profileMap).slice(0, 50);

  return (
    <AppShell title="Access Control">
      <div className="mx-auto max-w-[1500px] space-y-4 pb-8">
        <PageHeader title="Access Control" />
        {params.success ? <Notice tone="success" text={params.success} /> : null}
        {params.error ? <Notice tone="error" text={params.error} /> : null}

        <nav className="flex flex-wrap gap-2 rounded-2xl border border-[#DCE4EF] bg-white p-2 shadow-sm">
          <WorkspaceTab current={view} value="users" label="Users" count={employeeUsers.length} />
          <WorkspaceTab current={view} value="roles" label="Roles" count={roleMatrixV2.length} />
          <WorkspaceTab current={view} value="permissions" label="Permissions" count={permissionCatalogueV2.length} />
          <WorkspaceTab current={view} value="reviews" label="Access Reviews" count={reviewItems.length} />
          <WorkspaceTab current={view} value="audit" label="Audit Log" count={auditEvents.length} />
        </nav>

        {view === "users" ? (
          <UsersWorkspace
            users={filteredUsers}
            params={params}
            roleFilter={roleFilter}
            metrics={{ activePortalUsers, inactivePortalProfiles, employeesWithoutPortal, customAccessUsers, privilegedUsers, expiringOverrides }}
          />
        ) : null}

        {view === "roles" ? <RolesWorkspace /> : null}
        {view === "permissions" ? <PermissionsWorkspace /> : null}
        {view === "reviews" ? <ReviewsWorkspace items={reviewItems} /> : null}
        {view === "audit" ? <AuditWorkspace events={auditEvents} /> : null}
      </div>
    </AppShell>
  );
}

function UsersWorkspace({
  users,
  params,
  roleFilter,
  metrics,
}: {
  users: Array<{ employee: EmployeeRow; profile: ProfileRow | null; overrides: OverrideRow[] }>;
  params: { q?: string; role?: string };
  roleFilter: AppRole | "";
  metrics: {
    activePortalUsers: number;
    inactivePortalProfiles: number;
    employeesWithoutPortal: number;
    customAccessUsers: number;
    privilegedUsers: number;
    expiringOverrides: number;
  };
}) {
  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <Metric label="Active users" value={metrics.activePortalUsers} />
        <Metric label="Without portal" value={metrics.employeesWithoutPortal} />
        <Metric label="Suspended / disabled" value={metrics.inactivePortalProfiles} />
        <Metric label="Custom access" value={metrics.customAccessUsers} />
        <Metric label="Privileged users" value={metrics.privilegedUsers} />
        <Metric label="Expiring access" value={metrics.expiringOverrides} />
      </section>

      <Card>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-[#17203A]">Users</h2>
            <p className="mt-1 text-[10px] text-[#64748B]">{users.length} employee records</p>
          </div>
          <form className="flex flex-wrap gap-2">
            <input type="hidden" name="view" value="users" />
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="Search employee, role or location"
              className="h-10 w-64 rounded-xl border border-[#D8E1EC] bg-white px-3 text-[10.5px] outline-none focus:border-[#94A3B8]"
            />
            <select name="role" defaultValue={roleFilter} className="h-10 rounded-xl border border-[#D8E1EC] bg-white px-3 text-[10.5px]">
              <option value="">All roles</option>
              {appRoles.filter((role) => !["customer", "intermediary"].includes(role)).map((role) => (
                <option key={role} value={role}>{roleLabels[role]}</option>
              ))}
            </select>
            <button className="h-10 rounded-xl bg-[#172554] px-4 text-[10.5px] font-semibold text-white">Apply</button>
          </form>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[1120px] text-left text-[10.5px]">
            <thead>
              <tr className="border-y border-[#E2E8F0] bg-[#F8FAFC] text-[8.5px] uppercase tracking-[.05em] text-[#64748B]">
                <th className="px-3 py-3">Employee</th>
                <th className="px-3 py-3">Portal</th>
                <th className="px-3 py-3">Primary role</th>
                <th className="px-3 py-3">Scope</th>
                <th className="px-3 py-3">Custom access</th>
                <th className="px-3 py-3">Risk</th>
                <th className="px-3 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EDF2F7]">
              {users.map(({ employee, profile, overrides }) => {
                const role = profile && isAppRole(profile.role) ? profile.role : null;
                const activeOverrides = overrides.filter(isCurrentOverride);
                const risk = userRisk(employee, profile, activeOverrides);
                return (
                  <tr key={employee.id} className="hover:bg-[#FAFCFF]">
                    <td className="px-3 py-3">
                      <p className="font-semibold text-[#0F2A55]">{employee.full_name}</p>
                      <p className="mt-0.5 text-[9px] text-[#64748B]">{employee.employee_code} · {employee.designation}</p>
                      <p className="mt-0.5 text-[8.5px] text-[#94A3B8]">{employee.department ?? "-"} · {employee.location ?? "No location"}</p>
                    </td>
                    <td className="px-3 py-3"><PortalStatus employee={employee} profile={profile} /></td>
                    <td className="px-3 py-3">{role ? <Badge>{roleLabels[role]}</Badge> : <span className="text-[#94A3B8]">Not assigned</span>}</td>
                    <td className="px-3 py-3 text-[#475569]">{role ? defaultScope(role) : "—"}</td>
                    <td className="px-3 py-3">
                      <span className={activeOverrides.length ? "font-semibold text-[#4F46E5]" : "text-[#94A3B8]"}>{activeOverrides.length} custom</span>
                    </td>
                    <td className="px-3 py-3"><Risk value={risk} /></td>
                    <td className="px-3 py-3 text-right">
                      {profile ? (
                        <Link href={`/system/access-control/employees/${profile.id}`} className="inline-flex h-9 items-center rounded-xl bg-[#172554] px-4 text-[10px] font-semibold text-white">Manage</Link>
                      ) : (
                        <Link href={`/employees/${employee.id}`} className="inline-flex h-9 items-center rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] font-semibold text-[#334155]">Employee</Link>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function RolesWorkspace() {
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-[15px] font-semibold text-[#17203A]">Roles</h2><p className="mt-1 text-[10px] text-[#64748B]">V2 role model · read only during migration</p></div>
        <span className="rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-1 text-[8.5px] font-semibold text-[#4338CA]">Shadow model</span>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {roleMatrixV2.map((role) => (
          <div key={role.code} className="rounded-2xl border border-[#E2E8F0] bg-[#FAFCFF] p-4">
            <div className="flex items-start justify-between gap-3">
              <div><h3 className="text-[12px] font-semibold text-[#17203A]">{role.label}</h3><p className="mt-1 text-[9px] leading-4 text-[#64748B]">{role.purpose}</p></div>
              <RoleStatus status={role.status} />
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-[#E2E8F0] pt-3">
              <MiniStat label="Permissions" value={String(role.grants.length)} />
              <MiniStat label="Scope" value={scopeLabel(role.defaultScope)} />
              <MiniStat label="Assignable" value={role.assignable ? "Yes" : "No"} />
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function PermissionsWorkspace() {
  const modules = Array.from(new Set(permissionCatalogueV2.map((permission) => permission.module)));
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="text-[15px] font-semibold text-[#17203A]">Permissions</h2><p className="mt-1 text-[10px] text-[#64748B]">{permissionCatalogueV2.length} V2 permissions · read only during migration</p></div>
        <span className="rounded-full border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-1 text-[8.5px] font-semibold text-[#4338CA]">Shadow catalogue</span>
      </div>
      <div className="mt-4 space-y-4">
        {modules.map((module) => (
          <section key={module} className="rounded-2xl border border-[#E2E8F0] bg-[#FAFCFF] p-4">
            <h3 className="text-[11px] font-semibold uppercase tracking-[.04em] text-[#334155]">{module}</h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-[9.5px]">
                <thead><tr className="border-b border-[#E2E8F0] text-[8px] uppercase tracking-[.04em] text-[#94A3B8]"><th className="pb-2">Permission</th><th className="pb-2">Access</th><th className="pb-2">Scopes</th><th className="pb-2">Risk</th></tr></thead>
                <tbody className="divide-y divide-[#EDF2F7]">
                  {permissionCatalogueV2.filter((permission) => permission.module === module).map((permission) => (
                    <tr key={permission.key}>
                      <td className="py-2.5 pr-4"><p className="font-semibold text-[#24345A]">{permission.label}</p><p className="mt-0.5 font-mono text-[7.5px] text-[#94A3B8]">{permission.key}</p></td>
                      <td className="py-2.5 pr-4 text-[#475569]">{permission.allowedAccess.join(" / ")}</td>
                      <td className="py-2.5 pr-4 text-[#64748B]">{permission.scopeRequired ? permission.allowedScopes.map(scopeLabel).join(", ") : "Not scoped"}</td>
                      <td className="py-2.5"><Risk value={permission.risk} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
      </div>
    </Card>
  );
}

function ReviewsWorkspace({ items }: { items: ReviewItem[] }) {
  return (
    <Card>
      <div className="flex items-center justify-between gap-3"><div><h2 className="text-[15px] font-semibold text-[#17203A]">Access Reviews</h2><p className="mt-1 text-[10px] text-[#64748B]">{items.length} items requiring review</p></div></div>
      <div className="mt-4 space-y-2">
        {items.length ? items.map((item) => (
          <div key={item.key} className="flex flex-col gap-3 rounded-2xl border border-[#E2E8F0] bg-[#FAFCFF] p-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-[#17203A]">{item.employeeName}</p><Risk value={item.risk} /></div><p className="mt-1 text-[9.5px] text-[#64748B]">{item.title}</p><p className="mt-0.5 text-[8.5px] text-[#94A3B8]">{item.detail}</p></div>
            {item.profileId ? <Link href={`/system/access-control/employees/${item.profileId}`} className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white px-4 text-[9.5px] font-semibold text-[#334155]">Review</Link> : null}
          </div>
        )) : <EmptyState text="No access review items are currently open." />}
      </div>
    </Card>
  );
}

function AuditWorkspace({ events }: { events: AuditEvent[] }) {
  return (
    <Card>
      <div><h2 className="text-[15px] font-semibold text-[#17203A]">Audit Log</h2><p className="mt-1 text-[10px] text-[#64748B]">Permission and portal lifecycle events</p></div>
      <div className="mt-4 space-y-2">
        {events.length ? events.map((event) => (
          <div key={event.key} className="grid gap-2 rounded-xl border border-[#E2E8F0] px-3 py-3 lg:grid-cols-[180px_1fr_220px] lg:items-center">
            <div><p className="text-[9.5px] font-semibold text-[#334155]">{event.actor}</p><p className="mt-0.5 text-[8px] text-[#94A3B8]">{event.type}</p></div>
            <div><p className="text-[10px] font-semibold text-[#24345A]">{event.title}</p><p className="mt-0.5 text-[8.5px] text-[#64748B]">{event.detail}</p></div>
            <span className="text-[8.5px] text-[#94A3B8] lg:text-right">{formatDate(event.createdAt)}</span>
          </div>
        )) : <EmptyState text="No access events have been recorded yet." />}
      </div>
    </Card>
  );
}

type ReviewItem = { key: string; employeeName: string; profileId: string | null; title: string; detail: string; risk: string };

function buildReviewItems(
  users: Array<{ employee: EmployeeRow; profile: ProfileRow | null; overrides: OverrideRow[] }>,
  now: Date,
  thirtyDaysFromNow: Date,
) {
  const items: ReviewItem[] = [];
  for (const { employee, profile, overrides } of users) {
    if (profile?.is_active && employee.employment_status !== "active") {
      items.push({ key: `${employee.id}:inactive-active-portal`, employeeName: employee.full_name, profileId: profile.id, title: "Inactive employee has active portal access", detail: roleDisplay(profile.role), risk: "critical" });
    }
    if (profile && !profile.is_active && employee.employment_status === "active") {
      items.push({ key: `${employee.id}:disabled-profile`, employeeName: employee.full_name, profileId: profile.id, title: "Active employee has disabled portal access", detail: roleDisplay(profile.role), risk: "sensitive" });
    }
    if (profile?.is_active && ["super_admin", "it_super_user"].includes(profile.role)) {
      items.push({ key: `${employee.id}:protected-role`, employeeName: employee.full_name, profileId: profile.id, title: `${roleDisplay(profile.role)} access review`, detail: "Protected or highest-privilege account", risk: "critical" });
    } else if (profile?.is_active && profile.role === "admin") {
      items.push({ key: `${employee.id}:admin-role`, employeeName: employee.full_name, profileId: profile.id, title: "Administrative access review", detail: "Organisation-wide portal administration", risk: "high" });
    }
    const currentOverrides = overrides.filter(isCurrentOverride);
    if (currentOverrides.length) {
      items.push({ key: `${employee.id}:custom-access`, employeeName: employee.full_name, profileId: profile?.id ?? null, title: "Custom employee permissions", detail: `${currentOverrides.length} active exception${currentOverrides.length === 1 ? "" : "s"}`, risk: "sensitive" });
    }
    const expiring = overrides.filter((row) => {
      if (!row.expires_at) return false;
      const expiry = new Date(row.expires_at);
      return expiry > now && expiry <= thirtyDaysFromNow;
    });
    if (expiring.length) {
      items.push({ key: `${employee.id}:expiring`, employeeName: employee.full_name, profileId: profile?.id ?? null, title: "Temporary access expiring soon", detail: `${expiring.length} permission${expiring.length === 1 ? "" : "s"} expire within 30 days`, risk: "standard" });
    }
  }
  return items;
}

type AuditEvent = { key: string; actor: string; type: string; title: string; detail: string; createdAt: string };

function buildAuditEvents(
  permissionRows: PermissionAuditRow[],
  lifecycleRows: LifecycleAuditRow[],
  employees: Map<string, EmployeeRow>,
  profiles: Map<string, ProfileRow>,
) {
  const profileEmployeeName = (profileId: string | null) => {
    if (!profileId) return "System";
    const profile = profiles.get(profileId);
    return profile?.employee_id ? employees.get(profile.employee_id)?.full_name ?? "Portal administrator" : "Portal administrator";
  };

  const permissionEvents: AuditEvent[] = permissionRows.map((row) => ({
    key: `permission:${row.id}`,
    actor: profileEmployeeName(row.actor_profile_id),
    type: "Permission",
    title: `${friendlyCapability(row.capability)} → ${row.new_access}`,
    detail: row.reason || (row.old_access ? `${row.old_access} → ${row.new_access}` : "Permission updated"),
    createdAt: row.created_at,
  }));

  const lifecycleEvents: AuditEvent[] = lifecycleRows.map((row) => ({
    key: `lifecycle:${row.id}`,
    actor: profileEmployeeName(row.actor_id),
    type: "Portal lifecycle",
    title: lifecycleActionLabel(row.action),
    detail: row.record_id && employees.has(row.record_id) ? employees.get(row.record_id)!.full_name : "Employee portal account",
    createdAt: row.created_at,
  }));

  return [...permissionEvents, ...lifecycleEvents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

function WorkspaceTab({ current, value, label, count }: { current: WorkspaceView; value: WorkspaceView; label: string; count: number }) {
  const active = current === value;
  return <Link href={`/system/access-control?view=${value}`} className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[10px] font-semibold transition ${active ? "bg-[#172554] text-white shadow-sm" : "text-[#475569] hover:bg-[#F1F5F9]"}`}>{label}<span className={`rounded-full px-2 py-0.5 text-[8px] ${active ? "bg-white/15 text-white" : "bg-[#EEF2F7] text-[#64748B]"}`}>{count}</span></Link>;
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="rounded-2xl border border-white/75 bg-white/90 p-4 shadow-sm"><p className="text-2xl font-semibold text-[#172554]">{value}</p><p className="mt-1 text-[8.5px] font-semibold uppercase tracking-[.05em] text-[#64748B]">{label}</p></div>; }
function MiniStat({ label, value }: { label: string; value: string }) { return <div><p className="text-[8px] uppercase tracking-[.04em] text-[#94A3B8]">{label}</p><p className="mt-1 text-[9.5px] font-semibold text-[#334155]">{value}</p></div>; }
function Badge({ children }: { children: React.ReactNode }) { return <span className="inline-flex rounded-full bg-[#EEF2FF] px-2.5 py-1 text-[9px] font-semibold text-[#4338CA]">{children}</span>; }
function Notice({ tone, text }: { tone: "success" | "error"; text: string }) { return <div className={`rounded-xl border px-4 py-3 text-[10.5px] ${tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>{text}</div>; }
function EmptyState({ text }: { text: string }) { return <div className="rounded-2xl border border-dashed border-[#CBD5E1] bg-[#FAFCFF] px-4 py-8 text-center text-[10px] text-[#94A3B8]">{text}</div>; }

function PortalStatus({ employee, profile }: { employee: EmployeeRow; profile: ProfileRow | null }) {
  if (!profile) return <StatusBadge tone="neutral">No portal</StatusBadge>;
  if (employee.employment_status !== "active" && profile.is_active) return <StatusBadge tone="danger">Review</StatusBadge>;
  if (!profile.is_active) return <StatusBadge tone="warning">Disabled</StatusBadge>;
  return <StatusBadge tone="success">Active</StatusBadge>;
}

function StatusBadge({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral"; children: React.ReactNode }) {
  const style = tone === "success" ? "bg-emerald-50 text-emerald-700" : tone === "warning" ? "bg-amber-50 text-amber-700" : tone === "danger" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[8.5px] font-semibold ${style}`}>{children}</span>;
}

function RoleStatus({ status }: { status: string }) {
  const style = status === "protected" ? "bg-violet-50 text-violet-700" : status === "compatibility" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700";
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[7.5px] font-bold uppercase ${style}`}>{status}</span>;
}

function Risk({ value }: { value: string }) {
  const style = value === "critical" ? "bg-red-50 text-red-700" : value === "high" ? "bg-amber-50 text-amber-700" : value === "sensitive" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600";
  return <span className={`shrink-0 rounded-full px-2 py-1 text-[7.5px] font-bold uppercase ${style}`}>{value}</span>;
}

function normalizeView(value: string | undefined): WorkspaceView {
  return value === "roles" || value === "permissions" || value === "reviews" || value === "audit" ? value : "users";
}

function isCurrentOverride(row: OverrideRow) {
  return !row.expires_at || new Date(row.expires_at).getTime() > Date.now();
}

function userRisk(employee: EmployeeRow, profile: ProfileRow | null, overrides: OverrideRow[]) {
  if (profile?.is_active && employee.employment_status !== "active") return "critical";
  if (profile?.is_active && ["super_admin", "it_super_user"].includes(profile.role)) return "critical";
  if (profile?.is_active && profile.role === "admin") return "high";
  if (overrides.length) return "sensitive";
  return "standard";
}

function friendlyCapability(value: string) { return permissionDefinitions.find((item) => item.capability === value)?.label ?? value.replaceAll("_", " "); }
function roleDisplay(value: string) { return isAppRole(value) ? roleLabels[value] : value.replaceAll("_", " "); }
function lifecycleActionLabel(action: string) { return action.replaceAll("_", " ").replace(/^employee portal /, "Portal ").replace(/^employee /, "Employee ").replace(/^./, (char) => char.toUpperCase()); }
function scopeLabel(scope: string) { return scope.replaceAll("_", " ").replace(/^./, (char) => char.toUpperCase()); }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
function defaultScope(role: AppRole) { if (["super_admin", "admin", "it_super_user", "manager", "director", "sales_operations_head", "backoffice_executive"].includes(role)) return "Entire organisation"; if (["sales_head", "zonal_head", "asm", "sales_manager"].includes(role)) return "Reporting hierarchy"; if (["claim_processor", "field_executive"].includes(role)) return "Assigned records"; return "Own records"; }
