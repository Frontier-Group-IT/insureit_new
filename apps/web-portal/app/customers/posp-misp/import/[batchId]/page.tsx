import Link from "next/link";
import { AppShell } from "@/components/shell";
import { DataError } from "@/components/record-list";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { submitPospMispImportBatch } from "../../actions";

type Batch = { id: string; file_name: string; total_rows: number; valid_rows: number; invalid_rows: number; status: string; created_at: string };
type ImportRow = {
  id: string;
  row_number: number;
  sheet_name: string;
  partner_type: "posp" | "misp";
  normalized_data: Record<string, unknown>;
  validation_errors: string[] | null;
  status: string;
  application_id: string | null;
  error_message: string | null;
};

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospMispImportBatchPage({ params, searchParams }: { params: Promise<{ batchId: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  await requireMasterDataManager();
  const { batchId } = await params;
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const [{ data: batch, error: batchError }, { data: rows, error: rowsError }] = await Promise.all([
    supabase.from("posp_misp_import_batches").select("id, file_name, total_rows, valid_rows, invalid_rows, status, created_at").eq("id", batchId).maybeSingle<Batch>(),
    supabase.from("posp_misp_import_rows").select("id, row_number, sheet_name, partner_type, normalized_data, validation_errors, status, application_id, error_message").eq("import_batch_id", batchId).order("row_number", { ascending: true }).returns<ImportRow[]>()
  ]);

  return (
    <AppShell title="POSP / MISP Import Review">
      <div className="mx-auto max-w-[1440px] space-y-3 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Link href="/customers/posp-misp" className="text-[10.5px] font-semibold text-[#4F46E5] hover:underline">Back to POSP / MISP</Link>
            <h1 className="mt-2 text-lg font-semibold text-[#0F172A]">{batch?.file_name ?? "Import batch"}</h1>
            <p className="mt-1 text-[11px] text-[#64748B]">Valid rows can be submitted as onboarding applications. Invalid rows stay here for correction in the source file.</p>
          </div>
          {batch && batch.status === "parsed" && batch.valid_rows > 0 ? (
            <form action={submitPospMispImportBatch}>
              <input type="hidden" name="batch_id" value={batch.id} />
              <button className="rounded-md bg-[#4F46E5] px-4 py-2 text-[11px] font-semibold text-white">Submit Valid Rows</button>
            </form>
          ) : null}
        </div>

        {query.error ? <DataError message={query.error === "no_valid_rows" ? "No valid rows are available for submission." : "The batch could not be submitted."} /> : null}
        {query.success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">Valid rows were submitted to KYC applications.</div> : null}
        {batchError || rowsError || !batch ? <DataError message={batchError?.message ?? rowsError?.message ?? "Import batch not found."} /> : (
          <>
            <section className="grid gap-3 md:grid-cols-4">
              <Metric label="Total Rows" value={batch.total_rows} />
              <Metric label="Valid Rows" value={batch.valid_rows} tone="success" />
              <Metric label="Invalid Rows" value={batch.invalid_rows} tone="warning" />
              <Metric label="Status" value={batch.status.replaceAll("_", " ")} />
            </section>
            <div className="overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1100px] text-left text-[11px]">
                  <thead className="border-b border-[#E2E8F0] bg-[#F8FAFC] text-[9.5px] uppercase tracking-[0.04em] text-[#64748B]">
                    <tr><th className="px-3 py-2.5">Row</th><th className="px-3 py-2.5">Sheet</th><th className="px-3 py-2.5">Name</th><th className="px-3 py-2.5">Mobile</th><th className="px-3 py-2.5">PAN</th><th className="px-3 py-2.5">Training</th><th className="px-3 py-2.5">Validation</th><th className="px-3 py-2.5">Status</th><th className="px-3 py-2.5">Application</th></tr>
                  </thead>
                  <tbody className="divide-y divide-[#EEF2F6]">
                    {(rows ?? []).map((row) => {
                      const normalized = row.normalized_data ?? {};
                      const name = stringValue(row.partner_type === "posp" ? normalized.pos_name : normalized.misp_name);
                      return (
                        <tr key={row.id} className="hover:bg-[#FAFCFF]">
                          <td className="px-3 py-3 tabular-nums">{row.row_number}</td>
                          <td className="px-3 py-3">{row.sheet_name}</td>
                          <td className="px-3 py-3 font-semibold text-[#0F172A]">{name ?? "-"}</td>
                          <td className="px-3 py-3 tabular-nums">{stringValue(normalized.applicant_phone) ?? "-"}</td>
                          <td className="px-3 py-3">{stringValue(normalized.pan_number) ?? "-"}</td>
                          <td className="px-3 py-3">{stringValue(normalized.training_status) ?? "-"}</td>
                          <td className="px-3 py-3">{row.validation_errors?.length ? <span className="text-red-700">{row.validation_errors.join(" ")}</span> : <span className="text-emerald-700">Ready</span>}</td>
                          <td className="px-3 py-3">{row.error_message ?? row.status.replaceAll("_", " ")}</td>
                          <td className="px-3 py-3">{row.application_id ? <Link href={`/customers/applications/${row.application_id}`} className="font-semibold text-[#4F46E5] hover:underline">Review</Link> : "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </AppShell>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "success" | "warning" }) {
  const color = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : "text-[#0F172A]";
  return <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">{label}</p><p className={`mt-1 text-xl font-semibold capitalize ${color}`}>{value}</p></div>;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
