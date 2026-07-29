import Link from "next/link";
import { AppShell } from "@/components/shell";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Account = {
  id: string;
  intermediary_id: string;
  application_id: string | null;
  email: string;
  status: string;
  invited_at: string | null;
  created_at: string;
};

type Intermediary = {
  id: string;
  display_name: string;
  intermediary_code: string | null;
  intermediary_type: string;
  portal_access_status: string;
};

export default async function IntermediaryPortalUsersPage() {
  await requirePospMispManager();
  const admin = createSupabaseAdminClient();

  const [{ data: accounts, error }, { data: intermediaries }] = await Promise.all([
    admin
      .from("intermediary_portal_accounts")
      .select("id,intermediary_id,application_id,email,status,invited_at,created_at")
      .order("created_at", { ascending: false })
      .limit(500)
      .returns<Account[]>(),
    admin
      .from("intermediaries")
      .select("id,display_name,intermediary_code,intermediary_type,portal_access_status")
      .order("updated_at", { ascending: false })
      .limit(500)
      .returns<Intermediary[]>(),
  ]);

  const intermediaryMap = new Map((intermediaries ?? []).map((item) => [item.id, item]));
  const rows = accounts ?? [];
  const invited = rows.filter((row) => row.status === "invited").length;
  const active = rows.filter((row) => row.status === "active").length;
  const suspended = rows.filter((row) => row.status === "suspended").length;

  return (
    <AppShell title="Intermediary Portal Users" activeNav="distribution">
      <div className="mx-auto max-w-[1480px] space-y-4 pb-8">
        <section className="rounded-2xl border border-[#DCE5EF] bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[.14em] text-[#64748B]">Intermediatory</p>
              <h1 className="mt-1 text-xl font-semibold text-[#10213D]">Portal User Management</h1>
              <p className="mt-1 text-[10px] text-[#64748B]">Review invitations and portal access for Partners, POSP and MISP users.</p>
            </div>
            <Link href="/intermediaries/partner" className="rounded-xl bg-[#0F2A55] px-4 py-2.5 text-[10px] font-semibold text-white">Open Partner Register</Link>
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Invited" value={invited} />
          <Metric label="Active" value={active} />
          <Metric label="Suspended" value={suspended} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
          <div className="border-b bg-[#F8FAFC] px-4 py-3"><h2 className="text-[12px] font-semibold">Portal Accounts</h2></div>
          {error ? (
            <div className="px-4 py-12 text-center text-[11px] text-red-700">Portal accounts could not be loaded.</div>
          ) : rows.length ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-[10.5px]">
                <thead className="border-b text-[8.5px] uppercase text-[#64748B]"><tr><th className="px-4 py-3">User</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Portal Status</th><th className="px-3 py-3">Invitation</th><th className="px-3 py-3">Application</th></tr></thead>
                <tbody className="divide-y">
                  {rows.map((row) => {
                    const intermediary = intermediaryMap.get(row.intermediary_id);
                    return (
                      <tr key={row.id} className="hover:bg-[#FAFCFF]">
                        <td className="px-4 py-3"><p className="font-semibold text-[#0F2A55]">{intermediary?.display_name ?? row.email}</p><p className="mt-0.5 text-[8.5px] text-[#64748B]">{row.email}</p></td>
                        <td className="px-3 py-3 capitalize">{intermediary?.intermediary_type ?? "-"}</td>
                        <td className="px-3 py-3"><Status value={intermediary?.portal_access_status ?? row.status} /></td>
                        <td className="px-3 py-3">{row.invited_at ? new Date(row.invited_at).toLocaleString("en-IN") : "-"}</td>
                        <td className="px-3 py-3">{row.application_id ? <Link href={`/intermediaries/applications/${row.application_id}`} className="font-semibold text-[#4F46E5] hover:underline">Open</Link> : "-"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-4 py-16 text-center text-[11px] text-[#64748B]">No portal accounts have been created yet.</div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-[#DCE5EF] bg-white px-4 py-4 shadow-sm"><p className="text-[9px] font-bold uppercase tracking-[.08em] text-[#64748B]">{label}</p><p className="mt-2 text-2xl font-semibold text-[#10213D]">{value}</p></div>;
}

function Status({ value }: { value: string }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[8.5px] font-semibold capitalize text-slate-700">{value.replaceAll("_", " ")}</span>;
}
