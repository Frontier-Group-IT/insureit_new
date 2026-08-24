import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator } from "@/lib/policy-ocr-training-access";
import { BENCHMARK_FIELDS } from "../../benchmark-truth";
import { saveBlindHoldoutTruth } from "../actions";

export const dynamic = "force-dynamic";

export default async function BlindHoldoutTruthPage({ params }: { params: Promise<{ itemId: string }> }) {
  await requirePolicyOcrTrainingOperator();
  const { itemId } = await params;
  const admin = createSupabaseAdminClient();
  const { data: item } = await admin
    .from("policy_ocr_benchmark_items")
    .select("id,public_key,insurer_name,policy_product,vehicle_segment,cohort_role,policy_document_id,truth_status,post_training_status")
    .eq("id", itemId)
    .maybeSingle<{
      id: string;
      public_key: string;
      insurer_name: string;
      policy_product: string;
      vehicle_segment: string;
      cohort_role: string;
      policy_document_id: string;
      truth_status: string;
      post_training_status: string;
    }>();
  if (!item || item.cohort_role !== "blind_holdout") notFound();

  const canVerify = item.truth_status === "sealed_holdout" && item.post_training_status === "ready";

  return (
    <main className="mx-auto w-full max-w-[1200px] space-y-5 px-4 py-5 sm:px-6 lg:px-8">
      <section className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm">
        <Link href="/system/policy-ocr-training/holdout" className="text-xs font-semibold text-blue-700 hover:underline">← Back to blind holdouts</Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">Blind PDF truth verification</p>
        <h1 className="mt-1 text-2xl font-semibold text-slate-950">{item.public_key}</h1>
        <p className="mt-2 text-sm text-slate-600">{item.insurer_name} · {item.policy_product} · {item.vehicle_segment}</p>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          The final Round #3 prediction has already been frozen. This page intentionally does not show parser output or database reference values. Enter only what you can verify directly from the PDF.
        </p>
        <a
          href={`/policies/ocr-training/documents/${item.policy_document_id}/open`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-800 hover:bg-blue-100"
        >
          Open private policy copy ↗
        </a>
      </section>

      {!canVerify ? (
        <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-700">
          This holdout cannot be verified yet. Its final prediction must be captured first, or its PDF truth has already been saved.
        </section>
      ) : (
        <form action={saveBlindHoldoutTruth} className="space-y-5">
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
                      <th className="px-4 py-3">Verified PDF truth</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {BENCHMARK_FIELDS.filter((field) => field.group === group).map((field) => (
                      <tr key={field.key} className="align-top">
                        <td className="px-4 py-3 font-medium text-slate-900">{field.label}</td>
                        <td className="min-w-[360px] px-4 py-3">
                          <input
                            name={`truth_${field.key}`}
                            placeholder="Enter only after checking PDF"
                            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ))}

          <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-3xl text-sm text-slate-600">
              Saving permanently unseals this holdout for evaluation and scores the already-frozen prediction. It does not retrain or rerun the parser.
            </div>
            <button type="submit" className="rounded-xl bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
              Save blind PDF truth
            </button>
          </div>
        </form>
      )}
    </main>
  );
}
