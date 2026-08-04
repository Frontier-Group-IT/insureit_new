"use server";

import { hasEffectiveCapability, hasAnyEffectiveCapability } from "@/lib/effective-permissions";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { canManagePospMispOnboarding } from "@/lib/roles";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export async function deleteSelectedPospMispImportRows(data: FormData) {
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  if (!profile?.is_active || !(await hasAnyEffectiveCapability(profile, ["create_intermediary_application", "review_intermediary_application"]))) {
    redirect("/access-denied");
  }

  const batchId = text(data, "batch_id");
  const rowIds = data.getAll("row_ids").filter((value): value is string => typeof value === "string" && value.length > 0);
  if (!batchId || !rowIds.length) redirect(`/customers/posp-misp/import/${batchId ?? ""}?error=no_rows_selected`);

  const admin = createSupabaseAdminClient();
  const { data: rows, error: rowError } = await admin
    .from("posp_misp_import_rows")
    .select("id,status")
    .eq("import_batch_id", batchId)
    .in("id", rowIds)
    .returns<Array<{ id: string; status: string }>>();
  if (rowError) redirect(`/customers/posp-misp/import/${batchId}?error=row_delete_failed`);

  const deletableIds = (rows ?? []).filter((row) => !["submitted", "processing"].includes(row.status)).map((row) => row.id);
  if (!deletableIds.length) redirect(`/customers/posp-misp/import/${batchId}?error=row_locked`);

  const { data: documents } = await admin
    .from("posp_misp_import_row_documents")
    .select("storage_bucket,storage_path")
    .in("import_row_id", deletableIds)
    .returns<Array<{ storage_bucket: string; storage_path: string }>>();

  const { error: deleteError } = await admin
    .from("posp_misp_import_rows")
    .delete()
    .eq("import_batch_id", batchId)
    .in("id", deletableIds);
  if (deleteError) redirect(`/customers/posp-misp/import/${batchId}?error=row_delete_failed`);

  const pathsByBucket = new Map<string, string[]>();
  for (const document of documents ?? []) {
    pathsByBucket.set(document.storage_bucket, [...(pathsByBucket.get(document.storage_bucket) ?? []), document.storage_path]);
  }
  await Promise.allSettled([...pathsByBucket].map(([bucket, paths]) => admin.storage.from(bucket).remove(paths)));

  await refreshBatchCounts(admin, batchId);
  revalidatePath(`/customers/posp-misp/import/${batchId}`);
  redirect(`/customers/posp-misp/import/${batchId}?success=rows_removed&count=${deletableIds.length}`);
}

async function refreshBatchCounts(admin: ReturnType<typeof createSupabaseAdminClient>, batchId: string) {
  const { data: rows, error } = await admin.from("posp_misp_import_rows").select("status").eq("import_batch_id", batchId).returns<Array<{ status: string }>>();
  if (error) throw error;
  const activeRows = rows ?? [];
  const invalidRows = activeRows.filter((row) => row.status === "invalid").length;
  const validRows = activeRows.filter((row) => row.status === "parsed").length;
  const pendingRows = activeRows.filter((row) => row.status === "parsed" || row.status === "processing").length;
  const submittedRows = activeRows.filter((row) => row.status === "submitted").length;
  const failedRows = activeRows.filter((row) => row.status === "failed").length;
  const processingRows = activeRows.filter((row) => row.status === "processing").length;
  const status = processingRows ? "processing" : activeRows.length > 0 && submittedRows === activeRows.length ? "submitted" : submittedRows > 0 ? "partially_submitted" : failedRows > 0 && validRows === 0 ? "failed" : "parsed";
  const { error: updateError } = await admin.from("posp_misp_import_batches").update({ total_rows: activeRows.length, valid_rows: validRows, invalid_rows: invalidRows, pending_rows: pendingRows, submitted_rows: submittedRows, failed_rows: failedRows, status }).eq("id", batchId);
  if (updateError) throw updateError;
}

function text(data: FormData, name: string) {
  const value = data.get(name);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
