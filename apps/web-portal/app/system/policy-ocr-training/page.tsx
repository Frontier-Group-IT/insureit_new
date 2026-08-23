import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator } from "@/lib/policy-ocr-training-access";
import { createProductionOcrBenchmarkRun } from "./actions";
import { BenchmarkRunner } from "./benchmark-runner";

export const dynamic = "force-dynamic";

type BenchmarkRun = {
  id: string;
  name: string;
  status: string;
  sample_per_family: number;
  selection_strategy: string;
  summary: Record<string, unknown> | null;
  created_at: string;
};

type BaselineMetrics = {
  expected?: number;
  autoFilled?: number;
  correct?: number;
  perfect?: boolean;
  referenceConflicts?: number;
  ocrMissing?: number;
  semanticErrors?: number;
};

type BenchmarkItem = {
  id: string;
  run_id: string;
  public_key: string;
  insurer_name: string;
  policy_product: string;
  vehicle_segment: string;
  cohort_role: string;
  production_count: number;
  policies_with_pdf: number;
  approved_layout_samples: number;
  baseline_status: string;
  baseline_parser_id: string | null;
  baseline_parser_version: string | null;
  baseline_failure_code: string | null;
  truth_status: string;
  baseline_metrics: BaselineMetrics | null;
};

export default async function PolicyOcrTrainingControlPage() {
  await requirePolicyOcrTrainingOperator();
  const admin = createSupabaseAdminClient();
  const { data: runs } = await admin
    .from("policy_ocr_benchmark_runs")
    .select("id,name,status,sample_per_family,selection_strategy,summary,created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  const typedRuns = (runs ?? []) as BenchmarkRun[];
  const activeRun = typedRuns[0] ?? null;
  let items: BenchmarkItem[] = [];
  if (activeRun) {
    const { data } = await admin
      .from("policy_ocr_benchmark_items")
      .select("id,run_id,public_key,insurer_name,policy_product,vehicle_segment,cohort_role,production_count,policies_with_pdf,approved_layout_samples,baseline_status,baseline_parser_id,baseline_parser_version,baseline_failure_code,truth_status,baseline_metrics")
      .eq("run_id", activeRun.id)
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: true });
    items = (data ?? []) as BenchmarkItem[];
  }

  const counts = items.reduce(
    (acc, item) => {
      acc.total += 1;
      if (item.baseline_status === "ready") acc.ready += 1;
      if (item.baseline_status === "pending") acc.pending += 1;
      if (item.baseline_status === "failed") acc.failed += 1;
      if (item.cohort_role === "blind_holdout") acc.holdout += 1;
      else acc.training += 1;
      if (item.truth_status === "verified") acc.truthVerified += 1;
      const metrics = item.truth_status === "verified" ? item.baseline_metrics : null;
      acc.expected += metrics?.expected ?? 0;
      acc.autoFilled += metrics?.autoFilled ?? 0;
      acc.correct += metrics?.correct ?? 0;
      if (metrics?.perfect) acc.perfectPolicies += 1;
      acc.referenceConflicts += metrics?.referenceConflicts ?? 0;
      acc.ocrMissing += metrics?.ocrMissing ?? 0;
      acc.semanticErrors += metrics?.semanticErrors ?? 0;
      return acc;
    },
    { total: 0, ready: 0, pending: 0, failed: 0, training: 0, holdout: 0, truthVerified: 0, expected: 0, autoFilled: 0, correct: 0, perfectPolicies: 0, referenceConflicts: 0, ocrMissing: 0, semanticErrors: 0 },
  );
  const precision = counts.autoFilled ? counts.correct / counts.autoFilled : null;
  const coverage = counts.expected ? counts.autoFilled / counts.expected : null;

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Policy OCR training</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Production Benchmark Control</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Selects fresh policy copies from the five most-used insurers, keeps well-covered layouts as blind holdouts,
              captures the untouched baseline, then measures verified PDF truth before any parser refinement.
            </p>
          </div>
          <form action={createProductionOcrBenchmarkRun}>
            <button type="submit" className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800">
              Create production benchmark
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-8">
        <Metric label="Selected" value={String(counts.total)} />
        <Metric label="Baseline ready" value={String(counts.ready)} />
        <Metric label="Training" value={String(counts.training)} />
        <Metric label="Blind holdout" value={String(counts.holdout)} />
        <Metric label="Truth verified" value={`${counts.truthVerified}/${counts.training}`} />
        <Metric label="Measured precision" value={formatPercent(precision)} />
        <Metric label="Measured coverage" value={formatPercent(coverage)} />
        <Metric label="Perfect policies" value={counts.truthVerified ? `${counts.perfectPolicies}/${counts.truthVerified}` : "—"} />
      </section>

      {activeRun ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-3 border-b border-slate-200 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-slate-950">{activeRun.name}</h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">{activeRun.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {activeRun.selection_strategy} · {activeRun.sample_per_family} policies per selected insurer family
              </p>
            </div>
            {counts.pending > 0 ? <BenchmarkRunner runId={activeRun.id} pending={counts.pending} /> : null}
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Policy key</th>
                  <th className="px-4 py-3">Insurer</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Segment</th>
                  <th className="px-4 py-3 text-right">Production</th>
                  <th className="px-4 py-3 text-right">PDFs</th>
                  <th className="px-4 py-3 text-right">Approved</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Baseline</th>
                  <th className="px-4 py-3">Truth</th>
                  <th className="px-4 py-3">Parser</th>
                  <th className="px-4 py-3">Next</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((item) => (
                  <tr key={item.id} className="align-top">
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{item.public_key}</td>
                    <td className="max-w-[260px] px-4 py-3 font-medium text-slate-900">{item.insurer_name}</td>
                    <td className="px-4 py-3 text-slate-700">{item.policy_product}</td>
                    <td className="px-4 py-3 text-slate-700">{item.vehicle_segment}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.production_count}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.policies_with_pdf}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.approved_layout_samples}</td>
                    <td className="px-4 py-3"><RoleBadge role={item.cohort_role} /></td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.baseline_status} />
                      {item.baseline_failure_code ? <div className="mt-1 text-xs text-rose-600">{item.baseline_failure_code}</div> : null}
                    </td>
                    <td className="px-4 py-3"><TruthBadge status={item.truth_status} /></td>
                    <td className="max-w-[280px] px-4 py-3 text-xs text-slate-600">
                      <div>{item.baseline_parser_id ?? "—"}</div>
                      <div className="mt-1 break-all text-slate-400">{item.baseline_parser_version ?? ""}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/system/policy-ocr-training/${item.id}`} className="inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50">
                        {item.cohort_role === "blind_holdout" ? "View sealed" : item.truth_status === "verified" ? "Review truth" : "Verify PDF truth"}
                      </Link>
                    </td>
                  </tr>
                ))}
                {!items.length ? <tr><td colSpan={12} className="px-4 py-10 text-center text-slate-500">No benchmark policies selected.</td></tr> : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center text-sm text-slate-600">
          No production benchmark run exists yet. Create one to select fresh policies without exposing private identifiers.
        </section>
      )}

      {counts.truthVerified > 0 ? (
        <section className="grid gap-3 sm:grid-cols-3">
          <Metric label="Reference conflicts" value={String(counts.referenceConflicts)} />
          <Metric label="OCR missing" value={String(counts.ocrMissing)} />
          <Metric label="Semantic mismatches" value={String(counts.semanticErrors)} />
        </section>
      ) : null}

      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
        <div className="font-semibold">Measurement rule</div>
        <p className="mt-1 leading-6">
          Percentages appear only from fields explicitly verified against the actual PDF. Database values are prefilled as reference candidates only; they never become truth automatically. Blind holdouts remain sealed until post-training verification.
        </p>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="text-xs font-medium text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{value}</div></div>;
}

function RoleBadge({ role }: { role: string }) {
  const holdout = role === "blind_holdout";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${holdout ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700"}`}>{holdout ? "Blind holdout" : "Training"}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === "ready" ? "bg-emerald-50 text-emerald-700" : status === "failed" ? "bg-rose-50 text-rose-700" : status === "processing" ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}

function TruthBadge({ status }: { status: string }) {
  const classes = status === "verified" ? "bg-emerald-50 text-emerald-700" : status === "sealed_holdout" ? "bg-violet-50 text-violet-700" : "bg-amber-50 text-amber-800";
  const label = status === "sealed_holdout" ? "sealed" : status;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{label}</span>;
}

function formatPercent(value: number | null) {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}
