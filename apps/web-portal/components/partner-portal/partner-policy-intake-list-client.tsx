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
  if (row.status === "completed") return "bg-[#E5F8EE] text-[#14975F]";
  if (row.status === "rejected") return "bg-[#FFE8E8] text-[#C83A3A]";
  if (row.status === "needs_attention") return "bg-[#FFF1DA] text-[#C87808]";
  if (row.status === "processing" || row.status === "ready_for_review" || row.status === "in_review") return "bg-[#E8F2FF] text-[#2470D9]";
  return "bg-[#EEF3F8] text-[#425672]";
}

function dateParts(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, time: "" };
  return {
    date: new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" }).format(date),
    time: new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(date),
  };
}

function field(row: PartnerPolicyIntake, key: string) {
  return row.ocr_fields?.find((item) => item.key === key)?.value?.trim() || "";
}

function matchesSearch(row: PartnerPolicyIntake, query: string) {
  if (!query) return true;
  const values = [
    row.intake_number,
    row.customer_mobile,
    row.lead_source_name,
    row.status,
    statusLabel(row),
    field(row, "policy_number"),
    field(row, "vehicle_registration_number"),
  ];
  return values.some((value) => value?.toLowerCase().includes(query));
}

export function PartnerPolicyIntakeListClient() {
  const [rows, setRows] = useState<PartnerPolicyIntake[]>([]);
  const [filter, setFilter] = useState<IntakeFilter>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [, setCounts] = useState({ active: 0, attention: 0, progress: 0, completed: 0 });
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

  return (
    <div className="pb-4">
      <section className="overflow-hidden rounded-xl border border-[#DDE6F0] bg-white shadow-[0_4px_16px_rgba(37,61,103,0.045)]">
        <div className="flex flex-col gap-3 border-b border-[#E7EDF4] px-4 py-3 xl:flex-row xl:items-center">
          <div className="flex min-w-0 items-center gap-3 xl:flex-1">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEF4FF] text-[#3156B8]"><FileText className="h-4 w-4" /></span>
            <h2 className="shrink-0 text-[12px] font-extrabold text-[#1B2F4E]">Policy Intake Register</h2>
            <div className="relative min-w-0 flex-1 xl:max-w-[420px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8DA4]" />
              <input
                value={search}
                onChange={(event) => { setSearch(event.target.value); setPage(1); }}
                placeholder="Policy number, customer, vehicle or status"
                className="h-9 w-full rounded-lg border border-[#CCD7E4] bg-white pl-9 pr-3 text-[10px] font-semibold text-[#213653] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/10"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 xl:ml-auto xl:justify-end">
            <label className="relative">
              <span className="sr-only">Status filter</span>
              <select
                value={filter}
                onChange={(event) => { setFilter(event.target.value as IntakeFilter); setPage(1); }}
                className="h-9 min-w-[118px] cursor-pointer rounded-lg border border-[#C9D8EC] bg-[#F5F9FF] px-3 text-[10px] font-bold text-[#23436D] outline-none transition focus:border-[#3156B8] focus:ring-2 focus:ring-[#3156B8]/15"
              >
                <option value="all">Status · All</option>
                <option value="active">Status · Active</option>
                <option value="attention">Status · Need You</option>
                <option value="in_progress">Status · In Progress</option>
                <option value="completed">Status · Completed</option>
              </select>
            </label>
            <span className="px-1 text-[9.5px] font-semibold text-[#7A899F]">{total} total records</span>
            <Link href="/partner/policy-intakes/new" className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#111A35] px-3.5 text-[10px] font-bold text-white transition hover:bg-[#1B2A50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25">
              <Plus className="h-4 w-4" /> Intake
            </Link>
          </div>
        </div>

        {error ? <div className="border-b border-[#F1D5D5] bg-[#FFF7F7] px-5 py-3 text-[10.5px] font-semibold text-[#A33B3B] sm:px-6">{error}</div> : null}

        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[minmax(210px,1.1fr)_minmax(190px,1fr)_minmax(130px,.7fr)_minmax(110px,.55fr)_34px] items-center gap-3 border-b border-[#E7EDF4] bg-[#F8FAFD] px-4 py-2 text-[8px] font-black uppercase tracking-[0.05em] text-[#6F819A]">
              <span>Policy / Reference</span><span>Customer / Vehicle</span><span>Submission Date</span><span>Status</span><span className="text-right">Action</span>
            </div>

            {loading && !rows.length ? (
              <div className="py-14 text-center">
                <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#7F90A8]" />
                <p className="mt-3 text-[11px] font-semibold text-[#526680]">Loading Policy Intakes…</p>
              </div>
            ) : rows.length ? (
              <div className="divide-y divide-[#E8EDF4]">
                {rows.map((row) => {
                  const created = dateParts(row.created_at);
                  const policy = field(row, "policy_number") || "Policy pending";
                  const vehicle = field(row, "vehicle_registration_number") || "Vehicle pending";
                  return (
                    <Link key={row.id} href={"/partner/policy-intakes/" + encodeURIComponent(row.id)} className="group grid grid-cols-[minmax(210px,1.1fr)_minmax(190px,1fr)_minmax(130px,.7fr)_minmax(110px,.55fr)_34px] items-center gap-3 px-4 py-2.5 transition hover:bg-[#FAFCFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[#EAF3FF] text-[#2875DD]"><FileText className="h-3.5 w-3.5" /></span>
                        <div className="min-w-0">
                          <p className="break-words text-[10.5px] font-extrabold leading-4 text-[#1B2F4E]">{row.intake_number}</p>
                          <p className="mt-0.5 break-words text-[9px] font-medium leading-4 text-[#7A899F]">{policy}</p>
                        </div>
                      </div>
                      <div className="min-w-0">
                        <p className="break-words text-[10px] font-semibold leading-4 text-[#304665]">{row.lead_source_name}</p>
                        <p className="mt-0.5 break-words text-[9px] leading-4 text-[#8190A5]">{vehicle} · {row.customer_mobile}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-semibold text-[#304665]">{created.date}</p>
                        <p className="mt-0.5 text-[9px] text-[#8190A5]">{created.time}</p>
                      </div>
                      <span className={`inline-flex w-fit items-center gap-1.5 rounded-lg px-2.5 py-1 text-[8.5px] font-bold ${statusTone(row)}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{statusLabel(row)}</span>
                      <ArrowRight className="h-4 w-4 justify-self-end text-[#315A91] transition group-hover:translate-x-0.5" />
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="py-14 text-center">
                <FileText className="mx-auto h-7 w-7 text-[#9AABC0]" />
                <p className="mt-3 text-[12px] font-bold text-[#23395D]">{total ? "No submissions match this view" : "No Policy Intakes yet"}</p>
                <p className="mt-1 text-[10.5px] text-[#7A899F]">{total ? "Choose another filter or adjust your search." : "Create a new intake when you have a policy copy."}</p>
              </div>
            )}
          </div>
        </div>

        {total > 0 ? (
          <div className="flex flex-col gap-3 border-t border-[#E6ECF3] px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-[10px] font-medium text-[#6F8198]">Showing {rangeStart}-{rangeEnd} of {total}</p>
            <div className="flex items-center gap-3 self-end sm:self-auto">
              <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={!hasPrevious || loading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D2DCE9] bg-white px-3.5 text-[10px] font-bold text-[#203653] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 disabled:cursor-not-allowed disabled:border-[#E5EAF0] disabled:bg-[#FAFBFC] disabled:text-[#AAB4C2]">
                <ArrowLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="min-w-[44px] text-center text-[10px] font-bold text-[#536680]">{page} / {totalPages}</span>
              <button type="button" onClick={() => setPage((value) => value + 1)} disabled={!hasNext || loading} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-[#D2DCE9] bg-white px-3.5 text-[10px] font-bold text-[#203653] transition hover:bg-[#F8FAFD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20 disabled:cursor-not-allowed disabled:border-[#E5EAF0] disabled:bg-[#FAFBFC] disabled:text-[#AAB4C2]">
                Next <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
