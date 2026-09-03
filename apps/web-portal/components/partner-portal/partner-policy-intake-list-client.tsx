"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AlertCircle, ArrowRight, FileText, Plus, RefreshCw } from "lucide-react";
import { getPartnerPolicyIntakesWeb, type PartnerPolicyIntake } from "@/lib/partner-policy-intakes-client";

type IntakeFilter = "all" | "attention" | "in_progress" | "completed";

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
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  async function load(manual = false) {
    if (manual) setRefreshing(true);
    else setLoading(true);
    setError("");
    try {
      const result = await getPartnerPolicyIntakesWeb();
      setRows(result.intakes);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Policy Intakes could not be loaded.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void load(false);
  }, []);

  const counts = useMemo(() => ({
    active: rows.filter((row) => !["completed", "rejected"].includes(row.status)).length,
    attention: rows.filter((row) => row.status === "needs_attention").length,
    progress: rows.filter((row) => ["processing", "ready_for_review", "in_review"].includes(row.status)).length,
    completed: rows.filter((row) => row.status === "completed").length,
  }), [rows]);

  const visibleRows = useMemo(() => rows.filter((row) => {
    if (filter === "all") return true;
    if (filter === "attention") return row.status === "needs_attention";
    if (filter === "completed") return row.status === "completed";
    return ["processing", "ready_for_review", "in_review"].includes(row.status);
  }), [filter, rows]);

  return (
    <div className="space-y-4">
      <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">Policy Intake</p>
            <h2 className="mt-1 text-[23px] font-extrabold tracking-[-0.025em] text-[#142541]">My submissions</h2>
            <p className="mt-1 text-[11px] font-medium text-[#74839A]">Send policy copies to Operations and track the same onboarding pipeline used by the Partner app.</p>
          </div>
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
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Summary label="Active" value={counts.active} />
          <Summary label="Need You" value={counts.attention} />
          <Summary label="In Progress" value={counts.progress} />
          <Summary label="Completed" value={counts.completed} />
        </div>
      </section>

      <section className="overflow-hidden rounded-[26px] border border-[#D7E0EC] bg-white shadow-[0_16px_45px_rgba(34,56,89,.07)]">
        <div className="flex flex-col gap-3 border-b border-[#E6ECF3] px-5 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
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
                onClick={() => setFilter(value)}
                className={"rounded-xl px-3 py-2 text-[10px] font-bold " + (filter === value ? "bg-[#3156B8] text-white" : "border border-[#D8E0EA] bg-white text-[#4D617D]")}
              >
                {label}
              </button>
            ))}
          </div>
          <p className="text-[9.5px] font-semibold text-[#7A899F]">{visibleRows.length} shown · {rows.length} total</p>
        </div>

        {error ? (
          <div className="border-b border-[#F1D5D5] bg-[#FFF7F7] px-5 py-3 text-[10.5px] font-semibold text-[#A33B3B] sm:px-6">{error}</div>
        ) : null}

        {loading && !rows.length ? (
          <div className="px-5 py-14 text-center">
            <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[#7F90A8]" />
            <p className="mt-3 text-[11px] font-semibold text-[#526680]">Loading Policy Intakes…</p>
          </div>
        ) : visibleRows.length ? (
          <div className="divide-y divide-[#E8EDF4]">
            {visibleRows.map((row) => (
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
          <div className="px-5 py-14 text-center">
            <FileText className="mx-auto h-7 w-7 text-[#9AABC0]" />
            <p className="mt-3 text-[12px] font-bold text-[#23395D]">{rows.length ? "No submissions in this filter" : "No Policy Intakes yet"}</p>
            <p className="mt-1 text-[10.5px] text-[#7A899F]">{rows.length ? "Choose another pipeline filter." : "Create an intake when you have a policy copy that Operations needs to onboard."}</p>
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl border border-[#E1E7F0] bg-[#F8FAFD] p-4"><p className="text-[9px] font-black uppercase tracking-[0.11em] text-[#75849A]">{label}</p><p className="mt-2 text-[22px] font-extrabold text-[#162746]">{value}</p></div>;
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
