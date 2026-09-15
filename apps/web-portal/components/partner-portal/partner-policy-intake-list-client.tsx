"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  FileText,
  RefreshCw,
  Search,
} from "lucide-react";
import { getPartnerPolicyIntakesWeb, type PartnerPolicyIntake } from "@/lib/partner-policy-intakes-client";

type IntakeFilter = "all" | "attention" | "in_review" | "processing" | "completed" | "duplicate" | "rejected";
const PAGE_SIZE = 25;

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(row: PartnerPolicyIntake) {
  if (row.status === "processing" && row.ocr_status === "failed") return "Manual review";
  const labels: Record<string, string> = {
    processing: "Processing",
    ready_for_review: "Ready",
    in_review: "In Review",
    needs_attention: "Action Required",
    completed: "Completed",
    duplicate: "Duplicate",
    rejected: "Rejected",
  };
  return labels[row.status] || humanize(row.status);
}

function statusTone(row: PartnerPolicyIntake) {
  if (row.status === "completed") return "border-[#A9E8C9] bg-[#EAFBF2] text-[#10895A]";
  if (row.status === "rejected") return "border-[#FFC4C4] bg-[#FFF0F0] text-[#C83A3A]";
  if (row.status === "needs_attention") return "border-[#F1CF86] bg-[#FFF8E8] text-[#B96E00]";
  if (["processing", "ready_for_review", "in_review"].includes(row.status)) {
    return "border-[#BDD8FF] bg-[#EDF5FF] text-[#1E69C7]";
  }
  return "border-[#DCE4EE] bg-[#F5F7FA] text-[#52657E]";
}

function ocrLabel(row: PartnerPolicyIntake) {
  const value = row.ocr_status?.toLowerCase();
  if (["completed", "fetched", "success"].includes(value)) return "Fetched";
  if (value === "failed") return "Manual review";
  if (value === "processing" || value === "pending") return "Processing";
  return value ? humanize(value) : "Pending";
}

function ocrTone(row: PartnerPolicyIntake) {
  const value = row.ocr_status?.toLowerCase();
  if (["completed", "fetched", "success"].includes(value)) return "border-[#A9E8C9] bg-[#EAFBF2] text-[#10895A]";
  if (value === "failed") return "border-[#F1CF86] bg-[#FFF8E8] text-[#B96E00]";
  return "border-[#BDD8FF] bg-[#EDF5FF] text-[#1E69C7]";
}

function dateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, time: "" };
  return {
    date: new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function field(row: PartnerPolicyIntake, ...keys: string[]) {
  for (const key of keys) {
    const value = row.ocr_fields?.find((item) => item.key === key)?.value?.trim();
    if (value) return value;
  }
  return "";
}

function matchesSearch(row: PartnerPolicyIntake, query: string) {
  if (!query) return true;
  return [
    row.intake_number,
    row.customer_mobile,
    row.status,
    statusLabel(row),
    ocrLabel(row),
    field(row, "customer_name", "insured_name", "policy_holder_name"),
    field(row, "policy_number"),
    field(row, "vehicle_registration_number", "registration_number"),
    field(row, "insurer_name", "insurance_company", "insurer"),
  ].some((value) => value?.toLowerCase().includes(query));
}

function matchesFilter(row: PartnerPolicyIntake, filter: IntakeFilter) {
  if (filter === "all") return true;
  if (filter === "attention") return row.status === "needs_attention";
  if (filter === "in_review") return row.status === "in_review" || row.status === "ready_for_review";
  if (filter === "processing") return row.status === "processing";
  if (filter === "completed") return row.status === "completed";
  if (filter === "duplicate") return row.status === "duplicate";
  if (filter === "rejected") return row.status === "rejected";
  return true;
}

function serverFilterFor(filter: IntakeFilter): "all" | "attention" | "in_progress" | "completed" {
  if (filter === "attention") return "attention";
  if (filter === "completed") return "completed";
  if (filter === "in_review" || filter === "processing") return "in_progress";
  return "all";
}

async function loadCompleteDataset(filter: "all" | "in_progress") {
  const rows: PartnerPolicyIntake[] = [];
  let offset = 0;
  let expectedTotal = 0;
  do {
    const result = await getPartnerPolicyIntakesWeb({ limit: PAGE_SIZE, offset, filter });
    if (offset === 0) expectedTotal = result.total;
    rows.push(...result.intakes);
    offset += PAGE_SIZE;
    if (!result.intakes.length) break;
  } while (rows.length < expectedTotal);
  return rows;
}

export function PartnerPolicyIntakeListClient() {
  const [rows, setRows] = useState<PartnerPolicyIntake[]>([]);
  const [filter, setFilter] = useState<IntakeFilter>("attention");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ attention: 0, inReview: 0, processing: 0, completed: 0, duplicate: 0, rejected: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = search.trim().toLowerCase();
      const needsExactDataset = Boolean(query) || ["in_review", "processing", "duplicate", "rejected"].includes(filter);

      const [allRows, pageResult] = await Promise.all([
        loadCompleteDataset("all"),
        needsExactDataset
          ? Promise.resolve(null)
          : getPartnerPolicyIntakesWeb({
              limit: PAGE_SIZE,
              offset: (page - 1) * PAGE_SIZE,
              filter: serverFilterFor(filter),
            }),
      ]);

      setCounts({
        attention: allRows.filter((row) => row.status === "needs_attention").length,
        inReview: allRows.filter((row) => row.status === "in_review" || row.status === "ready_for_review").length,
        processing: allRows.filter((row) => row.status === "processing").length,
        completed: allRows.filter((row) => row.status === "completed").length,
        duplicate: allRows.filter((row) => row.status === "duplicate").length,
        rejected: allRows.filter((row) => row.status === "rejected").length,
        all: allRows.length,
      });

      if (pageResult) {
        setRows(pageResult.intakes);
        setTotal(pageResult.total);
      } else {
        const sourceRows = filter === "in_review" || filter === "processing" ? await loadCompleteDataset("in_progress") : allRows;
        const matches = sourceRows.filter((row) => matchesFilter(row, filter) && matchesSearch(row, query));
        const start = (page - 1) * PAGE_SIZE;
        setRows(matches.slice(start, start + PAGE_SIZE));
        setTotal(matches.length);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Policy Intakes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filter, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);
  const hasPrevious = page > 1;
  const hasNext = page * PAGE_SIZE < total;

  const filterTabs: Array<{ key: IntakeFilter; label: string; count: number }> = [
    { key: "attention", label: "Action Required", count: counts.attention },
    { key: "in_review", label: "In Review", count: counts.inReview },
    { key: "processing", label: "Processing", count: counts.processing },
    { key: "completed", label: "Completed", count: counts.completed },
    { key: "duplicate", label: "Duplicate", count: counts.duplicate },
    { key: "rejected", label: "Rejected", count: counts.rejected },
    { key: "all", label: "All", count: counts.all },
  ];

  return (
    <div className="pb-4">
      <section className="overflow-hidden rounded-2xl border border-[#DCE6F1] bg-white shadow-[0_10px_30px_rgba(31,61,107,0.06)]">
        <div className="flex min-w-0 items-center gap-3 border-b border-[#E3EAF3] px-4 py-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0B376D] text-white shadow-sm"><FileText className="h-5 w-5" /></span>
          <h2 className="shrink-0 text-[15px] font-extrabold tracking-[-0.02em] text-[#142642]">Policy Intake Register</h2>
          <div className="relative min-w-0 flex-1 xl:max-w-[520px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8CA4]" />
            <input
              value={search}
              onChange={(event) => { setSearch(event.target.value); setPage(1); }}
              placeholder="Search PIR, customer, vehicle, policy, insurer or status"
              className="h-11 w-full rounded-xl border border-[#D3DDE9] bg-white pl-10 pr-3 text-[10.5px] font-semibold text-[#213653] outline-none transition placeholder:text-[#9AA9BB] focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10"
            />
          </div>
          <button type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh policy intakes" className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#D3DDE9] bg-white text-[#365170] transition hover:bg-[#F8FAFD] disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="flex min-w-0 items-center gap-2 border-b border-[#E3EAF3] bg-white px-4 py-2.5">
          <label className="relative shrink-0">
            <span className="sr-only">Detail status filter</span>
            <select value={filter} onChange={(event) => { setFilter(event.target.value as IntakeFilter); setPage(1); }} className="h-10 min-w-[165px] cursor-pointer rounded-xl border border-[#D3DDE9] bg-white px-3 text-[10px] font-bold text-[#2D4666] outline-none">
              <option value="all">All Detail Status</option>
              <option value="attention">Action Required</option>
              <option value="in_review">In Review</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="duplicate">Duplicate</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>
          <button type="button" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#D3DDE9] bg-white px-3.5 text-[10px] font-bold text-[#2D4666]"><CalendarDays className="h-3.5 w-3.5 text-[#5A7494]" />Date Range<ChevronDown className="h-3.5 w-3.5 text-[#5A7494]" /></button>
          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-xl border border-[#DDE5EF] bg-white p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filterTabs.map((tab) => {
              const active = filter === tab.key;
              return <button key={tab.key} type="button" onClick={() => { setFilter(tab.key); setPage(1); }} className={`shrink-0 rounded-lg px-3 py-2 text-[9px] font-bold transition ${active ? "bg-[#123F73] text-white shadow-sm" : "text-[#60728C] hover:bg-[#F4F7FB] hover:text-[#203653]"}`}>{tab.label} {tab.count}</button>;
            })}
          </div>
          <button type="button" className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#D3DDE9] bg-white px-3.5 text-[9px] font-bold text-[#2D4666]">My Active Work 0<ChevronDown className="h-3.5 w-3.5 text-[#5A7494]" /></button>
        </div>

        {error ? <div className="border-b border-[#F1D5D5] bg-[#FFF7F7] px-5 py-3 text-[10.5px] font-semibold text-[#A33B3B]">{error}</div> : null}

        <div className="overflow-x-auto">
          <div className="min-w-[1120px]">
            <div className="grid grid-cols-[minmax(150px,.78fr)_minmax(170px,.9fr)_minmax(150px,.8fr)_minmax(230px,1.2fr)_minmax(150px,.8fr)_minmax(110px,.58fr)_minmax(110px,.58fr)_34px] items-center gap-4 border-b border-[#E3EAF3] bg-[#F7F9FC] px-4 py-2.5 text-[8px] font-black uppercase tracking-[0.055em] text-[#6D809A]">
              <span>Intake #</span><span>Customer</span><span>Vehicle</span><span>Policy / Insurer</span><span>Submitted</span><span>OCR</span><span>Status</span><span className="text-right">Action</span>
            </div>
            {loading && !rows.length ? (
              <div className="py-16 text-center"><RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#7F90A8]" /><p className="mt-3 text-[11px] font-semibold text-[#667A98]">Loading policy intakes…</p></div>
            ) : rows.length ? (
              <div className="divide-y divide-[#E7ECF3]">
                {rows.map((row) => {
                  const created = dateParts(row.created_at);
                  const customerName = field(row, "customer_name", "insured_name", "policy_holder_name");
                  const vehicle = field(row, "vehicle_registration_number", "registration_number") || "Vehicle pending";
                  const vehicleMeta = [field(row, "vehicle_make", "make"), field(row, "vehicle_model", "model")].filter(Boolean).join(" · ");
                  const policy = field(row, "policy_number") || "Policy number pending";
                  const insurer = field(row, "insurer_name", "insurance_company", "insurer") || "Insurer pending";
                  return (
                    <Link key={row.id} href={`/partner/policy-intakes/${encodeURIComponent(row.id)}`} prefetch={false} className="group grid grid-cols-[minmax(150px,.78fr)_minmax(170px,.9fr)_minmax(150px,.8fr)_minmax(230px,1.2fr)_minmax(150px,.8fr)_minmax(110px,.58fr)_minmax(110px,.58fr)_34px] items-center gap-4 px-4 py-3 transition hover:bg-[#FAFCFF]">
                      <div><p className="text-[10.5px] font-extrabold text-[#1B2F4E]">{row.intake_number}</p><p className="mt-0.5 text-[8.5px] text-[#8B99AC]">Policy intake</p></div>
                      <div><p className="text-[10px] font-semibold text-[#304665]">{customerName || row.customer_mobile || "Customer pending"}</p>{customerName && row.customer_mobile ? <p className="mt-0.5 text-[8.5px] text-[#8392A7]">{row.customer_mobile}</p> : null}</div>
                      <div><p className="text-[10px] font-semibold text-[#304665]">{vehicle}</p>{vehicleMeta ? <p className="mt-0.5 text-[8.5px] text-[#8392A7]">{vehicleMeta}</p> : null}</div>
                      <div><p className="text-[10px] font-semibold text-[#304665]">{policy}</p><p className="mt-0.5 text-[8.5px] text-[#8392A7]">{insurer}</p></div>
                      <div><p className="text-[10px] font-semibold text-[#304665]">{created.date}</p><p className="mt-0.5 text-[8.5px] text-[#8392A7]">{created.time}</p></div>
                      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8.5px] font-bold ${ocrTone(row)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{ocrLabel(row)}</span>
                      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8.5px] font-bold ${statusTone(row)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel(row)}</span>
                      <ArrowRight className="h-4 w-4 justify-self-end text-[#1768C5] transition group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center"><FileText className="mx-auto h-7 w-7 text-[#9AABC0]" /><p className="mt-3 text-[12px] font-bold text-[#23395D]">No submissions match this view</p><p className="mt-1 text-[10.5px] text-[#7A899F]">Choose another status or adjust your search.</p></div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-[#E3EAF3] bg-white px-4 py-3 text-[9px] font-semibold text-[#70829B]">
          <span>Showing {rangeStart}-{rangeEnd} of {total}</span>
          <div className="flex items-center gap-2">
            <button type="button" disabled={!hasPrevious || loading} onClick={() => setPage((value) => Math.max(1, value - 1))} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D4DEEA] px-3 disabled:opacity-40"><ArrowLeft className="h-3 w-3" />Previous</button>
            <span>{page} / {totalPages}</span>
            <button type="button" disabled={!hasNext || loading} onClick={() => setPage((value) => value + 1)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#D4DEEA] px-3 disabled:opacity-40">Next<ArrowRight className="h-3 w-3" /></button>
          </div>
        </div>
      </section>
    </div>
  );
}
