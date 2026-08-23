import Link from "next/link";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell";
import { canAccessPolicyCommercials } from "@/lib/policy-commercial-access";
import { requireCapability } from "@/lib/master-data-server";
import { listReconciliationCycles } from "../actions";

type Relation = { name?: string | null } | Array<{ name?: string | null }> | null;
type CreatorRelation = { full_name?: string | null } | Array<{ full_name?: string | null }> | null;
function firstName(value: Relation) { const row = Array.isArray(value) ? value[0] : value; return row?.name ?? "—"; }
function firstFullName(value: CreatorRelation) { const row = Array.isArray(value) ? value[0] : value; return row?.full_name ?? "—"; }
function money(value: unknown) { const number = Number(value ?? 0); return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number.isFinite(number) ? number : 0); }

export default async function ReconciliationHistoryPage() {
  const profile = await requireCapability("view_reports");
  if (!canAccessPolicyCommercials(profile)) redirect("/access-denied");
  const cycles = await listReconciliationCycles();
  return <AppShell title="Reconciliation History">
    <div className="mx-auto max-w-[1560px] space-y-4 pb-10">
      <section className="rounded-2xl border border-[#dbe3ee] bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h1 className="text-[20px] font-semibold text-[#17365D]">Reconciliation History</h1><p className="mt-1 text-[10px] text-[#667085]">Submitted insurer cycles, review progress and closed audit history.</p></div><Link href="/reconciliation" className="rounded-xl bg-[#17365D] px-4 py-2 text-[9px] font-bold text-white">New reconciliation</Link></div></section>
      <section className="overflow-hidden rounded-2xl border border-[#dbe3ee] bg-white shadow-sm"><div className="overflow-x-auto"><table className="min-w-[1100px] w-full text-[9px]"><thead className="bg-[#f5f7fa] text-[#526277]"><tr>{["Submitted","Insurer","Period","Reference","Rows","Matched","Variance rows","Projected","Actual","Variance","Status",""] .map((label)=><th key={label} className="border-b px-3 py-2 text-left font-bold uppercase tracking-[.04em]">{label}</th>)}</tr></thead><tbody>{cycles.length ? cycles.map((cycle) => <tr key={String(cycle.id)} className="border-b border-[#edf0f4] hover:bg-[#fbfdff]"><td className="px-3 py-3">{new Date(String(cycle.submitted_at)).toLocaleString("en-IN")}</td><td className="px-3 py-3 font-semibold text-[#26364f]">{firstName(cycle.insurance_companies as Relation)}</td><td className="px-3 py-3">{String(cycle.period_start)} → {String(cycle.period_end)}</td><td className="px-3 py-3">{String(cycle.statement_reference ?? "—")}</td><td className="px-3 py-3 tabular-nums">{Number(cycle.row_count ?? 0)}</td><td className="px-3 py-3 tabular-nums">{Number(cycle.matched_row_count ?? 0)}</td><td className="px-3 py-3 tabular-nums">{Number(cycle.variance_row_count ?? 0)}</td><td className="px-3 py-3 tabular-nums">{money(cycle.projected_total)}</td><td className="px-3 py-3 tabular-nums">{money(cycle.actual_total)}</td><td className="px-3 py-3 font-semibold tabular-nums">{money(cycle.variance_total)}</td><td className="px-3 py-3"><span className="rounded-full bg-[#eef3f9] px-2 py-1 font-bold text-[#315B9A]">{String(cycle.status)}</span></td><td className="px-3 py-3 text-right"><Link href={`/reconciliation/${String(cycle.id)}`} className="font-bold text-[#17365D]">Review</Link></td></tr>) : <tr><td colSpan={12} className="px-4 py-12 text-center text-[#667085]">No reconciliation cycles submitted yet.</td></tr>}</tbody></table></div><div className="border-t border-[#edf0f4] px-4 py-2 text-[8px] text-[#7a8798]">Showing latest 100 cycles · created by {firstFullName(cycles[0]?.profiles as CreatorRelation)}</div></section>
    </div>
  </AppShell>;
}
