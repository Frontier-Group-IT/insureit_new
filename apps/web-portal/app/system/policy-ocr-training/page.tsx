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
      .select("id,run_id,public_key,insurer_name,policy_product,vehicle_segment,cohort_role,production_count,policies_with_pdf,approved_layout_samples,baseline_status,baseline_parser_id,baseline_parser_version,baseline_failure_code")
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
      return acc;
    },
    { total: 0, ready: 0, pending: 0, failed: 0, training: 0, holdout: 0 },
  );

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Policy OCR training</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">Production Benchmark Control</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Selects fresh policy copies from the five most-used insurers, keeps well-covered layouts as blind holdouts,
              and records the current parser result before any new training change. Operational policy records remain read-only.
            </p>
          </div>
          <form action={createProductionOcrBenchmarkRun}>
            <button
              type="submit"
              className="rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
            >
              Create production benchmark
            </button>
          </form>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Metric label="Selected" value={counts.total} />
        <Metric label="Baseline ready" value={counts.ready} />
        <Metric label="Pending" value={counts.pending} />
        <Metric label="Failed" value={counts.failed} />
        <Metric label="Training" value={counts.training} />
        <Metric label="Blind holdout" value={counts.holdout} />
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
                  <th className="px-4 py-3 text-right">Approved samples</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Baseline</th>
                  <th className="px-4 py-3">Parser</th>
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
                    <td className="max-w-[280px] px-4 py-3 text-xs text-slate-600">
                      <div>{item.baseline_parser_id ?? "—"}</div>
                      <div className="mt-1 break-all text-slate-400">{item.baseline_parser_version ?? ""}</div>
                    </td>
                  </tr>
                ))}
                {!items.length ? (
                  <tr><td colSpan={10} className="px-4 py-10 text-center text-slate-500">No benchmark policies selected.</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-12 text-center text-sm text-slate-600">
          No production benchmark run exists yet. Create one to select fresh policies without exposing private identifiers.
        </section>
      )}

      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
        <div className="font-semibold">Important measurement rule</div>
        <p className="mt-1 leading-6">
          Baseline results are captured before parser refinement. PDF truth, reference conflicts, rounding-equivalent values,
          and fresh-sibling results must be classified separately before an accuracy percentage is reported.
        </p>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{value}</div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const holdout = role === "blind_holdout";
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${holdout ? "bg-violet-50 text-violet-700" : "bg-emerald-50 text-emerald-700"}`}>
      {holdout ? "Blind holdout" : "Training"}
    </span>
  );
}

function StatusBadge({ status }: { status: string }) {
  const classes = status === "ready"
    ? "bg-emerald-50 text-emerald-700"
    : status === "failed"
      ? "bg-rose-50 text-rose-700"
      : status === "processing"
        ? "bg-blue-50 text-blue-700"
        : "bg-slate-100 text-slate-600";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{status}</span>;
}
