import { hasEffectiveCapability, hasAnyEffectiveCapability } from "@/lib/effective-permissions";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { appRoles, canManageUsers, roleLabels } from "@/lib/roles";
import { EmployeeCreateForm } from "../employee-forms";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewEmployeePage() {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.id || !(await hasEffectiveCapability(profile, "manage_employees", "edit"))) redirect("/access-denied");

  const supabase = await createServerSupabaseClient();
  const { data: managers, error } = await supabase
    .from("employees")
    .select("id, employee_code, full_name")
    .eq("employment_status", "active")
    .order("full_name");

  if (error) throw new Error(`Unable to load reporting managers: ${error.message}`);

  const portalRoles = appRoles
    .filter((role) => role !== "customer" && role !== "intermediary")
    .map((role) => ({ value: role, label: roleLabels[role] }));

  return (
    <AppShell title="Add Employee" backHref="/employees">
      <div className="mx-auto max-w-[1180px] space-y-4 pb-8">
        <section className="rounded-2xl border border-[#D7E6F5] bg-white p-5 shadow-[0_8px_30px_rgba(7,29,73,0.07)]">
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#E7EEF6] pb-4">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-[#667085]">Employees & Organization</p>
              <h1 className="mt-1 text-[22px] font-bold text-[#071D49]">Add employee</h1>
              <p className="mt-1 text-[10.5px] text-[#667085]">Create the employee directory record and optionally send portal access in the same onboarding flow.</p>
            </div>
            <Link href="/employees" className="rounded-lg border border-[#CBD8E8] bg-white px-3 py-2 text-[10px] font-semibold text-[#071D49]">Employee directory</Link>
          </div>
          <div className="pt-5">
            <EmployeeCreateForm managers={managers ?? []} portalRoles={portalRoles} />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
