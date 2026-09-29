"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type DeleteLifeHealthCaseResult = { ok: true } | { ok: false; error: string };

type CaseDocument = { storage_bucket: string; storage_path: string };

export async function deleteLifeHealthCase(caseId: string): Promise<DeleteLifeHealthCaseResult> {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || profile.role !== "it_super_user") {
    return { ok: false, error: "Only the IT Super User can permanently delete Life / Health cases." };
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(caseId)) {
    return { ok: false, error: "Invalid Life / Health case." };
  }

  const admin = createSupabaseAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("life_health_cases")
    .select("id,case_number,final_policy_id")
    .eq("id", caseId)
    .maybeSingle<{ id: string; case_number: string; final_policy_id: string | null }>();
  if (existingError) return { ok: false, error: `Unable to verify the case: ${existingError.message}` };
  if (!existing) return { ok: false, error: "This Life / Health case no longer exists." };
  if (existing.final_policy_id) {
    return { ok: false, error: "Cannot delete this case because an issued policy is linked to it. Delete or resolve the linked policy first." };
  }

  const { data: documents, error: documentsError } = await admin
    .from("life_health_case_documents")
    .select("storage_bucket,storage_path")
    .eq("case_id", caseId)
    .returns<CaseDocument[]>();
  if (documentsError) return { ok: false, error: `Unable to verify linked case documents: ${documentsError.message}` };

  const { error: deleteError } = await admin.from("life_health_cases").delete().eq("id", caseId).is("final_policy_id", null);
  if (deleteError) {
    const referenced = deleteError.code === "23503" || /foreign key|violates/i.test(deleteError.message);
    return { ok: false, error: referenced ? "Cannot delete this case because another record still references it." : `Unable to delete the case: ${deleteError.message}` };
  }

  const byBucket = new Map<string, string[]>();
  for (const document of documents ?? []) {
    if (!document.storage_bucket || !document.storage_path) continue;
    byBucket.set(document.storage_bucket, [...(byBucket.get(document.storage_bucket) ?? []), document.storage_path]);
  }
  await Promise.allSettled(Array.from(byBucket.entries()).map(([bucket, paths]) => admin.storage.from(bucket).remove(paths)));

  await admin.from("audit_logs").insert({
    actor_id: profile.id,
    action: "delete",
    entity_type: "life_health_case",
    entity_id: caseId,
    metadata: { case_number: existing.case_number, deleted_by: "it_super_user", document_count: documents?.length ?? 0 }
  });

  revalidatePath("/policies/life-health-cases");
  return { ok: true };
}
