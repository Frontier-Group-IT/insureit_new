"use client";

import Link from "next/link";
import { CalendarDays, ChevronDown, FileText, Plus, RotateCcw, Search } from "lucide-react";
import { useMemo, useState } from "react";
import {
  RegisterEmpty,
  RegisterPagination,
  RegisterSelect,
  RegisterStatusPill,
  RegisterViewTabs,
} from "@/components/broker-register";
import type { PolicyIntakeOcrField } from "@/app/policy-intakes/ocr-actions";

export type PolicyIntakeWorkspaceRow = {
  id: string;
  intake_number: string;
  status: string;
  lead_source_name: string;
  lead_source_type: string;
  lead_source_code: string | null;
  customer_mobile: string;
  created_at: string;
  submitted_by_name: string;
  ocr_status: string;
  ocr_fields: PolicyIntakeOcrField[];
  file_name: string;
  assigned_to_profile_id: string | null;
};

export type PolicyIntakeViewKey = "action" | "in_review" | "mine" | "processing" | "completed" | "duplicate" | "rejected" | "all";
type ViewKey = PolicyIntakeViewKey;
const PAGE_SIZE = 15;

const rowTones: Record<string, string> = {
  processing: "bg-blue-50/55 hover:bg-blue-50/85",
  ready_for_review: "bg-indigo-50/55 hover:bg-indigo-50/85",
  in_review: "bg-violet-50/55 hover:bg-violet-50/85",
  needs_attention: "bg-amber-50/60 hover:bg-amber-50/90",
  completed: "bg-emerald-50/45 hover:bg-emerald-50/75",
  rejected: "bg-rose-50/50 hover:bg-rose-50/80",
};

function field(row: PolicyIntakeWorkspaceRow, key: string) {
  return row.ocr_fields?.find((item) => item.key === key)?.value?.trim() ?? "";
}
function isDuplicate(row: PolicyIntakeWorkspaceRow) {
  return row.status.toLowerCase() === "duplicate";
}
function statusLabel(row: PolicyIntakeWorkspaceRow) {
  if (row.status === "processing" && row.ocr_status === "failed") return "Manual review required";
  return ({
    processing: "Fetching details",
    ready_for_review: "Ready for review",
    in_review: "In review",
    needs_attention: "Needs attention",
    completed: "Completed",
    rejected: "Rejected",
  } as Record<string, string>)[row.status] ?? row.status;
}
function statusTone(row: PolicyIntakeWorkspaceRow): "navy" | "green" | "amber" | "red" | "blue" | "slate" {
  if (row.status === "processing" && row.ocr_status === "failed") return "amber";
  if (row.status === "completed") return "green";
  if (row.status === "rejected") return "red";
  if (row.status === "needs_attention") return "amber";
  if (row.status === "processing") return "blue";
  if (row.status === "ready_for_review" || row.status === "in_review") return "navy";
  return "slate";
}
function ocrLabel(status: string) {
  if (status === "completed") return "Fetched";
  if (status === "failed") return "Manual review";
  if (status === "processing") return "Fetching";
  return "Queued";
}
function ocrTone(status: string): "navy" | "green" | "amber" | "red" | "blue" | "slate" {
  if (status === "completed") return "green";
  if (status === "failed") return "amber";
  if (status === "processing") return "blue";
  return "slate";
}
function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("en-IN", { day: "2-digit", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}
function dateValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}
function shortFilterDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("en-IN", { day: "2-digit", month: "short" });
}
function PolicyIntakeDateRangeFilter({
  fromDate,
  toDate,
  onFromDateChange,
  onToDateChange,
  onClear,
}: {
  fromDate: string;
  toDate: string;
  onFromDateChange: (value: string) => void;
  onToDateChange: (value: string) => void;
  onClear: () => void;
}) {
  const label = fromDate || toDate
    ? `${fromDate ? shortFilterDate(fromDate) : "Any"} – ${toDate ? shortFilterDate(toDate) : "Any"}`
    : "Date Range";
  return <details className="group relative w-full">
    <summary className="flex h-10 w-full min-w-0 cursor-pointer list-none items-center justify-between gap-2 rounded-xl border border-[#CBD5E1] bg-white px-3 text-[10.5px] font-semibold text-[#334155] outline-none transition hover:border-[#9FB2C8] focus-visible:ring-2 focus-visible:ring-[#17365D]/10 xl:h-9 xl:gap-1.5 xl:px-2.5 xl:text-[10px] [&::-webkit-details-marker]:hidden">
      <span className="flex min-w-0 items-center gap-2"><CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#64748B]" /><span className="truncate">{label}</span></span>
      <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#64748B] transition group-open:rotate-180" />
    </summary>
    <div className="absolute right-0 top-11 z-30 w-[292px] rounded-xl border border-[#D7E0EA] bg-white p-3 shadow-[0_18px_45px_rgba(15,23,42,.16)]">
      <div className="grid grid-cols-2 gap-2">
        <label><span className="mb-1 block text-[8px] font-bold text-[#7C899B]">From date</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => onFromDateChange(event.target.value)} className="h-9 w-full rounded-lg border border-[#D7E0EA] px-2 text-[9.5px] font-semibold text-[#334155] outline-none focus:border-[#17365D]" /></label>
        <label><span className="mb-1 block text-[8px] font-bold text-[#7C899B]">To date</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => onToDateChange(event.target.value)} className="h-9 w-full rounded-lg border border-[#D7E0EA] px-2 text-[9.5px] font-semibold text-[#334155] outline-none focus:border-[#17365D]" /></label>
      </div>
      <div className="mt-2 flex justify-end"><button type="button" onClick={onClear} className="rounded-lg px-2.5 py-1.5 text-[9px] font-bold text-[#64748B] hover:bg-[#F8FAFC]">Clear dates</button></div>
    </div>
  </details>;
}

