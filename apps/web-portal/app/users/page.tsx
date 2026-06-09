import { AppShell, Card, PageHeader } from "@/components/shell";
import { EmptyState, SearchFilterBar, StatusBadge } from "@/components/ui";

const roles = ["super_admin", "admin", "manager", "claim_processor", "field_executive", "customer"];
const users = [
  { name: "Asha Mehta", email: "asha@example.com", role: "manager", status: "Active" },
  { name: "Ravi Shah", email: "ravi@example.com", role: "claim_processor", status: "Active" },
  { name: "Neha Rao", email: "neha@example.com", role: "field_executive", status: "Active" }
];

export default function UsersPage() {
  return <AppShell><PageHeader title="User management" description="Manage portal access, Supabase Auth profiles, and role-based access controls." /><SearchFilterBar searchPlaceholder="Search users by name, email, role, or status" filterLabel="User status" /><div className="grid gap-6 xl:grid-cols-3"><Card className="xl:col-span-2"><div className="divide-y divide-slate-100">{users.map((user) => <div className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between" key={user.email}><div><p className="font-semibold text-navy-900">{user.name}</p><p className="text-sm text-slate-500">{user.email} · {user.role}</p></div><StatusBadge status={user.status} /></div>)}</div><div className="mt-4"><EmptyState className="hidden" title="No users match the current filters" description="Clear filters or invite a new operations user." /></div></Card><Card><h3 className="text-lg font-semibold text-navy-900">Invite user</h3><div className="mt-4 grid gap-4"><div className="grid gap-2"><label>Invite email</label><input placeholder="user@example.com" /></div><div className="grid gap-2"><label>Role</label><select>{roles.map((role) => <option key={role}>{role}</option>)}</select></div></div><button className="mt-6 w-full rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white" type="button">Prepare invite</button></Card></div></AppShell>;
}
