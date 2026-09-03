"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ArrowRight, FileText, Plus, RefreshCw } from "lucide-react";
import { PartnerMetricStrip, PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
import { getPartnerPolicyIntakesWeb, type PartnerPolicyIntake } from "@/lib/partner-policy-intakes-client";

type IntakeFilter = "all" | "attention" | "in_progress" | "completed";
const PAGE_SIZE = 25;

function humanize(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusLabel(row: PartnerPolicyIntake) {
  if (row.status === "processing" && row.ocr_status === "failed") return "Manual review";
  const labels: Record<string, string> = {
    processing: "Processing",
    ready_for_review: "Ready",
    in_review: "In review",
    needs_attention: "Needs attention",
    completed: "Completed",
    rejected: "Rejected",
  };
  return labels[row.status] || humanize(row.status);
}

function dateLabel(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date);
}

function field(row: PartnerPolicyIntake, key: string) {
  return row.ocr_fields?.find((item) => item.key === key)?.value?.trim() || "";
}

export function PartnerPolicyIntakeListClient() {
  const [rows, setRows] = useState<PartnerPolicyIntake[]>([]);
  const [filter, setFilter] = useState<IntakeFilter>("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ active: 0, attention: 0, progress: 0, completed: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await getPartnerPolicyIntakesWeb({
        limit: PAGE_SIZE,
        offset: (page - 1) * PAGE_SIZE,
        filter,
      });
      setRows(result.intakes);
      setTotal(result.total);
      setCounts(result.counts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Policy Intakes could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filter, page]);

  useEffect(() => {
    void load(false);
  }, [load]);

  const hasPrevious = page > 1;
  const hasNext = page * PAGE_SIZE < total;

  return (
    <div className="space-y-7">
      <PartnerPageHeader
        eyebrow="Policy Intake"
        title="My submissions"
        description="Send policy copies to Operations and track the same onboarding pipeline used by the Partner app."
        action={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void load(true)}
              disabled={refreshing}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-4 text-[10.5px] font-bold text-[#203653] disabled:opacity-50"
            >
              <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} /> Refresh
            </button>
            <Link href="/partner/policy-intakes/new" className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#111A35] px-4 text-[10.5px] font-bold text-white">
              <Plus className="h-4 w-4" /> New Intake
            </Link>
          </div>
        }
      />

      <PartnerMetricStrip
        items={[
          { label: "Active", value: counts.active },
          { label: "Need You", value: counts.attention },
          { label: "In Progress", value: counts.progress },
          { label: "Completed", value: counts.completed },
        ]}
      />

      <section>
        <div className="flex flex-col gap-3 border-y border-[#DCE4ED] py-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {([
              ["all", "All"],
              ["attention", "Attention"],
              ["in_progress", "In Progress"],
              ["completed", "Completed"],
            ] as Array<[IntakeFilter, string]>).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => { setFilter(value); setPage(1); }}
                className={"rounded-xl px-3 py-2 text-[10px] font-bold " + (filter === value ? "bg-[#3156B8] text-white" : "border border-[#D8E0EA] bg-white text-[#4D617D]")}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[9.5px] font-semibold text-[#7A899F]">{rows.length} shown · {total} matched</p>
        </div>
        <div className="mt-5"><PartnerSectionHeading title="Policy Intake Register" description={total + " matched"} /></div>
        <div className="mt-3 border-y border-[#DCE4ED]">

        {error ? (
          <div className="border-b border-[#F1D5D5] bg-[#FFF7F7] px-5 py-3 text-[10.5px] font-semibold text-[#A33B3B] sm:px-6">{error}</div>
        ) : null}

        {loading && !rows.length ? (
          <div className="py-14 text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#7F90A8]" />
            <p className="mt-3 text-[11px] font-semibold text-[#526680]">Loading Policy Intakes…</p>
          </div>
        ) : rows.length ? (
          <div className="divide-y divide-[#E8EDF4]">
            {rows.map((row) => (
              <Link key={row.id} href={"/partner/policy-intakes/" + encodeURIComponent(row.id)} className="group block px-5 py-4 transition hover:bg-[#F8FAFD] sm:px-6">
                <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
                  <div className="flex min-w-0 flex-1 items-start gap-3">
                    <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8]">
                      <FileText className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[11.5px] font-extrabold text-[#1B2F4E]">{row.intake_number}</p>
                        <span className="rounded-lg bg-[#EEF3F8] px-2 py-1 text-[9px] font-bold text-[#425672]">{statusLabel(row)}</span>
                      </div>
                      <p className="mt-1 truncate text-[10px] font-medium text-[#74839A]">{row.customer_mobile} · {row.lead_source_name}</p>
                      <p className="mt-1 truncate text-[9.5px] text-[#8190A5]">{field(row, "policy_number") || "Policy pending"} · {field(row, "vehicle_registration_number") || "Vehicle pending"}</p>
                    </div>
                  </div>

                  <IntakeProgress row={row} />

                  <div className="min-w-[150px] xl:text-right">
                    <p className="text-[9px] font-bold uppercase tracking-[0.08em] text-[#8190A5]">Updated</p>
                    <p className="mt-1 text-[9.5px] font-semibold text-[#536680]">{dateLabel(row.updated_at || row.created_at)}</p>
                  </div>
                  <ArrowRight className="hidden h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5 xl:block" />
                </div>

                {row.attention_reason ? (
                  <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#F1D6A7] bg-[#FFF8EC] px-3 py-2.5">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#A86708]" />
                    <p className="text-[9.5px] font-semibold leading-4 text-[#80511A]">{row.attention_reason}</p>
                  </div>
                ) : null}
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-14 text-center">
            <FileText className="mx-auto h-7 w-7 text-[#9AABC0]" />
            <p className="mt-3 text-[12px] font-bold text-[#23395D]">{total ? "No submissions on this page" : "No Policy Intakes yet"}</p>
            <p className="mt-1 text-[10.5px] text-[#7A899F]">{total ? "Go back a page or choose another pipeline filter." : "Create an intake when you have a policy copy that Operations needs to onboard."}</p>
          </div>
        )}
        {(hasPrevious || hasNext) ? (
          <div className="flex items-center justify-between border-t border-[#E6ECF3] py-4">
            <button
              type="button"
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              disabled={!hasPrevious || loading}
              className="inline-flex min-h-9 items-center rounded-xl border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <p className="text-[10px] font-semibold text-[#74839A]">Page {page}</p>
            <button
              type="button"
              onClick={() => setPage((value) => value + 1)}
              disabled={!hasNext || loading}
              className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[#D2DCE9] bg-white px-3 text-[10px] font-bold text-[#203653] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}
        </div>
      </section>
    </div>
  );
}

function IntakeProgress({ row }: { row: PartnerPolicyIntake }) {
  const manual = row.status === "processing" && row.ocr_status === "failed";
  const activeStep = row.status === "completed" ? 4 : row.status === "in_review" ? 3 : row.status === "ready_for_review" || row.status === "needs_attention" || manual ? 2 : 1;
  const rejected = row.status === "rejected";

  return (
    <div className="flex min-w-[220px] flex-1 items-start">
      {["Uploaded", "Read", "Review", "Done"].map((label, index) => {
        const step = index + 1;
        const complete = !rejected && step <= activeStep;
        return (
          <div key={label} className="relative flex flex-1 flex-col items-center">
            <div className="relative flex w-full items-center justify-center">
              <span className={"z-10 h-2.5 w-2.5 rounded-full " + (complete ? "bg-[#3156B8]" : rejected && step === activeStep ? "bg-[#C85353]" : "bg-[#D6DCE6]")} />
              {index < 3 ? <span className={"absolute left-[56%] h-px w-[88%] " + (step < activeStep && !rejected ? "bg-[#8DA9F2]" : "bg-[#DCE1E9]")} /> : null}
            </div>
            <span className={"mt-1 text-[8px] font-semibold " + (complete ? "text-[#354C70]" : "text-[#9AA6B8]")}>{label}</span>
          </div>
        );
      })}
    </div>
  );
}
