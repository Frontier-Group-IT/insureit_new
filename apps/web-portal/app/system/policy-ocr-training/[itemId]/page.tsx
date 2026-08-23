import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator } from "@/lib/policy-ocr-training-access";
import { BENCHMARK_FIELDS, buildReferenceFields, proposalFieldValue, referenceAlignment } from "../benchmark-truth";
import { saveBenchmarkTruthReview } from "../truth-actions";

export const dynamic = "force-dynamic";

export default async function BenchmarkTruthReviewPage({ params }: { params: Promise<{ itemId: string }> }) {
  await requirePolicyOcrTrainingOperator();
  const { itemId } = await params;
  const admin = createSupabaseAdminClient();
  const { data: item } = await admin
    .from("policy_ocr_benchmark_items")
    .select("id,public_key,insurer_name,policy_product,vehicle_segment,cohort_role,policy_document_id,training_label_id,baseline_status,baseline_proposal,baseline_parser_id,baseline_parser_version,truth_status,truth_fields,baseline_metrics,result_classification")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) notFound();

  const sealed = item.cohort_role === "blind_holdout" || item.truth_status === "sealed_holdout";
  let label: Record<string, unknown> | null = null;
  if (!sealed) {
    const { data } = await admin
      .from("policy_ocr_training_labels")
      .select("insurer_name,policy_product,policy_number,valid_from,valid_upto,idv,od_premium,tp_premium,cpa_opted,cpa_premium,printed_net_premium,printed_gst,printed_gross_premium,section_02_reference")
      .eq("id", item.training_label_id)
      .maybeSingle();
    label = data as Record<string, unknown> | null;
  }

  const reference = label ? buildReferenceFields(label) : {};
  const truth = item.truth_fields && typeof item.truth_fields === "object" ? item.truth_fields as Record<string, string> : {};
  const alignment = sealed ? null : referenceAlignment(item.baseline_proposal, reference);

  return (
    <main className="mx-auto w-full max-w-[1500px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/system/policy-ocr-training" className="text-xs font-semibold text-blue-700 hover:underline">← Back to benchmark</Link>
            <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">PDF truth review</p>
            <h1 className="mt-1 text-2xl font-semibold text-slate-950">{item.public_key}</h1>
            <p className="mt-2 text-sm text-slate-600">{item.insurer_name} · {item.policy_product} · {item.vehicle_segment}</p>
            <p className="mt-1 text-xs text-slate-500">Parser: {item.baseline_parser_id ?? "—"} · {item.baseline_parser_version ?? "—"}</p>
          </div>
          <a
            href={`/policies/ocr-training/documents/${item.policy_document_id}/open`}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-100"
          >
            Open private policy copy ↗
          </a>
        </div>
      </section>

      {sealed ? (
        <section className="rounded-2xl border border-violet-200 bg-violet-50 p-5 text-violet-950">
          <h2 className="font-semibold">Blind holdout is sealed</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6">
            PDF truth and database reference values are intentionally hidden for this policy until parser refinement is complete.
            This prevents the holdout from becoming another training example.
          </p>
        </section>
      ) : (
        <>
          <section className="grid gap-3 sm:grid-cols-4">
            <Metric label="Reference fields" value={alignment?.compared ?? 0} />
            <Metric label="Reference matches" value={alignment?.matched ?? 0} />
            <Metric label="Reference missing in OCR" value={alignment?.missing ?? 0} />
            <Metric label="Reference mismatches" value={alignment?.mismatched ?? 0} />
          </section>

          <section className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950">
            <div className="font-semibold">Database reference is only a candidate</div>
            <p className="mt-1 leading-6">
              Verify every saved value against the actual PDF. If the database reference conflicts with the PDF, enter the PDF value; the evaluator will count that separately as a reference conflict rather than training the parser on the database error.
            </p>
          </section>

          <form action={saveBenchmarkTruthReview} className="space-y-5">
            <input type="hidden" name="itemId" value={item.id} />
            {(["Policy", "Vehicle", "Premium"] as const).map((group) => (
              <section key={group} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-5 py-3">
                  <h2 className="font-semibold text-slate-950">{group} fields</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Field</th>
                        <th className="px-4 py-3">Current parser baseline</th>
                        <th className="px-4 py-3">Database reference candidate</th>
                        <th className="px-4 py-3">Verified PDF truth</th>
                        {item.truth_status === "verified" ? <th className="px-4 py-3">Result</th> : null}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {BENCHMARK_FIELDS.filter((field) => field.group === group).map((field) => {
                        const baseline = proposalFieldValue(item.baseline_proposal, field.key);
                        const referenceValue = reference[field.key] ?? "";
                        const existingTruth = truth[field.key] ?? referenceValue;
                        const classification = item.result_classification && typeof item.result_classification === "object"
                          ? (item.result_classification as Record<string, { classification?: string }>)[field.key]?.classification
                          : null;
                        return (
                          <tr key={field.key} className="align-top">
                            <td className="px-4 py-3 font-medium text-slate-900">{field.label}</td>
                            <td className="max-w-[320px] px-4 py-3 text-slate-700">{baseline ?? <span className="text-slate-400">Not proposed</span>}</td>
                            <td className="max-w-[320px] px-4 py-3 text-slate-700">{referenceValue || <span className="text-slate-400">Not stored</span>}</td>
                            <td className="min-w-[280px] px-4 py-3">
                              <input
                                name={`truth_${field.key}`}
                                defaultValue={existingTruth}
                                placeholder="Enter only after checking PDF"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                              />
                            </td>
                            {item.truth_status === "verified" ? (
                              <td className="px-4 py-3"><ResultBadge value={classification ?? "—"} /></td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}

            <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                Saving marks these values as <strong>PDF operator verified</strong> and calculates baseline precision, coverage and field classifications.
              </div>
              <button type="submit" className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
                Save verified PDF truth
              </button>
            </div>
          </form>
        </>
      )}
    </main>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm"><div className="text-xs font-medium text-slate-500">{label}</div><div className="mt-1 text-2xl font-semibold tabular-nums text-slate-950">{value}</div></div>;
}

function ResultBadge({ value }: { value: string }) {
  const positive = ["MATCH_ALL", "ROUNDING_EQUIVALENT", "REFERENCE_CONFLICT"].includes(value);
  const classes = positive ? "bg-emerald-50 text-emerald-700" : value === "OCR_MISSING" ? "bg-amber-50 text-amber-800" : "bg-rose-50 text-rose-700";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}>{value}</span>;
}
