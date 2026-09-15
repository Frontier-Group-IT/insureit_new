"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, FileText, Plus, RefreshCw, Search } from "lucide-react";
import { getPartnerPolicyIntakesWeb, type PartnerPolicyIntake } from "@/lib/partner-policy-intakes-client";

type IntakeFilter = "all" | "active" | "attention" | "in_progress" | "completed";
const PAGE_SIZE = 25;

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(row: PartnerPolicyIntake) {
  if (row.status === "processing" && row.ocr_status === "failed") return "Manual review";
  const labels: Record<string, string> = {
    processing: "Processing",
    ready_for_review: "Ready",
    in_review: "In Progress",
    needs_attention: "Need You",
    completed: "Completed",
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

export function PartnerPolicyIntakeListClient() {
  const [rows, setRows] = useState<PartnerPolicyIntake[]>([]);
  const [filter, setFilter] = useState<IntakeFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ active: 0, attention: 0, progress: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const query = search.trim().toLowerCase();
      const needsCompleteDataset = filter === "active" || Boolean(query);

      if (!needsCompleteDataset) {
        const result = await getPartnerPolicyIntakesWeb({
          limit: PAGE_SIZE,
          offset: (page - 1) * PAGE_SIZE,
          filter,
        });
        setRows(result.intakes);
        setTotal(result.total);
        setCounts(result.counts);
        return;
      }

      const serverFilter = filter === "active" ? "all" : filter;
      const completeRows: PartnerPolicyIntake[] = [];
      let offset = 0;
      let firstCounts = { active: 0, attention: 0, progress: 0, completed: 0 };
      let expectedTotal = 0;

      do {
        const result = await getPartnerPolicyIntakesWeb({
          limit: PAGE_SIZE,
          offset,
          filter: serverFilter,
        });
        if (offset === 0) {
          firstCounts = result.counts;
          expectedTotal = result.total;
        }
        completeRows.push(...result.intakes);
        offset += PAGE_SIZE;
        if (!result.intakes.length) break;
      } while (completeRows.length < expectedTotal);

      const completeMatches = completeRows.filter((row) => {
        if (filter === "active" && (row.status === "completed" || row.status === "rejected")) return false;
        return matchesSearch(row, query);
      });
      const start = (page - 1) * PAGE_SIZE;
      setRows(completeMatches.slice(start, start + PAGE_SIZE));
      setTotal(completeMatches.length);
      setCounts(firstCounts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Policy Intakes could not be loaded.");
    } finally {
      setLoading(false);
    }
  }, [filter, page, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasPrevious = page > 1;
  const hasNext = page * PAGE_SIZE < total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const rangeStart = total ? (page - 1) * PAGE_SIZE + 1 : 0;
  const rangeEnd = Math.min(page * PAGE_SIZE, total);

  const filterTabs: Array<{ key: IntakeFilter; label: string; count?: number }> = [
    { key: "all", label: "All" },
    { key: "active", label: "Active", count: counts.active },
    { key: "attention", label: "Action Required", count: counts.attention },
    { key: "in_progress", label: "In Progress", count: counts.progress },
    { key: "completed", label: "Completed", count: counts.completed },
  ];

  return (
    <div className="pb-4">
      <section className="overflow-hidden rounded-2xl border border-[#DCE6F1] bg-white shadow-[0_10px_30px_rgba(31,61,107,0.06)]">
        <div className="flex flex-col gap-3 border-b border-[#E3EAF3] px-4 py-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 items-center gap-3 xl:flex-1">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#0B376D] text-white shadow-sm">
              <FileText className="h-5 w-5" />
            </span>
            <h2 className="shrink-0 text-[15px] font-extrabold tracking-[-0.02em] text-[#142642]">
              Policy Intake Register
            </h2>
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
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <Link
            href="/partner/policy-intakes/new"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-[#0B376D] px-4 text-[10.5px] font-bold text-white shadow-sm transition hover:bg-[#12477F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25"
          >
            <Plus className="h-4 w-4" /> New Intake
          </Link>
        </div>

        <div className="flex flex-col gap-2 border-b border-[#E3EAF3] bg-[#FBFCFE] px-4 py-2.5 xl:flex-row xl:items-center">
          <label className="relative shrink-0">
            <span className="sr-only">Status filter</span>
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as IntakeFilter);
                setPage(1);
              }}
              className="h-10 min-w-[140px] cursor-pointer rounded-xl border border-[#D3DDE9] bg-white px-3 text-[10px] font-bold text-[#2D4666] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/15"
            >
              <option value="all">Status · All</option>
              <option value="active">Status · Active</option>
              <option value="attention">Status · Action Required</option>
              <option value="in_progress">Status · In Progress</option>
              <option value="completed">Status · Completed</option>
            </select>
          </label>

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
                  className={`shrink-0 rounded-lg px-3 py-2 text-[9px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 ${
                    active
                      ? "bg-[#123F73] text-white shadow-sm"
                      : "text-[#60728C] hover:bg-[#F4F7FB] hover:text-[#203653]"
                  }`}
                >
                  {tab.label}{tab.count !== undefined ? ` ${tab.count}` : ""}
                </button>
              );
            })}
          </div>
        </div>

        {error ? (
          <div className="border-b border-[#F1D5D5] bg-[#FFF7F7] px-5 py-3 text-[10.5px] font-semibold text-[#A33B3B] sm:px-6">
            {error}
          </div>
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
                        <p className="break-words text-[10.5px] font-extrabold leading-4 text-[#1B2F4E]">
                          {row.intake_number}
                        </p>
                        <p className="mt-0.5 text-[8.5px] font-medium text-[#8B99AC]">Policy intake</p>
                      </div>

                      <div className="min-w-0">
                        <p className="break-words text-[10px] font-semibold leading-4 text-[#304665]">
                          {customerName || row.customer_mobile || "Customer pending"}
                        </p>
                        {customerName && row.customer_mobile ? (
                          <p className="mt-0.5 break-words text-[8.5px] leading-4 text-[#8392A7]">{row.customer_mobile}</p>
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <p className="break-words text-[10px] font-semibold leading-4 text-[#304665]">{vehicle}</p>
                        {vehicleMeta ? (
                          <p className="mt-0.5 break-words text-[8.5px] leading-4 text-[#8392A7]">{vehicleMeta}</p>
                        ) : null}
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
                <p className="mt-3 text-[12px] font-bold text-[#23395D]">
                  {total ? "No submissions match this view" : "No Policy Intakes yet"}
                </p>
                <p className="mt-1 text-[10.5px] text-[#7A899F]">
                  {total ? "Choose another status or adjust your search." : "Create a new intake when you have a policy copy."}
                </p>
              </div>
            )}
          </div>
        </div>

        {total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[#E3EAF3] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-medium text-[#6F8198]">
              Showing {rangeStart}-{rangeEnd} of {total}
            </p>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button
                type="button"
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                disabled={!hasPrevious || loading}
                className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3.5 text-[10px] font-bold text-[#203653] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 disabled:cursor-not-allowed disabled:border-[#E5EAF0] disabled:bg-[#FAFBFC] disabled:text-[#AAB4C2]"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="min-w-[44px] text-center text-[10px] font-bold text-[#536680]">
                {page} / {totalPages}
              </span>
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
