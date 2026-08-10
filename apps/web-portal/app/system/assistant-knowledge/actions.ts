"use server";

import { createHash, randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { parseAssistantKnowledgeWorkbook, AssistantWorkbookValidationError } from "@/lib/assistant/knowledge-workbook";
import { buildAssistantKnowledgeImportPlan } from "@/lib/assistant/knowledge-import";

const ENTRY_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function requireAssistantKnowledgeManager() {
  const authenticated = await getAuthenticatedProfile(await getServerAccessToken());
  const profile = authenticated.profile;
  if (!profile?.id || !profile.is_active || !(await hasEffectiveCapability(profile, "manage_assistant_knowledge", "approve"))) {
    redirect("/access-denied");
  }
  return profile;
}

function redirectError(message: string): never {
  redirect(`/system/assistant-knowledge?error=${encodeURIComponent(message)}`);
}

export async function uploadAssistantKnowledgeWorkbook(formData: FormData) {
  const profile = await requireAssistantKnowledgeManager();
  const file = formData.get("workbook");
  if (!(file instanceof File) || !file.size) redirectError("Choose the controlled assistant workbook.");

  let workbook;
  try {
    workbook = await parseAssistantKnowledgeWorkbook(file);
  } catch (error) {
    if (error instanceof AssistantWorkbookValidationError) redirectError(error.message);
    redirectError(`The workbook could not be validated. Reference ${randomUUID().slice(0, 8)}.`);
  }

  const fileSha256 = createHash("sha256").update(Buffer.from(await file.arrayBuffer())).digest("hex");
  let plan;
  try {
    plan = buildAssistantKnowledgeImportPlan({ fileName: file.name, fileSha256, actorProfileId: profile.id, workbook });
  } catch {
    redirectError("The workbook contains duplicate or invalid knowledge entries.");
  }

  const admin = createSupabaseAdminClient();
  const { data: importRecord, error: importError } = await admin.from("assistant_knowledge_imports").insert(plan.importRow).select("id").single<{ id: string }>();
  if (importError || !importRecord) redirectError("The validated import could not be created.");

  const { data: stagedRows, error: rowsError } = await admin.from("assistant_knowledge_import_rows")
    .insert(plan.importRows.map((row) => ({ ...row, import_id: importRecord.id })))
    .select("id,row_number")
    .returns<Array<{ id: string; row_number: number }>>();
  if (rowsError || !stagedRows || stagedRows.length !== plan.importRows.length) {
    await admin.from("assistant_knowledge_imports").delete().eq("id", importRecord.id);
    redirectError("The validated workbook rows could not be staged.");
  }

  const rowIds = new Map(stagedRows.map((row) => [row.row_number, row.id]));
  const { error: entriesError } = await admin.from("assistant_knowledge_entries").insert(plan.entries.map((entry, index) => ({
    ...entry,
    import_id: importRecord.id,
    import_row_id: rowIds.get(index + 2) ?? null,
  })));
  if (entriesError) {
    await admin.from("assistant_knowledge_imports").delete().eq("id", importRecord.id);
    redirectError("This content version conflicts with existing knowledge or could not be staged.");
  }

  await Promise.all([
    admin.from("assistant_knowledge_import_rows").update({ status: "imported" }).eq("import_id", importRecord.id),
    admin.from("assistant_knowledge_imports").update({ status: "completed", completed_at: new Date().toISOString() }).eq("id", importRecord.id),
  ]);
  revalidatePath("/system/assistant-knowledge");
  redirect("/system/assistant-knowledge?success=Workbook validated and staged as draft knowledge.");
}

async function updateEntryLifecycle(formData: FormData, action: "publish" | "retire") {
  const profile = await requireAssistantKnowledgeManager();
  const id = String(formData.get("entry_id") ?? "");
  if (!ENTRY_ID.test(id)) redirectError("The selected knowledge entry is invalid.");
  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const update = action === "publish"
    ? { status: "published", is_revoked: false, published_by: profile.id, published_at: now, retired_by: null, retired_at: null, effective_from: now, updated_by: profile.id, updated_at: now }
    : { status: "retired", is_revoked: true, retired_by: profile.id, retired_at: now, updated_by: profile.id, updated_at: now };
  const requiredStatus = action === "publish" ? "draft" : "published";
  const { data, error } = await admin.from("assistant_knowledge_entries").update(update).eq("id", id).eq("status", requiredStatus).select("id").maybeSingle<{ id: string }>();
  if (error || !data) redirectError(`The knowledge entry could not be ${action === "publish" ? "published" : "retired"}.`);
  await admin.from("assistant_usage_events").insert({
    actor_profile_id: profile.id,
    capability: "manage_assistant_knowledge",
    decision: "allowed",
    tool_name: action === "publish" ? "assistant_knowledge_publish" : "assistant_knowledge_retire",
    route: "/system/assistant-knowledge",
    row_count: 1,
    latency_ms: 0,
    error_code: null,
  });
  revalidatePath("/system/assistant-knowledge");
  redirect(`/system/assistant-knowledge?success=${action === "publish" ? "Knowledge published." : "Knowledge retired."}`);
}

export async function publishAssistantKnowledgeEntry(formData: FormData) {
  return updateEntryLifecycle(formData, "publish");
}

export async function retireAssistantKnowledgeEntry(formData: FormData) {
  return updateEntryLifecycle(formData, "retire");
}
