"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronDown,
  FileText,
  RefreshCw,
  RotateCcw,
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
  if (row.status === "processing" || row.status === "ready_for_review" || row.status === "in_review") {
    return "border-[#BDD8FF] bg-[#EDF5FF] text-[#1E69C7]";
  }
  return "border-[#DCE4EE] bg-[#F5F7FA] text-[#52657E]";
}

function ocrLabel(row: PartnerPolicyIntake) {
  const value = row.ocr_status?.toLowerCase();
  if (value === "completed" || value === "fetched" || value === "success") return "Fetched";
  if (value === "failed") return "Manual review";
  if (value === "processing" || value === "pending") return "Processing";
  return value ? humanize(value) : "Pending";
}

function ocrTone(row: PartnerPolicyIntake) {
  const value = row.ocr_status?.toLowerCase();
  if (value === "completed" || value === "fetched" || value === "success") {
    return "border-[#A9E8C9] bg-[#EAFBF2] text-[#10895A]";
  }
  if (value === "failed") return "border-[#F1CF86] bg-[#FFF8E8] text-[#B96E00]";
  return "border-[#BDD8FF] bg-[#EDF5FF] text-[#1E69C7]";
}

function dateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, time: "" };
  return {
    date: new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date),
    time: new Intl.DateTimeFormat("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
    }).format(date),
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
  const values = [
    row.intake_number,
    row.customer_mobile,
    row.status,
    statusLabel(row),
    ocrLabel(row),
    field(row, "customer_name", "insured_name", "policy_holder_name"),
    field(row, "policy_number"),
    field(row, "vehicle_registration_number", "registration_number"),
    field(row, "insurer_name", "insurance_company", "insurer"),
  ];
  return values.some((value) => value?.toLowerCase().includes(query));
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

function matchesDateRange(row: PartnerPolicyIntake, fromDate: string, toDate: string) {
  if (!fromDate && !toDate) return true;
  const submittedAt = new Date(row.created_at);
  if (Number.isNaN(submittedAt.getTime())) return false;

  if (fromDate) {
    const from = new Date(`${fromDate}T00:00:00`);
    if (submittedAt < from) return false;
  }

  if (toDate) {
    const to = new Date(`${toDate}T23:59:59.999`);
    if (submittedAt > to) return false;
  }

  return true;
}

function serverFilterFor(filter: IntakeFilter): "all" | "attention" | "in_progress" | "completed" {
  if (filter === "attention") return "attention";
  if (filter === "completed") return "completed";
  if (filter === "in_review" || filter === "processing") return "in_progress";
  return "all";
}

