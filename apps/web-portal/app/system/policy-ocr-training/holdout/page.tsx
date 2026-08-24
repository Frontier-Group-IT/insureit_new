import Link from "next/link";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator } from "@/lib/policy-ocr-training-access";
import { HoldoutRunner } from "./holdout-runner";

export const dynamic = "force-dynamic";

type Metrics = {
  expected?: number;
  autoFilled?: number;
  correct?: number;
  perfect?: boolean;
  ocrMissing?: number;
  semanticErrors?: number;
};

type HoldoutItem = {
  id: string;
  public_key: string;
  insurer_name: string;
  policy_product: string;
  vehicle_segment: string;
  truth_status: string;
  post_training_status: string;
  post_training_failure_code: string | null;
  post_training_metrics: Metrics | null;
};

export default async function BlindHoldoutPage() {
  await requirePolicyOcrTrainingOperator();
  const admin = createSupabaseAdminClient();
  const { data: run } = await admin
    .from("policy_ocr_benchmark_runs")
    .select("id,name,created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string; name: string; created_at: string }>();

  const { data } = run
    ? await admin
      .from("policy_ocr_benchmark_items")
      .select("id,public_key,insurer_name,policy_product,vehicle_segment,truth_status,post_training_status,post_training_failure_code,post_training_metrics")
      .eq("run_id", run.id)
      .eq("cohort_role", "blind_holdout")
      .order("priority_score", { ascending: false })
      .order("created_at", { ascending: true })
    : { data: [] as HoldoutItem[] };

  const items = (data ?? []) as HoldoutItem[];
  const pending = items.filter((item) => item.truth_status === "sealed_holdout" && ["pending", "failed"].includes(item.post_training_status)).length;
  const processing = items.filter((item) => item.post_training_status === "processing").length;
  const captured = items.filter((item) => item.post_training_status === "ready").length;
  const verified = items.filter((item) => item.truth_status === "verified" && item.post_training_metrics).length;
  const allPredictionsFrozen = items.length > 0 && captured === items.length && processing === 0 && pending === 0;
  const allTruthVerified = items.length > 0 && verified === items.length;

  const aggregate = items.reduce(
    (acc, item) => {
      if (item.truth_status !== "verified" || !item.post_training_metrics) return acc;
      acc.expected += item.post_training_metrics.expected ?? 0;
      acc.autoFilled += item.post_training_metrics.autoFilled ?? 0;
      acc.correct += item.post_training_metrics.correct ?? 0;
      acc.ocrMissing += item.post_training_metrics.ocrMissing ?? 0;
      acc.semanticErrors += item.post_training_metrics.semanticErrors ?? 0;
      if (item.post_training_metrics.perfect) acc.perfect += 1;
      return acc;
    },
    { expected: 0, autoFilled: 0, correct: 0, ocrMissing: 0, semanticErrors: 0, perfect: 0 },
  );
  const precision = aggregate.autoFilled ? aggregate.correct / aggregate.autoFilled : null;
  const coverage = aggregate.expected ? aggregate.autoFilled / aggregate.expected : null;

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-sm">
        <Link href="/system/policy-ocr-training" className="text-xs font-semibold text-blue-700 hover:underline">← Back to benchmark</Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-violet-700">Blind generalization test</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">United India sealed holdouts</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
          Round #3 parser logic is frozen. Final predictions are captured before any holdout PDF truth is revealed. Only after all predictions are frozen can the PDFs be opened for truth verification and scoring.
        </p>
        {run ? <p className="mt-2 text-xs text-slate-500">Benchmark: {run.name}</p> : null}
      </section>

      <section className="grid gap-3 sm:grid-cols-4">
        <Metric label="Holdouts" value={String(items.length)} />
        <Metric label="Predictions frozen" value={`${captured}/${items.length || 0}`} />
        <Metric label="Truth verified" value={`${verified}/${items.length || 0}`} />
        <Metric label="Capture failures" value={String(items.filter((item) => item.post_training_status === "failed").length)} />
      </section>

      {!allPredictionsFrozen && run ? (
        <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="font-semibold text-violet-950">Phase 1 — freeze predictions</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-violet-900/80">
                This phase does not read PDF truth or database reference candidates. It only stores the final Round #3 parser outputs for the four sealed policies.
              </p>
            </div>
            {pending > 0 ? <HoldoutRunner runId={run.id} pending={pending} /> : null}
          </div>
          {processing > 0 ? <p className="mt-3 text-sm text-violet-900">Processing {processing} holdout policies…</p> : null}
        </section>
      ) : null}

      {allPredictionsFrozen && !allTruthVerified ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <h2 className="font-semibold text-amber-950">Phase 2 — verify PDF truth</h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-amber-900/80">
            All four predictions are now frozen. Open each holdout below, read the private PDF, and enter truth without seeing the frozen prediction or database reference candidate. Scoring happens only after truth is saved.
          </p>
        </section>
      ) : null}

      {allTruthVerified ? (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700">Final blind result</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Metric label="Precision" value={formatPercent(precision)} />
            <Metric label="Coverage" value={formatPercent(coverage)} />
            <Metric label="Correct" value={`${aggregate.correct}/${aggregate.autoFilled}`} />
            <Metric label="Expected" value={String(aggregate.expected)} />
            <Metric label="Withheld/missing" value={String(aggregate.ocrMissing)} />
            <Metric label="Semantic errors" value={String(aggregate.semanticErrors)} />
          </div>
          <p className="mt-3 text-sm text-emerald-950">Perfect policies: {aggregate.perfect}/{items.length}.</p>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-950">Holdout policies</h2>
        </div>
        <div className="divide-y divide-slate-100">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-medium text-slate-950">{item.public_key}</div>
                <div className="mt-1 text-xs text-slate-500">{item.insurer_name} · {item.policy_product} · {item.vehicle_segment}</div>
                <div className="mt-1 text-xs text-slate-500">Prediction: {item.post_training_status} · Truth: {item.truth_status}</div>
                {item.post_training_failure_code ? <div className="mt-1 text-xs font-medium text-rose-600">{item.post_training_failure_code}</div> : null}
              </div>
              {allPredictionsFrozen && item.truth_status === "sealed_holdout" ? (
                <Link href={`/system/policy-ocr-training/holdout/${item.id}`} className="inline-flex rounded-xl border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100">
                  Verify PDF truth
                </Link>
              ) : item.truth_status === "verified" ? (
                <span className="text-sm font-semibold text-emerald-700">Verified</span>
              ) : (
                <span className="text-sm text-slate-400">Sealed</span>
              )}
            </div>
          ))}
          {!items.length ? <div className="px-5 py-10 text-center text-sm text-slate-500">No blind holdouts found in the latest benchmark.</div> : null}
        </div>
      </section>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="text-xs font-medium text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{value}</div></div>;
}

function formatPercent(value: number | null) {
  return value == null ? "—" : `${(value * 100).toFixed(1)}%`;
}
