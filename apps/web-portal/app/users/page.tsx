import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { redirect } from "next/navigation";
import { createProfileRecord } from "@/app/actions";
import { FormSubmitButton } from "@/components/form-submit-button";
import { AppShell } from "@/components/shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { appRoles, designationOptions, roleLabels } from "@/lib/roles";
import { UserManagementWorkspace, type ProfileRow } from "./user-management-workspace";

export default async function UsersPage({ searchParams }: { searchParams?: Promise<{ q?: string; role?: string; status?: string }> }) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!(await hasEffectiveCapability(profile, "manage_users", "approve"))) redirect("/access-denied");

  const params = (await searchParams) ?? {};
  const supabase = await createServerSupabaseClient();
  const [{ data, error }, managersResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, full_name, email, role, phone, employee_code, reporting_manager_id, department, designation, is_active, direct_reports:profiles!profiles_reporting_manager_id_fkey(count)")
      .order("created_at", { ascending: false })
      .returns<ProfileRow[]>(),
    supabase.from("profiles").select("id, full_name, role").eq("is_active", true).order("full_name"),
  ]);
  const managers = managersResult.data ?? [];
  const employeeRoles = appRoles.filter((item) => item !== "customer");

  return (
    <AppShell title="User Management">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-navy-900">User Management</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Create login users securely, manage profile records, assign roles/reporting managers, and use safe deactivation.</p>
      </div>

      <section className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-soft">
        <h2 className="text-lg font-bold text-navy-900">Create user</h2>
        <form action={createProfileRecord} className="mt-4 grid gap-3 md:grid-cols-3">
          <Input name="email" label="Email" required />
          <Input name="password" label="Temporary password" type="password" required />
          <Input name="full_name" label="Full name" required />
          <Input name="phone" label="Phone" />
          <Input name="employee_code" label="Employee code" />
          <Select name="role" label="Role" options={employeeRoles.map((item) => [item, roleLabels[item]])} required />
          <Select name="reporting_manager_id" label="Reporting manager" options={managers.map((item) => [item.id, `${item.full_name} (${roleLabels[item.role as keyof typeof roleLabels] ?? item.role})`])} />
          <Input name="department" label="Department" />
          <Select name="designation" label="Designation" options={designationOptions.map((item) => [item, item])} />
          <FormSubmitButton label="Create profile" pendingLabel="Creating" className="inline-flex items-center justify-center rounded-2xl bg-navy-900 px-4 py-3 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70 md:col-span-3" />
        </form>
      </section>

      <UserManagementWorkspace users={data ?? []} managers={managers} initialQuery={params.q?.trim() ?? ""} initialRole={params.role ?? ""} initialStatus={params.status ?? ""} loadError={error?.message ?? null} />
    </AppShell>
  );
}

function Input({ label, ...props }: { label: string; name: string; required?: boolean; type?: string }) {
  return <label className="grid gap-1 text-xs font-bold text-slate-600">{label}<input {...props} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-normal text-slate-900" /></label>;
}

function Select({ label, options, ...props }: { label: string; name: string; required?: boolean; options: [string, string][] }) {
  return <label className="grid gap-1 text-xs font-bold text-slate-600">{label}<select {...props} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-normal text-slate-900"><option value="">Select</option>{options.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}</select></label>;
}
