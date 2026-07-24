import { redirect } from "next/navigation";
import { createProfileRecord, setProfileActive, updateProfileRecord } from "@/app/actions";
import { DataError, DataTable } from "@/components/record-list";
import { FormSubmitButton } from "@/components/form-submit-button";
import { AppShell } from "@/components/shell";
import { StatusBadge } from "@/components/ui";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { appRoles, canManageUsers, designationOptions, roleLabels } from "@/lib/roles";

type ProfileRow = {
  id: string;
  full_name: string;
  email: string | null;
  role: keyof typeof roleLabels;
  phone: string | null;
  employee_code: string | null;
  reporting_manager_id: string | null;
  department: string | null;
  designation: string | null;
  is_active: boolean;
  direct_reports: { count: number }[];
};

export default async function UsersPage({ searchParams }: { searchParams?: Promise<{ q?: string; role?: string; status?: string }> }) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!canManageUsers(profile?.role)) redirect("/access-denied");

  const params = (await searchParams) ?? {};
  const q = params.q?.trim() ?? "";
  const role = params.role ?? "";
  const status = params.status ?? "";
  const supabase = await createServerSupabaseClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, email, role, phone, employee_code, reporting_manager_id, department, designation, is_active, direct_reports:profiles!profiles_reporting_manager_id_fkey(count)")
    .order("created_at", { ascending: false });

  if (q) {
    query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%,employee_code.ilike.%${q}%`);
  }
  if (role && appRoles.includes(role as (typeof appRoles)[number])) {
    query = query.eq("role", role);
  }
  if (status === "active") query = query.eq("is_active", true);
  if (status === "inactive") query = query.eq("is_active", false);

  const [{ data, error }, managersResult] = await Promise.all([
    query.returns<ProfileRow[]>(),
    supabase.from("profiles").select("id, full_name, role").eq("is_active", true).order("full_name")
  ]);
  const users = data ?? [];
  const managers = managersResult.data ?? [];
  const employeeRoles = appRoles.filter((item) => item !== "customer");

  return (
    <AppShell title="User Management">
      <div className="mb-6">
        <h1 className="text-2xl font-black text-navy-900">User Management</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">
          Create login users securely, manage profile records, assign roles/reporting managers, and use safe deactivation.
        </p>
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

      <form className="mb-4 grid gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:grid-cols-4">
        <input name="q" defaultValue={q} placeholder="Search name, email, phone, employee code" className="rounded-2xl border border-slate-200 px-4 py-3 text-sm md:col-span-2" />
        <select name="role" defaultValue={role} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
          <option value="">All roles</option>
          {appRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
        </select>
        <select name="status" defaultValue={status} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm">
          <option value="">All status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <button className="rounded-2xl bg-green-600 px-4 py-3 text-sm font-bold text-white md:col-span-4">Apply filters</button>
      </form>

      {error ? <DataError message={error.message} /> : (
        <DataTable
          rows={users}
          emptyTitle="No users found"
          columns={[
            { header: "User", cell: (user) => <div><p className="font-semibold text-navy-900">{user.full_name}</p><p className="text-xs text-slate-500">{user.email ?? user.employee_code ?? user.id}</p></div> },
            { header: "Role", cell: (user) => roleLabels[user.role] ?? user.role },
            { header: "Phone", cell: (user) => user.phone ?? "-" },
            { header: "Reports", cell: (user) => user.direct_reports?.[0]?.count ?? 0 },
            { header: "Status", cell: (user) => <StatusBadge status={user.is_active ? "Active" : "Closed"} /> },
            { header: "Edit", cell: (user) => <InlineEditForm user={user} managers={managers} /> }
          ]}
        />
      )}
    </AppShell>
  );
}

function InlineEditForm({ user, managers }: { user: ProfileRow; managers: { id: string; full_name: string; role: string }[] }) {
  const updateAction = updateProfileRecord.bind(null, user.id);
  const toggleAction = setProfileActive.bind(null, user.id, !user.is_active);
  return (
    <div className="min-w-72 space-y-2">
      <form action={updateAction} className="grid gap-2">
        <input name="full_name" defaultValue={user.full_name} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" />
        <input name="email" defaultValue={user.email ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" />
        <input name="phone" defaultValue={user.phone ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" />
        <input name="employee_code" defaultValue={user.employee_code ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs" />
        <select name="role" defaultValue={user.role} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
          {appRoles.map((item) => <option key={item} value={item}>{roleLabels[item]}</option>)}
        </select>
        <select name="reporting_manager_id" defaultValue={user.reporting_manager_id ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
          <option value="">No reporting manager</option>
          {managers.filter((item) => item.id !== user.id).map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
        </select>
        <input name="department" defaultValue={user.department ?? ""} placeholder="Department" className="rounded-xl border border-slate-200 px-3 py-2 text-xs" />
        <select name="designation" defaultValue={user.designation ?? ""} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
          <option value="">Select designation</option>
          {designationOptions.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
        <input type="hidden" name="is_active" value={user.is_active ? "true" : "false"} />
        <FormSubmitButton label="Save" pendingLabel="Saving" className="inline-flex items-center justify-center rounded-xl bg-navy-900 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-70" />
      </form>
      <form action={toggleAction}>
        <FormSubmitButton label={user.is_active ? "Deactivate" : "Reactivate"} pendingLabel={user.is_active ? "Deactivating" : "Reactivating"} className="inline-flex w-full items-center justify-center rounded-xl border border-slate-300 px-3 py-2 text-xs font-bold text-navy-900 disabled:cursor-not-allowed disabled:opacity-70" />
      </form>
    </div>
  );
}

function Input({ label, ...props }: { label: string; name: string; required?: boolean; type?: string }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      <input {...props} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-normal text-slate-900" />
    </label>
  );
}

function Select({ label, options, ...props }: { label: string; name: string; required?: boolean; options: [string, string][] }) {
  return (
    <label className="grid gap-1 text-xs font-bold text-slate-600">
      {label}
      <select {...props} className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-normal text-slate-900">
        <option value="">Select</option>
        {options.map(([value, labelText]) => <option key={value} value={value}>{labelText}</option>)}
      </select>
    </label>
  );
}
