import Link from "next/link";
import { AppShell } from "@/components/shell";
import { requirePospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type IntermediaryType = "posp" | "misp" | "partner";
type IntermediaryRow = {
  id: string;
  intermediary_code: string | null;
  onboarding_id: string | null;
  intermediary_type: IntermediaryType;
  requested_type: "posp" | "misp";
  display_name: string;
  mobile: string | null;
  city: string | null;
  iib_status: string;
  compliance_status: string;
  account_status: string;
  visibility_level: string;
  application_id: string | null;
  updated_at: string;
};

export async function IntermediaryRegister({ selectedType, search = "" }: { selectedType: IntermediaryType | null; search?: string }) {
  await requirePospMispManager();
  const admin = createSupabaseAdminClient();

  let request = admin
    .from("intermediaries")
    .select("id, intermediary_code, onboarding_id, intermediary_type, requested_type, display_name, mobile, city, iib_status, compliance_status, account_status, visibility_level, application_id, updated_at")
    .order("updated_at", { ascending: false })
    .limit(250);
  if (selectedType) request = request.eq("intermediary_type", selectedType);
  if (search) request = request.or(`display_name.ilike.%${search}%,mobile.ilike.%${search}%,onboarding_id.ilike.%${search}%,intermediary_code.ilike.%${search}%`);
  const { data, error } = await request.returns<IntermediaryRow[]>();
  const rows = data ?? [];

  const { data: allCounts } = await admin.from("intermediaries").select("intermediary_type, account_status").returns<Array<{ intermediary_type: IntermediaryType; account_status: string }>>();
  const count = (type: IntermediaryType) => (allCounts ?? []).filter((row) => row.intermediary_type === type).length;
  const active = (allCounts ?? []).filter((row) => row.account_status === "active").length;
  const pageTitle = selectedType === "posp" ? "POSP" : selectedType === "misp" ? "MISP" : selectedType === "partner" ? "Business Associates" : "Overview";
  const searchAction = selectedType ? `/intermediaries/${selectedType}` : "/intermediaries";

  return (
    <AppShell title={`Intermediatory - ${pageTitle}`}>
      <div className="mx-auto max-w-[1480px] space-y-4 pb-6">
        <section className="overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-[#071D49] via-[#0F2A55] to-[#163B70] px-5 py-5 text-white">
            <div><p className="text-[9px] font-bold uppercase tracking-[.14em] text-white/55">Intermediatory</p><h1 className="mt-1 text-xl font-semibold">{pageTitle}</h1></div>
            <Link href="/customers/posp-misp" className="rounded-xl bg-white px-4 py-2.5 text-[10.5px] font-bold text-[#0F2A55]">Onboarding</Link>
          </div>
          {!selectedType ? <div className="grid gap-px bg-[#E2E8F0] sm:grid-cols-2 lg:grid-cols-4"><Metric label="POSP" value={count("posp")} /><Metric label="MISP" value={count("misp")} /><Metric label="Business Associates" value={count("partner")} /><Metric label="Active" value={active} /></div> : null}
        </section>

        <form method="get" action={searchAction} className="grid gap-2 rounded-xl border border-[#DCE5EF] bg-white p-3 shadow-sm sm:grid-cols-[1fr_auto]">
          <input name="q" defaultValue={search} placeholder="Search name, mobile or onboarding ID" className="h-10 rounded-lg border border-[#CBD5E1] bg-[#F8FAFC] px-3 text-[11px] outline-none focus:border-[#635BFF]" />
          <button className="h-10 rounded-lg bg-[#0F2A55] px-4 text-[10.5px] font-semibold text-white">Search</button>
        </form>

        <section className="overflow-hidden rounded-2xl border border-[#E2E8F0] bg-white shadow-sm">
          <div className="border-b border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"><h2 className="text-[12px] font-semibold">{pageTitle} Register</h2></div>
          {error ? <div className="px-4 py-12 text-center text-[11px] text-red-700">The register could not be loaded.</div> : rows.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-[10.5px]"><thead className="border-b bg-white text-[8.5px] uppercase tracking-[.05em] text-[#64748B]"><tr><th className="px-4 py-3">Name</th>{!selectedType ? <th className="px-3 py-3">Type</th> : null}<th className="px-3 py-3">Contact</th><th className="px-3 py-3">IIB</th><th className="px-3 py-3">Compliance</th><th className="px-3 py-3">Account</th><th className="px-4 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#EEF2F6]">{rows.map((row) => <tr key={row.id} className="hover:bg-[#FAFCFF]"><td className="px-4 py-3"><p className="font-semibold text-[#0F172A]">{row.display_name}</p><p className="mt-0.5 text-[8.5px] text-[#64748B]">{row.onboarding_id ?? row.intermediary_code ?? "ID pending"}</p></td>{!selectedType ? <td className="px-3 py-3"><TypePill type={row.intermediary_type} /></td> : null}<td className="px-3 py-3"><p>{row.mobile ?? "-"}</p><p className="text-[8.5px] text-[#64748B]">{row.city ?? "-"}</p></td><td className="px-3 py-3"><Status value={row.iib_status} /></td><td className="px-3 py-3"><Status value={row.compliance_status} /></td><td className="px-3 py-3"><Status value={row.account_status} /></td><td className="px-4 py-3 text-right">{row.application_id ? <Link href={`/customers/applications/${row.application_id}`} className="rounded-lg border border-[#C7D2FE] bg-[#EEF2FF] px-3 py-1.5 text-[9px] font-semibold text-[#4338CA]">Open</Link> : <span className="text-[#94A3B8]">-</span>}</td></tr>)}</tbody></table></div> : <div className="px-4 py-16 text-center"><p className="text-[12px] font-semibold">No records found</p></div>}
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: number }) { return <div className="bg-white px-4 py-3"><p className="text-[9px] font-semibold uppercase tracking-[.06em] text-[#64748B]">{label}</p><p className="mt-1 text-xl font-semibold text-[#071D49]">{value}</p></div>; }
function TypePill({ type }: { type: IntermediaryType }) { const label = type === "partner" ? "Business Associate" : type.toUpperCase(); const style = type === "partner" ? "bg-violet-50 text-violet-700" : type === "misp" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"; return <span className={`rounded-full px-2 py-1 text-[8.5px] font-bold ${style}`}>{label}</span>; }
function Status({ value }: { value: string }) { return <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[8.5px] font-semibold capitalize text-slate-700">{value.replaceAll("_", " ")}</span>; }