export function PartnerPolicyIntakeListClient() {
  const [rows, setRows] = useState<PartnerPolicyIntake[]>([]);
  const [filter, setFilter] = useState<IntakeFilter>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [dateOpen, setDateOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({
    attention: 0,
    inReview: 0,
    processing: 0,
    completed: 0,
    duplicate: 0,
    rejected: 0,
    all: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const dateFilterRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = search.trim().toLowerCase();
      const hasDateFilter = Boolean(fromDate || toDate);
      const needsExactClientFiltering = Boolean(query)
        || hasDateFilter
        || ["in_review", "processing", "duplicate", "rejected"].includes(filter);

      if (!needsExactClientFiltering) {
        const result = await getPartnerPolicyIntakesWeb({
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          filter: serverFilterFor(filter),
        });
        setRows(result.intakes);
        setTotal(result.total);
        setCounts((current) => ({
          ...current,
          attention: result.counts.attention,
          completed: result.counts.completed,
          all: filter === "all" ? result.total : current.all,
        }));
        return;
      }

      const sourceFilter = serverFilterFor(filter);
      const allRows: PartnerPolicyIntake[] = [];
      let offset = 0;
      let expectedTotal = 0;

      do {
        const result = await getPartnerPolicyIntakesWeb({ limit: PAGE_SIZE, offset, filter: sourceFilter });
        if (offset === 0) expectedTotal = result.total;
        allRows.push(...result.intakes);
        offset += PAGE_SIZE;
        if (!result.intakes.length) break;
      } while (allRows.length < expectedTotal);

      const matches = allRows.filter((row) => (
        matchesFilter(row, filter)
        && matchesSearch(row, query)
        && matchesDateRange(row, fromDate, toDate)
      ));
      const start = (page - 1) * PAGE_SIZE;
      setRows(matches.slice(start, start + PAGE_SIZE));
      setTotal(matches.length);
      setCounts((current) => ({
        ...current,
        inReview: filter === "in_review" ? matches.length : current.inReview,
        processing: filter === "processing" ? matches.length : current.processing,
        duplicate: filter === "duplicate" ? matches.length : current.duplicate,
        rejected: filter === "rejected" ? matches.length : current.rejected,
      }));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Policy Intakes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filter, fromDate, page, search, toDate]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!dateFilterRef.current?.contains(event.target as Node)) setDateOpen(false);
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  const hasPrevious = page > 1;
  const hasNext = page * PAGE_SIZE < total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

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
      <section className="overflow-visible rounded-2xl border border-[#DCE6F1] bg-white shadow-[0_10px_30px_rgba(31,61,107,0.06)]">
        <div className="flex min-w-0 items-center gap-3 border-b border-[#E3EAF3] px-4 py-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0B376D] text-white shadow-sm">
            <FileText className="h-5 w-5" />
          </span>
          <h2 className="shrink-0 text-[15px] font-extrabold tracking-[-0.02em] text-[#142642]">Policy Intake Register</h2>
          <div className="relative min-w-0 flex-1 xl:max-w-[520px]">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7B8CA4]" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search PIR, customer, vehicle, policy, insurer or status"
              className="h-11 w-full rounded-xl border border-[#D3DDE9] bg-white pl-10 pr-3 text-[10.5px] font-semibold text-[#213653] outline-none transition placeholder:text-[#9AA9BB] focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10"
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            aria-label="Refresh policy intakes"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-[#D3DDE9] bg-white text-[#365170] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <RotateCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>

        <div className="relative z-30 flex min-w-0 items-center gap-2 border-b border-[#E3EAF3] bg-white px-4 py-2.5">
          <label className="relative shrink-0">
            <span className="sr-only">Detail status filter</span>
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as IntakeFilter);
                setPage(1);
              }}
              className="h-10 min-w-[165px] cursor-pointer rounded-xl border border-[#D3DDE9] bg-white px-3 text-[10px] font-bold text-[#2D4666] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/15"
            >
              <option value="all">All Detail Status</option>
              <option value="attention">Action Required</option>
              <option value="in_review">In Review</option>
              <option value="processing">Processing</option>
              <option value="completed">Completed</option>
              <option value="duplicate">Duplicate</option>
              <option value="rejected">Rejected</option>
            </select>
          </label>

          <div ref={dateFilterRef} className="relative shrink-0">
            <button
              type="button"
              onClick={() => setDateOpen((open) => !open)}
              aria-expanded={dateOpen}
              aria-haspopup="dialog"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D3DDE9] bg-white px-3.5 text-[10px] font-bold text-[#2D4666] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/15"
            >
              <CalendarDays className="h-3.5 w-3.5 text-[#5A7494]" />
              Date Range
              <ChevronDown className={`h-3.5 w-3.5 text-[#5A7494] transition-transform ${dateOpen ? "rotate-180" : ""}`} />
            </button>

            {dateOpen ? (
              <div
                role="dialog"
                aria-label="Date range filter"
                className="absolute left-0 top-[46px] z-50 w-[365px] rounded-2xl border border-[#DCE5EF] bg-white p-4 shadow-[0_18px_50px_rgba(30,55,90,0.16)]"
              >
                <div className="grid grid-cols-2 gap-3">
                  <label className="min-w-0">
                    <span className="mb-2 block text-[9px] font-bold text-[#71829A]">From date</span>
                    <input
                      type="date"
                      value={fromDate}
                      max={toDate || undefined}
                      onChange={(event) => {
                        setFromDate(event.target.value);
                        setPage(1);
                      }}
                      className="h-11 w-full rounded-xl border border-[#CFD9E6] bg-white px-3 text-[11px] font-semibold text-[#40536D] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10"
                    />
                  </label>
                  <label className="min-w-0">
                    <span className="mb-2 block text-[9px] font-bold text-[#71829A]">To date</span>
                    <input
                      type="date"
                      value={toDate}
                      min={fromDate || undefined}
                      onChange={(event) => {
                        setToDate(event.target.value);
                        setPage(1);
                      }}
                      className="h-11 w-full rounded-xl border border-[#CFD9E6] bg-white px-3 text-[11px] font-semibold text-[#40536D] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10"
                    />
                  </label>
                </div>
                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setFromDate("");
                      setToDate("");
                      setPage(1);
                    }}
                    disabled={!fromDate && !toDate}
                    className="rounded-lg px-2 py-1 text-[10px] font-bold text-[#6F7F94] transition hover:bg-[#F4F7FB] hover:text-[#2D4666] disabled:cursor-default disabled:opacity-45"
                  >
                    Clear dates
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto rounded-xl border border-[#DDE5EF] bg-white p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {filterTabs.map((tab) => {
              const active = filter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    setFilter(tab.key);
                    setPage(1);
                  }}
                  className={`min-w-[96px] flex-1 whitespace-nowrap rounded-lg px-3 py-2 text-center text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 ${
                    active ? "bg-[#123F73] text-white shadow-sm" : "text-[#60728C] hover:bg-[#F4F7FB] hover:text-[#203653]"
                  }`}
                >
                  {tab.label} {tab.count}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-[#D3DDE9] bg-white px-3.5 text-[9px] font-bold text-[#2D4666] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/15"
          >
            My Active Work 0
            <ChevronDown className="h-3.5 w-3.5 text-[#5A7494]" />
          </button>
        </div>

        {error ? (
          <div className="border-b border-[#F1D5D5] bg-[#FFF7F7] px-5 py-3 text-[10.5px] font-semibold text-[#A33B3B] sm:px-6">{error}</div>
        ) : null}

        <div className="overflow-x-auto">
          <div className="min-w-[1120px]">
            <div className="grid grid-cols-[minmax(150px,.78fr)_minmax(170px,.9fr)_minmax(150px,.8fr)_minmax(230px,1.2fr)_minmax(150px,.8fr)_minmax(110px,.58fr)_minmax(110px,.58fr)_34px] items-center gap-4 border-b border-[#E3EAF3] bg-[#F7F9FC] px-4 py-2.5 text-[8px] font-black uppercase tracking-[0.055em] text-[#6D809A]">
              <span>Intake #</span>
              <span>Customer</span>
              <span>Vehicle</span>
              <span>Policy / Insurer</span>
              <span>Submitted</span>
              <span>OCR</span>
              <span>Status</span>
              <span className="text-right">Action</span>
            </div>

            {loading && !rows.length ? (
              <div className="py-16 text-center">
                <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#7F90A8]" />
                <p className="mt-3 text-[11px] font-semibold text-[#526680]">Loading Policy Intakes…</p>
              </div>
            ) : rows.length ? (
              <div className="divide-y divide-[#E7EDF4]">
                {rows.map((row) => {
                  const created = dateParts(row.created_at);
                  const customerName = field(row, "customer_name", "insured_name", "policy_holder_name");
                  const vehicle = field(row, "vehicle_registration_number", "registration_number") || "Vehicle pending";
                  const vehicleMeta = field(row, "vehicle_make_model", "make_model", "vehicle_model");
                  const policy = field(row, "policy_number") || "Policy pending";
                  const insurer = field(row, "insurer_name", "insurance_company", "insurer") || "Insurer pending";

                  return (
                    <Link
                      key={row.id}
                      href={`/partner/policy-intakes/${encodeURIComponent(row.id)}`}
                      className="group grid grid-cols-[minmax(150px,.78fr)_minmax(170px,.9fr)_minmax(150px,.8fr)_minmax(230px,1.2fr)_minmax(150px,.8fr)_minmax(110px,.58fr)_minmax(110px,.58fr)_34px] items-center gap-4 px-4 py-3 transition hover:bg-[#FAFCFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20"
                    >
                      <div className="min-w-0">
                        <p className="break-words text-[10.5px] font-extrabold leading-4 text-[#1B2F4E]">{row.intake_number}</p>
                        <p className="mt-0.5 text-[8.5px] font-medium text-[#8B99AC]">Policy intake</p>
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-[10px] font-semibold leading-4 text-[#304665]">{customerName || row.customer_mobile || "Customer pending"}</p>
                        {customerName && row.customer_mobile ? (
                          <p className="mt-0.5 break-words text-[8.5px] leading-4 text-[#8392A7]">{row.customer_mobile}</p>
                        ) : null}
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-[10px] font-semibold leading-4 text-[#304665]">{vehicle}</p>
                        {vehicleMeta ? <p className="mt-0.5 break-words text-[8.5px] leading-4 text-[#8392A7]">{vehicleMeta}</p> : null}
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-[10px] font-semibold leading-4 text-[#304665]">{policy}</p>
                        <p className="mt-0.5 break-words text-[8.5px] leading-4 text-[#8392A7]">{insurer}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-[#304665]">{created.date}</p>
                        <p className="mt-0.5 text-[8.5px] text-[#8392A7]">{created.time}</p>
                      </div>
                      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8.5px] font-bold ${ocrTone(row)}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {ocrLabel(row)}
                      </span>
                      <span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-[8.5px] font-bold ${statusTone(row)}`}>
                        <span className="h-1.5 w-1.5 rounded-full bg-current" />
                        {statusLabel(row)}
                      </span>
                      <ArrowRight className="h-4 w-4 justify-self-end text-[#1768C5] transition group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-16 text-center">
                <FileText className="mx-auto h-7 w-7 text-[#9AABC0]" />
                <p className="mt-3 text-[12px] font-bold text-[#23395D]">No submissions match this view</p>
                <p className="mt-1 text-[10.5px] text-[#7A899F]">Choose another status or adjust your search.</p>
              </div>
            )}
          </div>
        </div>

        {total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[#E3EAF3] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-medium text-[#6F8198]">Showing {rangeStart}-{rangeEnd} of {total}</p>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={!hasPrevious || loading}
                className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3.5 text-[10px] font-bold text-[#203653] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 disabled:cursor-not-allowed disabled:border-[#E5EAF0] disabled:bg-[#FAFBFC] disabled:text-[#AAB4C2]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="min-w-[44px] text-center text-[10px] font-bold text-[#536680]">{page} / {totalPages}</span>
              <button
                type="button"
                onClick={() => setPage((value) => value + 1)}
                disabled={!hasNext || loading}
                className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3.5 text-[10px] font-bold text-[#203653] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 disabled:cursor-not-allowed disabled:border-[#E5EAF0] disabled:bg-[#FAFBFC] disabled:text-[#AAB4C2]"
              >
                Next <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}