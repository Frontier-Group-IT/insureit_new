"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import type { BusinessMisClientCell } from "@/lib/accounts-business-mis-schema";

type Queue = "all" | "pending" | "partial" | "variance" | "reconciled" | "not_applicable";
type State = Exclude<Queue, "all">;

type Props = {
  rows: BusinessMisClientCell[][];
};

const QUEUES: Array<{ value: Queue; label: string }> = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "partial", label: "Partial" },
  { value: "variance", label: "Variance" },
  { value: "reconciled", label: "Reconciled" },
  { value: "not_applicable", label: "N/A" },
];

export function AccountsReconciliationWorkQueue({ rows }: Props) {
  const [queue, setQueue] = useState<Queue>("all");
  const [query, setQuery] = useState("");

  const indexed = useMemo(() => rows.map((row, index) => ({ row, index, state: reconciliationState(row) })), [rows]);
  const counts = useMemo(() => {
    const next: Record<Queue, number> = { all: indexed.length, pending: 0, partial: 0, variance: 0, reconciled: 0, not_applicable: 0 };
    for (const item of indexed) next[item.state] += 1;
    return next;
  }, [indexed]);

  const normalizedQuery = normalize(query);
  const matches = useMemo(() => indexed.filter((item) => {
    if (queue !== "all" && item.state !== queue) return false;
    if (!normalizedQuery) return true;
    return searchableText(item.row).includes(normalizedQuery);
  }), [indexed, normalizedQuery, queue]);

  return <section className="rounded-2xl border border-[#dbe3ee] bg-white px-3 py-2.5 shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="text-[11.5px] font-semibold text-[#17365D]">Reconciliation work queue</h2>
        <p className="mt-0.5 text-[7.5px] text-[#7c899b]">Search policy, registration, customer, bill / UTR reference or transaction date.</p>
      </div>
      <div className="relative w-full sm:w-[360px]">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#98a2b3]" />
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Policy / RC / customer / reference / date" className="h-8 w-full rounded-lg border border-[#dce4ee] bg-white pl-8 pr-8 text-[8.5px] font-semibold text-[#344054] outline-none transition placeholder:font-medium placeholder:text-[#98a2b3] focus:border-[#17365D]" />
        {query ? <button type="button" title="Clear search" aria-label="Clear search" onClick={() => setQuery("")} className="absolute right-1.5 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-md text-[#7c899b] hover:bg-[#f2f5f9] hover:text-[#17365D]"><X className="h-3 w-3" /></button> : null}
      </div>
    </div>

    <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-[#edf1f5] pt-2">
      {QUEUES.map((item) => <button key={item.value} type="button" onClick={() => setQueue(item.value)} className={`rounded-full border px-2.5 py-1 text-[7.5px] font-bold tabular-nums transition ${queue === item.value ? "border-[#17365D] bg-[#17365D] text-white" : queueTone(item.value)}`}>{item.label} {integer(counts[item.value])}</button>)}
      <span className="ml-auto text-[7.5px] font-semibold tabular-nums text-[#7c899b]">Showing {integer(matches.length)}</span>
    </div>

    <div className="mt-2 max-h-[260px] overflow-auto rounded-xl border border-[#e4eaf1]">
      <table className="w-full min-w-[920px] table-fixed text-left">
        <thead className="sticky top-0 z-10 bg-[#f8fafc]"><tr className="text-[7px] font-black uppercase tracking-[.04em] text-[#667085]"><th className="w-[155px] px-2 py-1.5">Policy</th><th className="w-[125px] px-2 py-1.5">Registration</th><th className="w-[190px] px-2 py-1.5">Customer</th><th className="w-[95px] px-2 py-1.5">Status</th><th className="w-[130px] px-2 py-1.5">Bill No.</th><th className="w-[112px] px-2 py-1.5">Bill Date</th><th className="w-[150px] px-2 py-1.5">UTR / Ref.</th><th className="w-[112px] px-2 py-1.5">Paid Date</th></tr></thead>
        <tbody>{matches.length ? matches.map(({ row, index, state }) => <tr key={`${index}-${String(row[12] ?? "")}`} className="border-t border-[#edf1f5] text-[8px] text-[#475467] hover:bg-[#f8fbff]"><td className="truncate px-2 py-1.5 font-semibold text-[#17365D]" title={text(row[12])}>{display(row[12])}</td><td className="truncate px-2 py-1.5" title={text(row[6])}>{display(row[6])}</td><td className="truncate px-2 py-1.5" title={text(row[7])}>{display(row[7])}</td><td className="px-2 py-1.5"><StatePill state={state} /></td><td className="truncate px-2 py-1.5" title={text(row[20])}>{display(row[20])}</td><td className="truncate px-2 py-1.5">{displayDate(row[22])}</td><td className="truncate px-2 py-1.5" title={text(row[31])}>{display(row[31])}</td><td className="truncate px-2 py-1.5">{displayDate(row[30])}</td></tr>) : <tr><td colSpan={8} className="px-4 py-9 text-center text-[8.5px] font-medium text-[#98a2b3]">No reconciliation rows match this queue and search.</td></tr>}</tbody>
      </table>
    </div>
  </section>;
}

function reconciliationState(row: BusinessMisClientCell[]): State {
  const states = [sideState(amount(row[19]), amount(row[21])), sideState(amount(row[27]), amount(row[29]))];
  if (states.includes("variance")) return "variance";
  const applicable = states.filter((state): state is Exclude<State, "not_applicable"> => state !== "not_applicable");
  if (!applicable.length) return "not_applicable";
  if (applicable.every((state) => state === "reconciled")) return "reconciled";
  if (applicable.every((state) => state === "pending")) return "pending";
  return "partial";
}

function sideState(projected: number, actual: number): State {
  if (projected <= 0.01) return actual > 0.01 ? "variance" : "not_applicable";
  if (actual > projected + 0.01) return "variance";
  if (Math.abs(actual - projected) <= 0.01) return "reconciled";
  if (actual > 0.01) return "partial";
  return "pending";
}

function searchableText(row: BusinessMisClientCell[]) { return normalize([row[12], row[6], row[7], row[20], row[31], row[22], row[30]].map(text).join(" ")); }
function StatePill({ state }: { state: State }) { const label = state === "reconciled" ? "Reconciled" : state === "not_applicable" ? "N/A" : state[0].toUpperCase() + state.slice(1); const cls = state === "reconciled" ? "bg-[#e8f5f3] text-[#0f766e]" : state === "partial" ? "bg-[#fff7e6] text-[#9a6700]" : state === "variance" ? "bg-[#fff0f0] text-[#b42318]" : "bg-[#f2f4f7] text-[#667085]"; return <span className={`inline-flex rounded-full px-2 py-0.5 text-[7px] font-bold ${cls}`}>{label}</span>; }
function queueTone(queue: Queue) { if (queue === "reconciled") return "border-[#bfe3d5] bg-[#f0faf6] text-[#0f766e] hover:bg-[#e7f6f0]"; if (queue === "partial") return "border-[#f1d7a7] bg-[#fffaf0] text-[#8a5a13] hover:bg-[#fff5df]"; if (queue === "variance") return "border-[#f3c7c3] bg-[#fff5f4] text-[#b42318] hover:bg-[#ffedeb]"; return "border-[#dce4ee] bg-[#f8fafc] text-[#667085] hover:bg-[#f2f5f9]"; }
function amount(value: BusinessMisClientCell | undefined) { const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(/,/g, "")); return Number.isFinite(parsed) ? parsed : 0; }
function normalize(value: string) { return value.toLowerCase().replace(/[^a-z0-9]/g, ""); }
function text(value: BusinessMisClientCell | undefined) { return String(value ?? "").trim(); }
function display(value: BusinessMisClientCell | undefined) { return text(value) || "—"; }
function displayDate(value: BusinessMisClientCell | undefined) { const raw = text(value); if (!raw) return "—"; const date = new Date(raw); if (Number.isNaN(date.getTime())) return raw; return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(date); }
function integer(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
