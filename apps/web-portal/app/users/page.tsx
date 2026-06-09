import { AppShell, Card, PageHeader } from "@/components/shell";

const roles = ["super_admin", "admin", "manager", "claim_processor", "field_executive", "customer"];

export default function UsersPage() {
  return <AppShell><PageHeader title="User management" description="Manage portal access, Supabase Auth profiles, and role-based access controls." /><Card><div className="grid gap-4 md:grid-cols-2"><div className="grid gap-2"><label>Invite email</label><input placeholder="user@example.com" /></div><div className="grid gap-2"><label>Role</label><select>{roles.map((role) => <option key={role}>{role}</option>)}</select></div></div><button className="mt-6 rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-semibold text-white" type="button">Prepare invite</button></Card></AppShell>;
}
