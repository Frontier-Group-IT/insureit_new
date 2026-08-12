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
  const stagedEntries = plan.entries.map((entry, index) => ({ ...entry, row_number: plan.importRows[index].row_number }));
  const { data: importId, error: importError } = await admin.rpc("stage_assistant_knowledge_import", {
    p_import: plan.importRow,
    p_entries: stagedEntries,
  });
  if (importError || typeof importId !== "string") redirectError("This content version conflicts with existing knowledge or could not be staged.");
  revalidatePath("/system/assistant-knowledge");
  redirect("/system/assistant-knowledge?success=Workbook validated and staged as draft knowledge.");
}

async function updateEntryLifecycle(formData: FormData, action: "publish" | "retire") {
  const profile = await requireAssistantKnowledgeManager();
  if (action === "publish" && String(formData.get("content_reviewed") ?? "") !== "yes") redirectError("Review the complete knowledge content before publication.");
  const id = String(formData.get("entry_id") ?? "");
  if (!ENTRY_ID.test(id)) redirectError("The selected knowledge entry is invalid.");
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("transition_assistant_knowledge_entry", {
    p_entry_id: id,
    p_action: action,
    p_actor_id: profile.id,
  });
  if (error || !data) redirectError(`The knowledge entry could not be ${action === "publish" ? "published" : "retired"}.`);
  revalidatePath("/system/assistant-knowledge");
  redirect(`/system/assistant-knowledge?success=${action === "publish" ? "Knowledge published." : "Knowledge retired."}`);
}

export async function publishAssistantKnowledgeEntry(formData: FormData) {
  return updateEntryLifecycle(formData, "publish");
}

export async function retireAssistantKnowledgeEntry(formData: FormData) {
  return updateEntryLifecycle(formData, "retire");
}