export function PolicyIntakeWorkspace({ rows, reviewer, creator, currentProfileId, initialView }: { rows: PolicyIntakeWorkspaceRow[]; reviewer: boolean; creator: boolean; currentProfileId: string; initialView?: PolicyIntakeViewKey }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>(initialView ?? (reviewer ? "action" : "all"));
  const [source, setSource] = useState("all");
  const [ocr, setOcr] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const sources = useMemo(() => Array.from(new Map(rows.map((row) => [`${row.lead_source_type}:${row.lead_source_name}`, { value: `${row.lead_source_type}:${row.lead_source_name}`, label: `${row.lead_source_name} · ${row.lead_source_type.toUpperCase()}` }])).values()).sort((a, b) => a.label.localeCompare(b.label)), [rows]);

  const baseFiltered = useMemo(() => rows.filter((row) => {
    const haystack = [row.intake_number, row.customer_mobile, row.lead_source_name, row.lead_source_type, row.lead_source_code, row.file_name, row.submitted_by_name, field(row, "vehicle_registration_number"), field(row, "vehicle_make"), field(row, "vehicle_model"), field(row, "policy_number"), field(row, "insurer_name")].filter(Boolean).join(" ").toLowerCase();
    const sourceKey = `${row.lead_source_type}:${row.lead_source_name}`;
    const created = dateValue(row.created_at);
    return (!query.trim() || haystack.includes(query.trim().toLowerCase())) && (source === "all" || sourceKey === source) && (ocr === "all" || row.ocr_status === ocr) && (!fromDate || created >= fromDate) && (!toDate || created <= toDate);
  }), [rows, query, source, ocr, fromDate, toDate]);

  const stats = useMemo(() => ({
    all: baseFiltered.length,
    action: baseFiltered.filter((row) => row.status === "ready_for_review" || (row.status === "processing" && row.ocr_status === "failed")).length,
    inReview: baseFiltered.filter((row) => row.status === "in_review").length,
    myActiveWork: baseFiltered.filter((row) => row.status === "in_review" && row.assigned_to_profile_id === currentProfileId).length,
    processing: baseFiltered.filter((row) => row.status === "processing" && row.ocr_status !== "failed").length,
    completed: baseFiltered.filter((row) => row.status === "completed").length,
    duplicate: baseFiltered.filter(isDuplicate).length,
    rejected: baseFiltered.filter((row) => row.status === "rejected").length,
  }), [baseFiltered, currentProfileId]);

  const filtered = useMemo(() => baseFiltered.filter((row) => {
    if (view === "all") return true;
    if (view === "action") return row.status === "ready_for_review" || (row.status === "processing" && row.ocr_status === "failed");
    if (view === "in_review") return row.status === "in_review";
    if (view === "mine") return row.status === "in_review" && row.assigned_to_profile_id === currentProfileId;
    if (view === "processing") return row.status === "processing" && row.ocr_status !== "failed";
    if (view === "duplicate") return isDuplicate(row);
    return row.status === view;
  }), [baseFiltered, view]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  function reset() { setQuery(""); setSource("all"); setOcr("all"); setFromDate(""); setToDate(""); setView(reviewer ? "action" : "all"); setPage(1); }
  function changeView(value: string) { setView(value as ViewKey); setPage(1); }

  return <section className="mx-auto max-w-[1480px] overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
    <div className="border-b border-[#E5ECF5] bg-[#F8FAFC] px-4 py-3 sm:px-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#17365D] text-white shadow-[0_10px_22px_rgba(23,54,93,0.18)]"><FileText className="h-5 w-5" /></span>
          <h2 className="shrink-0 text-[18px] font-semibold leading-tight text-[#0F172A]">{reviewer ? "Policy Intake Queue" : "My Policy Intakes"}</h2>
          <label className="relative ml-1 min-w-0 flex-1 lg:max-w-[430px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B93AA]" />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search PIR, customer, vehicle, policy, insurer or source" aria-label="Search PIR, customer, vehicle, policy, insurer or source" className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-3 text-[12px] text-[#0F172A] outline-none transition focus:border-[#17365D] focus:ring-2 focus:ring-[#17365D]/10" />
          </label>
          <button type="button" onClick={reset} aria-label="Reset filters" title="Reset filters" className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#CBD5E1] bg-white text-[#475569] transition hover:border-[#9FB2C8] hover:bg-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-[#17365D]/10"><RotateCcw className="h-4 w-4" /></button>
        </div>
        {creator ? <Link prefetch={false} href="/policy-intakes/new" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-3 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.22)]"><Plus className="h-4 w-4" />New Intake</Link> : null}
      </div>
    </div>

    <div className="border-b border-[#E5ECF5] bg-white px-3 py-2 sm:px-4">
      <div className="flex flex-col gap-2 xl:grid xl:grid-cols-[160px_160px_140px_minmax(0,1fr)] xl:items-center xl:gap-1.5">
        <div className="[&>label]:block [&>label]:w-full [&_select]:w-full xl:[&_select]:!h-9 xl:[&_select]:!min-w-0 xl:[&_select]:!pl-8 xl:[&_select]:!pr-6 xl:[&_select]:!text-[10px]">
          <RegisterSelect value={source} onChange={(value) => { setSource(value); setPage(1); }} label="Lead source"><option value="all">All Lead Source</option>{sources.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</RegisterSelect>
        </div>
        <div className="[&>label]:block [&>label]:w-full [&_select]:w-full xl:[&_select]:!h-9 xl:[&_select]:!min-w-0 xl:[&_select]:!pl-8 xl:[&_select]:!pr-6 xl:[&_select]:!text-[10px]">
          <RegisterSelect value={ocr} onChange={(value) => { setOcr(value); setPage(1); }} label="OCR status"><option value="all">All Detail Status</option><option value="queued">Queued</option><option value="processing">Fetching</option><option value="completed">Fetched</option><option value="failed">Manual review</option></RegisterSelect>
        </div>
        <PolicyIntakeDateRangeFilter fromDate={fromDate} toDate={toDate} onFromDateChange={(value) => { setFromDate(value); setPage(1); }} onToDateChange={(value) => { setToDate(value); setPage(1); }} onClear={() => { setFromDate(""); setToDate(""); setPage(1); }} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center justify-between gap-1">
            <div className="min-w-0 flex-1 [&>div]:w-full xl:[&>div]:!w-full xl:[&>div]:!gap-0.5 xl:[&>div]:!overflow-visible xl:[&>div]:!p-0.5 xl:[&>div>button]:!h-7 xl:[&>div>button]:!min-w-0 xl:[&>div>button]:!flex-1 xl:[&>div>button]:!px-1.5 xl:[&>div>button]:!text-[9px]">
              <RegisterViewTabs value={view === "mine" ? "" : view} onChange={changeView} options={reviewer ? [
                { value: "action", label: "Action Required", count: stats.action },
                { value: "in_review", label: "In Review", count: stats.inReview },
                { value: "processing", label: "Processing", count: stats.processing },
                { value: "completed", label: "Completed", count: stats.completed },
                { value: "duplicate", label: "Duplicate", count: stats.duplicate },
                { value: "rejected", label: "Rejected", count: stats.rejected },
                { value: "all", label: "All", count: stats.all },
              ] : [
                { value: "all", label: "All", count: stats.all },
                { value: "processing", label: "Processing", count: stats.processing },
                { value: "in_review", label: "In Review", count: stats.inReview },
                { value: "completed", label: "Completed", count: stats.completed },
                { value: "duplicate", label: "Duplicate", count: stats.duplicate },
                { value: "rejected", label: "Rejected", count: stats.rejected },
              ]} />
            </div>
            {reviewer ? <button type="button" onClick={() => changeView("mine")} aria-pressed={view === "mine"} className={`inline-flex h-8 shrink-0 items-center justify-center rounded-lg border px-3 text-[10px] font-bold transition xl:h-7 xl:px-2 xl:text-[9px] ${view === "mine" ? "border-[#17365D] bg-[#17365D] text-white shadow-sm" : "border-[#C9D5E3] bg-white text-[#526178] hover:border-[#9FB4CD] hover:bg-[#F8FAFC]"}`} title="Show only policy intakes currently assigned to you">My Active Work <span className="ml-1.5 opacity-80">{stats.myActiveWork}</span></button> : null}
          </div>
        </div>
      </div>
    </div>

    <div className="p-3 md:hidden">{pageRows.map((row) => <Link key={row.id} href={`/policy-intakes/${row.id}`} className={`mb-2 block rounded-xl border border-[#E2E8F0] p-3 ${rowTones[row.status] ?? "bg-white"}`}><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold text-[#17365D]">{row.intake_number}</p><p className="mt-1 text-[9px] text-[#475569]">{field(row, "vehicle_registration_number") || row.customer_mobile}</p></div><RegisterStatusPill tone={statusTone(row)}>{statusLabel(row)}</RegisterStatusPill></div><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[8.5px] text-[#64748B]"><p><span className="font-semibold text-[#334155]">Source:</span> {row.lead_source_name}</p><p><span className="font-semibold text-[#334155]">OCR:</span> {ocrLabel(row.ocr_status)}</p><p className="col-span-2"><span className="font-semibold text-[#334155]">Submitted by:</span> <span className="font-semibold text-[#334155]">{row.submitted_by_name}</span> · {formatDateTime(row.created_at)}</p></div></Link>)}{!pageRows.length ? <RegisterEmpty title="No matching policy intakes" description="Adjust the filters or status view." /> : null}</div>

    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[1240px] table-fixed text-left text-[10px] text-[#334155]">
        <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[8.5px] font-bold uppercase tracking-[.06em] text-[#64748B]"><tr><th className="w-[142px] px-3 py-2">Intake</th><th className="w-[160px] px-2.5 py-2">Customer</th><th className="w-[190px] px-2.5 py-2">Lead Source</th><th className="w-[170px] px-2.5 py-2">Vehicle</th><th className="w-[220px] px-2.5 py-2">Policy / Insurer</th><th className="w-[170px] px-2.5 py-2">Submitted</th><th className="w-[118px] px-2.5 py-2">OCR</th><th className="w-[160px] px-2.5 py-2">Status</th></tr></thead>
        <tbody className="divide-y divide-[#E8EDF4]">{pageRows.map((row) => <tr key={row.id} className={`h-[58px] transition ${rowTones[row.status] ?? "hover:bg-[#FAFCFF]"}`} onClick={() => { window.location.href = `/policy-intakes/${row.id}`; }} style={{ cursor: "pointer" }}>
          <td className="px-3"><p className="font-bold text-[#17365D]">{row.intake_number}</p><p className="mt-0.5 truncate text-[8px] text-[#7A8798]">{row.file_name}</p></td>
          <td className="px-2.5"><p className="font-semibold text-[#334155]">{field(row, "insured_name") || row.customer_mobile}</p>{field(row, "insured_name") ? <p className="mt-0.5 text-[8px] text-[#7A8798]">{row.customer_mobile}</p> : null}</td>
          <td className="px-2.5"><p className="truncate font-semibold">{row.lead_source_name}</p><p className="mt-0.5 text-[8px] text-[#7A8798]">{row.lead_source_type.toUpperCase()}{row.lead_source_code ? ` · ${row.lead_source_code}` : ""}</p></td>
          <td className="px-2.5"><p className="font-mono font-semibold">{field(row, "vehicle_registration_number") || (row.ocr_status === "completed" ? "—" : "Fetching…")}</p><p className="mt-0.5 truncate text-[8px] text-[#7A8798]">{[field(row, "vehicle_make"), field(row, "vehicle_model")].filter(Boolean).join(" · ") || field(row, "vehicle_class") || ""}</p></td>
          <td className="px-2.5"><p className="truncate font-semibold">{field(row, "policy_number") || (row.ocr_status === "completed" ? "—" : "Fetching…")}</p><p className="mt-0.5 truncate text-[8px] text-[#7A8798]">{field(row, "insurer_name")}</p></td>
          <td className="px-2.5"><p className="font-semibold leading-4 text-[#334155]">{row.submitted_by_name}</p><p className="mt-0.5 text-[8px] text-[#7A8798]">{formatDateTime(row.created_at)}</p></td>
          <td className="px-2.5"><RegisterStatusPill tone={ocrTone(row.ocr_status)}>{ocrLabel(row.ocr_status)}</RegisterStatusPill></td>
          <td className="px-2.5"><RegisterStatusPill tone={statusTone(row)}>{statusLabel(row)}</RegisterStatusPill></td>
        </tr>)}</tbody>
      </table>
      {!pageRows.length ? <RegisterEmpty title="No matching policy intakes" description="Adjust the search, lead source, OCR state, date range or status view." /> : null}
    </div>
    <RegisterPagination pageRows={pageRows.length} filteredRows={filtered.length} safePage={safePage} totalPages={totalPages} pageSize={PAGE_SIZE} onPrevious={() => setPage(Math.max(1, safePage - 1))} onNext={() => setPage(Math.min(totalPages, safePage + 1))} />
  </section>;
}
