"use client";

import Link from "next/link";
import { CalendarDays, FileText, Plus, RotateCcw, Search, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";
import {
  BrokerRegisterShell,
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
  ocr_status: string;
  ocr_fields: PolicyIntakeOcrField[];
  file_name: string;
  assigned_to_profile_id: string | null;
};

type ViewKey = "action" | "in_review" | "mine" | "processing" | "completed" | "duplicate" | "rejected" | "all";
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
function DateFilter({ label, value, min, max, onChange }: { label: string; value: string; min?: string; max?: string; onChange: (value: string) => void }) {
  return <label className="relative block h-10 min-w-[138px]">
    <span className={`pointer-events-none absolute inset-y-0 left-3 right-9 z-10 flex items-center text-[10.5px] font-semibold ${value ? "text-[#334155]" : "text-[#64748B]"}`}>{value || label}</span>
    <CalendarDays className="pointer-events-none absolute right-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[#64748B]" />
    <input type="date" value={value} min={min} max={max} aria-label={label} onChange={(event) => onChange(event.target.value)} className="absolute inset-0 h-10 w-full cursor-pointer rounded-xl border border-[#CBD5E1] bg-white text-transparent outline-none focus:border-[#17365D] focus:ring-2 focus:ring-[#17365D]/10 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:opacity-0" />
  </label>;
}

export function PolicyIntakeWorkspace({ rows, reviewer, creator, currentProfileId }: { rows: PolicyIntakeWorkspaceRow[]; reviewer: boolean; creator: boolean; currentProfileId: string }) {
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewKey>(reviewer ? "action" : "all");
  const [source, setSource] = useState("all");
  const [ocr, setOcr] = useState("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const sources = useMemo(() => Array.from(new Map(rows.map((row) => [`${row.lead_source_type}:${row.lead_source_name}`, { value: `${row.lead_source_type}:${row.lead_source_name}`, label: `${row.lead_source_name} · ${row.lead_source_type.toUpperCase()}` }])).values()).sort((a, b) => a.label.localeCompare(b.label)), [rows]);

  const baseFiltered = useMemo(() => rows.filter((row) => {
    const haystack = [row.intake_number, row.customer_mobile, row.lead_source_name, row.lead_source_type, row.lead_source_code, row.file_name, field(row, "vehicle_registration_number"), field(row, "vehicle_make"), field(row, "vehicle_model"), field(row, "policy_number"), field(row, "insurer_name")].filter(Boolean).join(" ").toLowerCase();
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

  return <BrokerRegisterShell
    title={reviewer ? "Policy Intake Queue" : "My Policy Intakes"}
    eyebrow="Operations workflow"
    description={reviewer ? "Review policy copies submitted by Sales before final policy onboarding." : "Track the policy copies you submitted to Operations."}
    icon={<ShieldCheck className="h-5 w-5" />}
    metrics={reviewer ? [
      { label: "Action required", value: stats.action, hint: "Ready / manual review", tone: "amber" },
      { label: "In review", value: stats.inReview, hint: `${stats.myActiveWork} assigned to you`, tone: "blue" },
      { label: "Processing", value: stats.processing, hint: "Fetching policy details", tone: "navy" },
      { label: "Completed", value: stats.completed, hint: "Finalized intakes", tone: "green" },
    ] : [
      { label: "Total", value: stats.all, hint: "Submitted by you", tone: "navy" },
      { label: "Processing", value: stats.processing, hint: "Fetching details", tone: "blue" },
      { label: "In review", value: stats.inReview, hint: "With Operations", tone: "amber" },
      { label: "Completed", value: stats.completed, hint: "Finalized", tone: "green" },
    ]}
  >
    <div className="border-b border-[#E5ECF5] bg-white px-3 py-2 sm:px-4">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="relative min-w-[260px] flex-1 xl:max-w-[410px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B93AA]" />
            <input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search PIR, customer, vehicle, policy, insurer or source" className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-3 text-[11px] outline-none focus:border-[#17365D] focus:ring-2 focus:ring-[#17365D]/10" />
          </label>
          <RegisterSelect value={source} onChange={(value) => { setSource(value); setPage(1); }} label="Lead source"><option value="all">All lead sources</option>{sources.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</RegisterSelect>
          <RegisterSelect value={ocr} onChange={(value) => { setOcr(value); setPage(1); }} label="OCR status"><option value="all">All detail states</option><option value="queued">Queued</option><option value="processing">Fetching</option><option value="completed">Fetched</option><option value="failed">Manual review</option></RegisterSelect>
          <DateFilter label="From date" value={fromDate} max={toDate || undefined} onChange={(value) => { setFromDate(value); setPage(1); }} />
          <DateFilter label="To date" value={toDate} min={fromDate || undefined} onChange={(value) => { setToDate(value); setPage(1); }} />
          <button type="button" onClick={reset} aria-label="Reset filters" title="Reset filters" className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#CBD5E1] bg-white text-[#475569] hover:bg-[#F8FAFC]"><RotateCcw className="h-4 w-4" /></button>
        </div>
        {creator ? <Link href="/policy-intakes/new" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#17365D] px-3 text-[10px] font-bold text-white shadow-[0_10px_24px_rgba(23,54,93,.18)]"><Plus className="h-4 w-4" />New Intake</Link> : null}
      </div>
    </div>

    <div className="border-b border-[#E5ECF5] bg-[#FBFCFE] px-3 py-2 sm:px-4">
      <div className="flex flex-col gap-2 xl:flex-row xl:items-center xl:justify-between">
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
        {reviewer ? <button
          type="button"
          onClick={() => changeView("mine")}
          aria-pressed={view === "mine"}
          className={`inline-flex h-8 shrink-0 items-center justify-center rounded-lg border px-3 text-[10px] font-bold transition ${view === "mine" ? "border-[#17365D] bg-[#17365D] text-white shadow-sm" : "border-[#C9D5E3] bg-white text-[#526178] hover:border-[#9FB4CD] hover:bg-[#F8FAFC]"}`}
          title="Show only policy intakes currently assigned to you"
        >
          My Active Work <span className="ml-1.5 opacity-80">{stats.myActiveWork}</span>
        </button> : null}
      </div>
    </div>

    <div className="p-3 md:hidden">{pageRows.map((row) => <Link key={row.id} href={`/policy-intakes/${row.id}`} className={`mb-2 block rounded-xl border border-[#E2E8F0] p-3 ${rowTones[row.status] ?? "bg-white"}`}><div className="flex items-start justify-between gap-2"><div><p className="text-[10px] font-bold text-[#17365D]">{row.intake_number}</p><p className="mt-1 text-[9px] text-[#475569]">{field(row, "vehicle_registration_number") || row.customer_mobile}</p></div><RegisterStatusPill tone={statusTone(row)}>{statusLabel(row)}</RegisterStatusPill></div><div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[8.5px] text-[#64748B]"><p><span className="font-semibold text-[#334155]">Source:</span> {row.lead_source_name}</p><p><span className="font-semibold text-[#334155]">OCR:</span> {ocrLabel(row.ocr_status)}</p><p className="col-span-2"><span className="font-semibold text-[#334155]">Submitted:</span> {formatDateTime(row.created_at)}</p></div></Link>)}{!pageRows.length ? <RegisterEmpty title="No matching policy intakes" description="Adjust the filters or status view." /> : null}</div>

    <div className="hidden overflow-x-auto md:block">
      <table className="w-full min-w-[1220px] table-fixed text-left text-[10px] text-[#334155]">
        <thead className="sticky top-0 z-10 border-b border-[#E2E8F0] bg-[#F8FAFC] text-[8.5px] font-bold uppercase tracking-[.06em] text-[#64748B]"><tr><th className="w-[142px] px-3 py-2">Intake</th><th className="w-[160px] px-2.5 py-2">Customer</th><th className="w-[190px] px-2.5 py-2">Lead Source</th><th className="w-[170px] px-2.5 py-2">Vehicle</th><th className="w-[220px] px-2.5 py-2">Policy / Insurer</th><th className="w-[150px] px-2.5 py-2">Submitted</th><th className="w-[118px] px-2.5 py-2">OCR</th><th className="w-[160px] px-2.5 py-2">Status</th></tr></thead>
        <tbody className="divide-y divide-[#E8EDF4]">{pageRows.map((row) => <tr key={row.id} className={`h-[58px] transition ${rowTones[row.status] ?? "hover:bg-[#FAFCFF]"}`} onClick={() => { window.location.href = `/policy-intakes/${row.id}`; }} style={{ cursor: "pointer" }}>
          <td className="px-3"><p className="font-bold text-[#17365D]">{row.intake_number}</p><p className="mt-0.5 truncate text-[8px] text-[#7A8798]">{row.file_name}</p></td>
          <td className="px-2.5"><p className="font-semibold text-[#334155]">{field(row, "insured_name") || row.customer_mobile}</p>{field(row, "insured_name") ? <p className="mt-0.5 text-[8px] text-[#7A8798]">{row.customer_mobile}</p> : null}</td>
          <td className="px-2.5"><p className="truncate font-semibold">{row.lead_source_name}</p><p className="mt-0.5 text-[8px] text-[#7A8798]">{row.lead_source_type.toUpperCase()}{row.lead_source_code ? ` · ${row.lead_source_code}` : ""}</p></td>
          <td className="px-2.5"><p className="font-mono font-semibold">{field(row, "vehicle_registration_number") || (row.ocr_status === "completed" ? "—" : "Fetching…")}</p><p className="mt-0.5 truncate text-[8px] text-[#7A8798]">{[field(row, "vehicle_make"), field(row, "vehicle_model")].filter(Boolean).join(" · ") || field(row, "vehicle_class") || ""}</p></td>
          <td className="px-2.5"><p className="truncate font-semibold">{field(row, "policy_number") || (row.ocr_status === "completed" ? "—" : "Fetching…")}</p><p className="mt-0.5 truncate text-[8px] text-[#7A8798]">{field(row, "insurer_name")}</p></td>
          <td className="px-2.5 text-[9px] text-[#475569]">{formatDateTime(row.created_at)}</td>
          <td className="px-2.5"><RegisterStatusPill tone={ocrTone(row.ocr_status)}>{ocrLabel(row.ocr_status)}</RegisterStatusPill></td>
          <td className="px-2.5"><RegisterStatusPill tone={statusTone(row)}>{statusLabel(row)}</RegisterStatusPill></td>
        </tr>)}</tbody>
      </table>
      {!pageRows.length ? <RegisterEmpty title="No matching policy intakes" description="Adjust the search, lead source, OCR state, date range or status view." /> : null}
    </div>
    <RegisterPagination pageRows={pageRows.length} filteredRows={filtered.length} safePage={safePage} totalPages={totalPages} pageSize={PAGE_SIZE} onPrevious={() => setPage(Math.max(1, safePage - 1))} onNext={() => setPage(Math.min(totalPages, safePage + 1))} />
  </BrokerRegisterShell>;
}