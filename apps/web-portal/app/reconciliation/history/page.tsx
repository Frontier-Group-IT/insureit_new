import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus } from "lucide-react";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { listReconciliationCycles } from "../actions";

type Relation = { name?: string | null } | Array<{ name?: string | null }> | null;
function firstName(value: Relation) { const row = Array.isArray(value) ? value[0] : value; return row?.name ?? "—"; }
function money(value: unknown) { const number = Number(value ?? 0); return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number.isFinite(number) ? number : 0); }
function varianceClass(value: unknown) { const number = Number(value ?? 0); if (!Number.isFinite(number) || Math.abs(number) <= 1) return "text-[#667085]"; return number > 0 ? "text-[#137A4A]" : "text-[#B42318]"; }

export default async function ReconciliationHistoryPage() {
  const profile = await requireCapability("view_accounts");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  const cycles = await listReconciliationCycles();
  return <AppShell title="Reconciliation History">
    <div className="mx-auto max-w-[1560px] space-y-2.5 pb-6">
      <section className="flex items-center justify-between rounded-2xl border border-[#dbe3ee] bg-white px-4 py-2.5 shadow-sm"><h1 className="text-[17px] font-semibold text-[#17365D]">Reconciliation History</h1><Link href="/reconciliation" title="New reconciliation" aria-label="New reconciliation" className="grid h-8 w-8 place-items-center rounded-lg bg-[#17365D] text-white"><Plus className="h-4 w-4" /></Link></section>
      <section className="overflow-hidden rounded-2xl border border-[#dbe3ee] bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[1040px] w-full text-[8.5px]"><thead className="bg-[#f5f7fa] text-[7px] text-[#526277]"><tr>{["Submitted","Insurer","Period","Reference","Rows","Matched","Variance rows","Projected","Actual","Variance","Status",""] .map((label)=><th key={label} className="border-b px-2.5 py-2 text-left font-bold uppercase tracking-[.04em]">{label}</th>)}</tr></thead><tbody>{cycles.length ? cycles.map((cycle) => <tr key={String(cycle.id)} className="border-b border-[#edf0f4] hover:bg-[#fbfdff]"><td className="px-2.5 py-2">{new Date(String(cycle.submitted_at)).toLocaleString("en-IN")}</td><td className="px-2.5 py-2 font-semibold text-[#26364f]">{firstName(cycle.insurance_companies as Relation)}</td><td className="px-2.5 py-2">{String(cycle.period_start)} → {String(cycle.period_end)}</td><td className="px-2.5 py-2">{String(cycle.statement_reference ?? "—")}</td><td className="px-2.5 py-2 tabular-nums">{Number(cycle.row_count ?? 0)}</td><td className="px-2.5 py-2 tabular-nums">{Number(cycle.matched_row_count ?? 0)}</td><td className="px-2.5 py-2 tabular-nums">{Number(cycle.variance_row_count ?? 0)}</td><td className="px-2.5 py-2 tabular-nums">{money(cycle.projected_total)}</td><td className="px-2.5 py-2 tabular-nums">{money(cycle.actual_total)}</td><td className={`px-2.5 py-2 font-semibold tabular-nums ${varianceClass(cycle.variance_total)}`}>{money(cycle.variance_total)}</td><td className="px-2.5 py-2"><span className="rounded-full bg-[#eef3f9] px-2 py-1 text-[7.5px] font-bold text-[#315B9A]">{String(cycle.status)}</span></td><td className="px-2.5 py-2 text-right"><Link href={`/reconciliation/${String(cycle.id)}`} className="font-bold text-[#17365D]">Review</Link></td></tr>) : <tr><td colSpan={12} className="px-4 py-10 text-center text-[#667085]">No reconciliation cycles yet.</td></tr>}</tbody></table></div></section>
    </div>
  </AppShell>;
}
