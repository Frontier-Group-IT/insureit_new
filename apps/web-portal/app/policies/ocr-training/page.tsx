import { redirect } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/shell";
import { requireCapability } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { savePolicyOcrTrainingLabel } from "../ocr-training-actions";

type TrainingRow = {
  id: string;
  policy_id: string;
  file_name: string;
  created_at: string;
  policies: { policy_no: string | null; policy_code: string | null; insurance_companies: { name: string } | null } | null;
  policy_ocr_training_labels: TrainingLabel[];
};

type TrainingLabel = {
  status: string;
  insurer_name: string | null;
  policy_product: string | null;
  policy_number: string | null;
  valid_from: string | null;
  valid_upto: string | null;
  idv: number | null;
  od_premium: number | null;
  tp_premium: number | null;
  cpa_opted: boolean | null;
  cpa_premium: number | null;
  printed_net_premium: number | null;
  printed_gst: number | null;
  printed_gross_premium: number | null;
  evidence_note: string | null;
};

export const dynamic = "force-dynamic";

export default async function PolicyOcrTrainingPage() {
  const reviewer = await requireCapability("manage_system", "approve");
  if (!reviewer) redirect("/access-denied");

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("policy_documents")
    .select("id, policy_id, file_name, created_at, policies(policy_no, policy_code, insurance_companies(name)), policy_ocr_training_labels(*)")
    .eq("document_type", "policy_copy")
    .order("created_at", { ascending: false })
    .returns<TrainingRow[]>();

  const rows = data ?? [];
  return (
    <AppShell title="Policy OCR training">
      <div className="mb-5">
        <p className="text-sm font-bold uppercase tracking-wide text-blue-700">OCR training corpus</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-navy-900">Policy-copy ground truth</h1>
        <p className="mt-2 max-w-3xl text-sm text-slate-500">
          Review each private policy copy and save only approved Section 03 labels. Raw documents and OCR text are never exported into regression fixtures.
        </p>
      </div>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">The training corpus is temporarily unavailable.</div> : null}
      <div className="space-y-4">
        {rows.map((row) => <TrainingForm key={row.id} row={row} />)}
        {!rows.length && !error ? <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">No uploaded policy copies found.</div> : null}
      </div>
    </AppShell>
  );
}

function TrainingForm({ row }: { row: TrainingRow }) {
  const label = row.policy_ocr_training_labels[0] ?? null;
  return (
    <form action={savePolicyOcrTrainingLabel} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-soft">
      <input type="hidden" name="policy_document_id" value={row.id} />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-bold text-navy-900">{row.file_name}</p>
          <p className="mt-1 text-xs text-slate-500">
            Policy {row.policies?.policy_no ?? row.policies?.policy_code ?? "-"} · {row.policies?.insurance_companies?.name ?? "Insurer not linked"} · {new Date(row.created_at).toLocaleDateString("en-IN")}
          </p>
        </div>
        <Link href={`/policies/documents/${row.id}/open`} className="rounded-lg border border-blue-200 px-3 py-2 text-xs font-bold text-blue-700">Open private copy</Link>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {field("Insurer", "insurer_name", label?.insurer_name)}
        {field("Product", "policy_product", label?.policy_product)}
        {field("Policy number", "policy_number", label?.policy_number)}
        {field("Valid from", "valid_from", label?.valid_from, "date")}
        {field("Valid upto", "valid_upto", label?.valid_upto, "date")}
        {field("IDV", "idv", label?.idv)}
        {field("OD premium", "od_premium", label?.od_premium)}
        {field("TP premium", "tp_premium", label?.tp_premium)}
        {field("CPA amount", "cpa_premium", label?.cpa_premium)}
        {field("Printed net", "printed_net_premium", label?.printed_net_premium)}
        {field("Printed GST", "printed_gst", label?.printed_gst)}
        {field("Printed gross", "printed_gross_premium", label?.printed_gross_premium)}
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-[180px_1fr]">
        <label className="text-xs font-bold text-slate-600">CPA opted
          <select name="cpa_opted" defaultValue={label?.cpa_opted ? "yes" : "no"} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="no">No</option><option value="yes">Yes</option>
          </select>
        </label>
        <label className="text-xs font-bold text-slate-600">Evidence note
          <textarea name="evidence_note" defaultValue={label?.evidence_note ?? ""} required className="mt-1 min-h-10 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Labels/rows proving the financial values" />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs font-bold text-slate-500">Status: {label?.status ?? "needs_review"}</span>
        <div className="flex gap-2">
          <select name="status" defaultValue={label?.status ?? "needs_review"} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="needs_review">Needs review</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
          </select>
          <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-bold text-white">Save labels</button>
        </div>
      </div>
    </form>
  );
}

function field(label: string, name: string, value: string | number | null | undefined, type = "text") {
  return <label className="text-xs font-bold text-slate-600">{label}<input name={name} type={type} defaultValue={value ?? ""} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>;
}
