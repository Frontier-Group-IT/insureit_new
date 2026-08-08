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

export default async function IntermediaryPortalUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await requirePospMispManager();
  const query = await searchParams;
  const q = query.q?.trim().slice(0, 100) ?? "";
  const normalizedQuery = q.toLowerCase();
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
  const rows = (accounts ?? []).filter((row) => {
    if (!normalizedQuery) return true;
    const intermediary = intermediaryMap.get(row.intermediary_id);
    return [
      intermediary?.display_name,
      row.email,
      intermediary?.intermediary_type,
      intermediary?.intermediary_code,
      row.application_id,
    ].some((value) => value?.toLowerCase().includes(normalizedQuery));
  });

  return (
    <AppShell title="Intermediary Portal Users">
      <div className="mx-auto max-w-[1480px] pb-8">
        <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b bg-[#F8FAFC] px-4 py-3 sm:flex-row sm:items-center">
            <h2 className="shrink-0 text-[12px] font-semibold text-[#0F172A]">Portal Accounts</h2>
            <form method="get" className="w-full sm:max-w-[460px]">
              <input
                name="q"
                defaultValue={q}
                aria-label="Search portal accounts"
                placeholder="Search name, email, type or application"
                className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white px-3 text-[11.5px] outline-none transition focus:border-[#1D4ED8] focus:ring-2 focus:ring-[#DBEAFE]"
              />
            </form>
          </div>
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
            <div className="px-4 py-16 text-center text-[11px] text-[#64748B]">{q ? "No portal accounts match your search." : "No portal accounts have been created yet."}</div>
          )}
        </section>
      </div>
    </AppShell>
  );
}

function Status({ value }: { value: string }) {
  return <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[8.5px] font-semibold capitalize text-slate-700">{value.replaceAll("_", " ")}</span>;
}
