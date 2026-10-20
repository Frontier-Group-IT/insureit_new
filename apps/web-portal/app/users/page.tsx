import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { UserManagementWorkspace, type ProfileRow } from "./user-management-workspace";

type ProfileRecord = Omit<ProfileRow, "direct_reports">;

export default async function UsersPage({ searchParams }: { searchParams?: Promise<{ q?: string; role?: string; status?: string }> }) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!(await hasEffectiveCapability(profile, "manage_users", "approve"))) redirect("/access-denied");

  const params = (await searchParams) ?? {};
  const supabase = await createServerSupabaseClient();
  const { data, error } = await fetchAllPages<ProfileRecord, unknown>((from, to) => supabase
    .from("profiles")
    .select("id, full_name, email, role, phone, employee_code, reporting_manager_id, department, designation, is_active")
    .order("created_at", { ascending: false })
    .range(from, to)
    .returns<ProfileRecord[]>());

  const profiles = data ?? [];
  const directReportCounts = new Map<string, number>();
  for (const item of profiles) {
    if (!item.reporting_manager_id) continue;
    directReportCounts.set(item.reporting_manager_id, (directReportCounts.get(item.reporting_manager_id) ?? 0) + 1);
  }

  const users: ProfileRow[] = profiles.map((item) => ({
    ...item,
    direct_reports: [{ count: directReportCounts.get(item.id) ?? 0 }],
  }));
  const managers = profiles
    .filter((item) => item.is_active)
    .map((item) => ({ id: item.id, full_name: item.full_name, role: item.role }));
  return (
    <AppShell title="User Management">
      <div className="mx-auto max-w-[1500px] space-y-3 pb-6">
        <section className="flex min-h-[68px] items-center justify-between rounded-2xl border border-[#DCE4EF] bg-white px-5 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.05)]">
          <div>
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-[#64748B]">System administration</p>
            <h1 className="mt-1 text-[20px] font-bold tracking-[-0.02em] text-[#17203A]">User Management</h1>
          </div>
          <div className="flex items-center gap-2">{profile?.role === "it_super_user" && <a href="/users/auth-directory" className="rounded-lg bg-[#17365D] px-3 py-2 text-xs font-semibold text-white">Auth Password Management</a>}<div className="rounded-xl border border-[#DCE4EF] bg-[#F8FAFC] px-3 py-2 text-right">
            <p className="text-[8px] font-bold uppercase text-[#94A3B8]">Directory</p>
            <p className="mt-0.5 text-[11px] font-bold text-[#17365D]">{users.length} users</p>
          </div></div>
        </section>
      <UserManagementWorkspace users={users} managers={managers} canPermanentDelete={profile?.role === "it_super_user"} initialQuery={params.q?.trim() ?? ""} initialRole={params.role ?? ""} initialStatus={params.status ?? ""} loadError={error ? "User records could not be loaded. Please refresh and try again." : null} />
      </div>
    </AppShell>
  );
}
