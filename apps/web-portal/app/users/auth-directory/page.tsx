import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { AdminPasswordReset } from "../admin-password-reset";

export default async function AuthDirectoryPage() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile || profile.role !== "it_super_user" || !profile.is_active) redirect("/access-denied");
  const admin = createSupabaseAdminClient();
  const users: { id: string; email?: string; phone?: string; created_at: string }[] = [];
  for (let page = 1; page <= 30; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 500 });
    if (result.error) throw new Error("Could not load Supabase Auth users.");
    users.push(...result.data.users.map(u => ({ id: u.id, email: u.email, phone: u.phone, created_at: u.created_at })));
    if (result.data.users.length < 500) break;
  }
  return <AppShell title="Auth Password Management">
    <main className="mx-auto max-w-[1200px] space-y-3 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div><h1 className="text-xl font-bold">Supabase Auth Users</h1><p className="text-xs text-slate-500">IT Super User only · {users.length} accounts · all portal account types</p></div>
        <a href="/users" className="rounded-lg border px-3 py-2 text-xs">Back to User Management</a>
      </div>
      <div className="space-y-2">
        {users.map(u => <details key={u.id} className="rounded-xl border bg-white p-3">
          <summary className="cursor-pointer text-sm font-semibold">{u.email ?? u.phone ?? "Auth user"} <span className="ml-2 break-all text-xs font-normal text-slate-500">{u.id}</span></summary>
          <div className="mt-3"><AdminPasswordReset userId={u.id}/></div>
        </details>)}
      </div>
    </main>
  </AppShell>;
}
