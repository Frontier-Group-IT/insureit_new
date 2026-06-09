import { DataError, DataTable } from "@/components/record-list";
import { AppShell, PageHeader } from "@/components/shell";
import { SearchFilterBar, StatusBadge } from "@/components/ui";
import { createServerSupabaseClient } from "@/lib/auth-server";

type ProfileRow = { id: string; full_name: string; role: string; phone: string | null; is_active: boolean };

export default async function UsersPage() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.from("profiles").select("id, full_name, role, phone, is_active").order("created_at", { ascending: false }).returns<ProfileRow[]>();

  return <AppShell title="User management"><PageHeader title="User management" /><SearchFilterBar searchPlaceholder="Search users by name, email, role, or status" filterLabel="User status" />{error ? <DataError message={error.message} /> : <DataTable rows={data ?? []} emptyTitle="No staff users added yet" emptyDescription="Add authorized staff users to manage portal access." columns={[{ header: "Name", cell: (user) => <p className="font-semibold text-navy-900">{user.full_name}</p> }, { header: "Role", cell: (user) => user.role }, { header: "Phone", cell: (user) => user.phone ?? "—" }, { header: "Status", cell: (user) => <StatusBadge status={user.is_active ? "Active" : "Closed"} /> }]} />}</AppShell>;
}
