import Link from "next/link";
import { AppShell } from "@/components/shell";
import { FormSubmitButton } from "@/components/form-submit-button";
import { DataError } from "@/components/record-list";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { requireMasterDataManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { ImportRowReviewTable } from "../import-row-review-table";
import { submitPospMispImportBatch } from "../../actions";

type Batch = { id: string; file_name: string; total_rows: number; valid_rows: number; invalid_rows: number; pending_rows: number; submitted_rows: number; failed_rows: number; status: string; created_at: string };
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
  documents?: Array<{ document_type: string; file_name: string }>;
};
type RowDocument = { import_row_id: string; document_type: string; file_name: string };

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PospMispImportBatchPage({ params, searchParams }: { params: Promise<{ batchId: string }>; searchParams: Promise<{ error?: string; success?: string }> }) {
  await requireMasterDataManager();
  const { batchId } = await params;
  const query = await searchParams;
  const supabase = await createServerSupabaseClient();
  const admin = createSupabaseAdminClient();
  const [{ data: batch, error: batchError }, { data: rows, error: rowsError }, salesManagers, oems, banks] = await Promise.all([
    supabase.from("posp_misp_import_batches").select("id, file_name, total_rows, valid_rows, invalid_rows, pending_rows, submitted_rows, failed_rows, status, created_at").eq("id", batchId).maybeSingle<Batch>(),
    supabase.from("posp_misp_import_rows").select("id, row_number, sheet_name, partner_type, normalized_data, validation_errors, status, application_id, error_message").eq("import_batch_id", batchId).order("row_number", { ascending: true }).returns<ImportRow[]>(),
    loadSalesManagers(admin),
    loadVehicleManufacturers(admin),
    loadBanks(admin)
  ]);
  const rowIds = (rows ?? []).map((row) => row.id);
  const { data: rowDocuments, error: documentsError } = rowIds.length
    ? await supabase.from("posp_misp_import_row_documents").select("import_row_id, document_type, file_name").in("import_row_id", rowIds).returns<RowDocument[]>()
    : { data: [] as RowDocument[], error: null };
  const documentsByRow = new Map<string, RowDocument[]>();
  for (const document of rowDocuments ?? []) {
    documentsByRow.set(document.import_row_id, [...(documentsByRow.get(document.import_row_id) ?? []), document]);
  }
  const rowsWithDocuments = (rows ?? []).map((row) => ({ ...row, documents: documentsByRow.get(row.id) ?? [] }));

  return (
    <AppShell title="POSP / MISP Import Review">
      <div className="mx-auto max-w-[1440px] space-y-3 pb-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <Link href="/customers/posp-misp" className="text-[10.5px] font-semibold text-[#4F46E5] hover:underline">Back to POSP / MISP</Link>
            <h1 className="mt-2 text-lg font-semibold text-[#0F172A]">{batch?.file_name ?? "Import batch"}</h1>
            <p className="mt-1 text-[11px] text-[#64748B]">Review, correct or remove parsed rows before submitting valid rows as onboarding applications.</p>
          </div>
          <div className="flex items-center gap-2">
            {batch && batch.status !== "processing" && batch.valid_rows > 0 ? (
              <form action={submitPospMispImportBatch}>
                <input type="hidden" name="batch_id" value={batch.id} />
                <FormSubmitButton
                  label="Submit Ready Rows"
                  pendingLabel="Submitting"
                  className="inline-flex items-center justify-center rounded-md bg-[#4F46E5] px-4 py-2 text-[11px] font-semibold text-white disabled:opacity-70"
                />
              </form>
            ) : null}
            {batch && batch.status !== "processing" && batch.failed_rows > 0 ? (
              <form action={submitPospMispImportBatch}>
                <input type="hidden" name="batch_id" value={batch.id} />
                <input type="hidden" name="retry_failed" value="true" />
                <FormSubmitButton
                  label="Retry Failed Rows"
                  pendingLabel="Retrying"
                  className="inline-flex items-center justify-center rounded-md border border-amber-300 bg-amber-50 px-4 py-2 text-[11px] font-semibold text-amber-800 disabled:opacity-70"
                />
              </form>
            ) : null}
          </div>
        </div>

        {query.error ? <DataError message={errorMessage(query.error)} /> : null}
        {query.success ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[11px] font-semibold text-emerald-700">{successMessage(query.success)}</div> : null}
        {batchError || rowsError || documentsError || !batch ? <DataError message={batch ? "Import batch data could not be loaded." : "Import batch not found."} /> : (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
              <Metric label="Total Rows" value={batch.total_rows} />
              <Metric label="Ready" value={batch.valid_rows} tone="success" />
              <Metric label="Invalid Rows" value={batch.invalid_rows} tone="warning" />
              <Metric label="Submitted" value={batch.submitted_rows} tone="success" />
              <Metric label="Failed" value={batch.failed_rows} tone="danger" />
              <Metric label="Status" value={batch.status.replaceAll("_", " ")} />
            </section>
            <ImportRowReviewTable batchId={batch.id} batchStatus={batch.status} rows={rowsWithDocuments} salesManagers={salesManagers} oems={oems} banks={banks} />
          </>
        )}
      </div>
    </AppShell>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string | number; tone?: "default" | "success" | "warning" | "danger" }) {
  const color = tone === "success" ? "text-emerald-700" : tone === "warning" ? "text-amber-700" : tone === "danger" ? "text-red-700" : "text-[#0F172A]";
  return <div className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-sm"><p className="text-[10px] font-semibold uppercase tracking-[0.04em] text-[#64748B]">{label}</p><p className={`mt-1 text-xl font-semibold capitalize ${color}`}>{value}</p></div>;
}

async function loadSalesManagers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin
    .from("profiles")
    .select("id, full_name, employee_code")
    .eq("role", "sales_manager")
    .eq("is_active", true)
    .order("full_name", { ascending: true })
    .returns<Array<{ id: string; full_name: string | null; employee_code: string | null }>>();
  return (data ?? []).map((manager) => ({
    id: manager.id,
    fullName: manager.full_name?.trim() || "Unnamed Sales Manager",
    employeeCode: manager.employee_code
  }));
}

async function loadVehicleManufacturers(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin
    .from("vehicle_manufacturers")
    .select("name")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true })
    .returns<Array<{ name: string }>>();
  return (data ?? []).map((manufacturer) => ({ value: manufacturer.name, label: manufacturer.name }));
}

async function loadBanks(admin: ReturnType<typeof createSupabaseAdminClient>) {
  const { data } = await admin
    .from("banks")
    .select("id, name")
    .eq("is_active", true)
    .order("name")
    .returns<Array<{ id: string; name: string }>>();
  return (data ?? []).map((bank) => ({ value: bank.id, label: bank.name }));
}

function errorMessage(error: string) {
  const messages: Record<string, string> = {
    no_valid_rows: "No valid rows are available for submission.",
    row_missing: "The selected import row could not be found.",
    row_locked: "This row has already been submitted and cannot be edited.",
    row_update_failed: "The row could not be updated.",
    row_delete_failed: "The row could not be removed.",
    document_upload_failed: "The document could not be uploaded. Use a PDF, JPG or PNG file no larger than 5 MB.",
    marksheet_type_required: "Select the marksheet type before uploading the marksheet.",
    master_data: "Sales Manager or OEM master data could not be loaded."
  };
  return messages[error] ?? "The batch could not be updated.";
}

function successMessage(success: string) {
  const messages: Record<string, string> = {
    submitted: "Ready rows were processed. Any failures remain available for correction or retry.",
    retried: "Failed rows were retried. Review the updated row and batch statuses.",
    row_updated: "Parsed row was updated and revalidated.",
    row_removed: "Parsed row was removed from this batch."
  };
  return messages[success] ?? "Saved successfully.";
}
