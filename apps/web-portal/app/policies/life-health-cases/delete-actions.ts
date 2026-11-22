"use server";

import { revalidatePath } from "next/cache";
import { deleteMasterRecord } from "@/app/master-record-delete-actions";
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

  const { data: documents, error: documentsError } = await admin
    .from("life_health_case_documents")
    .select("storage_bucket,storage_path")
    .eq("case_id", caseId)
    .returns<CaseDocument[]>();
  if (documentsError) return { ok: false, error: `Unable to verify linked case documents: ${documentsError.message}` };

  // A durable audit request must exist before any irreversible policy/case changes.
  // Use the canonical audit_logs schema; never place actual document paths in the event.
  const { data: auditRequest, error: auditRequestError } = await admin.from("audit_logs")
    .insert({
      actor_id: profile.id,
      action: "life_health_case_delete_requested",
      table_name: "life_health_cases",
      record_id: caseId,
      new_data: {
        phase: "requested",
        document_count: documents?.length ?? 0,
        linked_policy_present: Boolean(existing.final_policy_id),
      },
    })
    .select("id")
    .single<{ id: string }>();
  if (auditRequestError || !auditRequest?.id) {
    return { ok: false, error: "Audit logging is unavailable; no case or policy was deleted." };
  }

  const updateAuditOutcome = async (phase: string, details: Record<string, unknown>) => {
    const { error } = await admin.from("audit_logs")
      .update({ action: "life_health_case_delete_" + phase, new_data: { phase, ...details } })
      .eq("id", auditRequest.id);
    return !error;
  };

  // An issued Life / Health case and its generated policy point at each other.
  // Break only that case -> policy link before asking the existing guarded policy
  // deletion workflow to remove the policy. All normal policy dependency guards
  // (claims, accounts, reconciliation, active intakes, etc.) still apply.
  if (existing.final_policy_id) {
    const linkedPolicyId = existing.final_policy_id;
    const { data: unlinkedCase, error: unlinkError } = await admin
      .from("life_health_cases")
      .update({ final_policy_id: null })
      .eq("id", caseId)
      .eq("final_policy_id", linkedPolicyId)
      .select("id")
      .maybeSingle<{ id: string }>();

    if (unlinkError) {
      await updateAuditOutcome("blocked", { stage: "unlink_policy", linked_policy_deleted: false });
      return { ok: false, error: `Unable to release the linked issued policy: ${unlinkError.message}` };
    }
    if (!unlinkedCase) {
      await updateAuditOutcome("blocked", { stage: "unlink_policy_conflict", linked_policy_deleted: false });
      return { ok: false, error: "The linked policy changed while preparing deletion. Refresh and try again." };
    }

    const policyDelete = await deleteMasterRecord("policy", linkedPolicyId);
    if (!policyDelete.ok) {
      const { error: restoreError } = await admin
        .from("life_health_cases")
        .update({ final_policy_id: linkedPolicyId })
        .eq("id", caseId)
        .is("final_policy_id", null);

      await updateAuditOutcome(restoreError ? "partial_failure" : "blocked", {
        stage: "linked_policy_delete",
        case_policy_link_restored: !restoreError,
        linked_policy_deleted: false,
      });
      return {
        ok: false,
        error: restoreError
          ? `${policyDelete.error} The case-to-policy link could not be restored automatically; review this case before retrying.`
          : policyDelete.error
      };
    }
  }

  const { error: deleteError } = await admin.from("life_health_cases").delete().eq("id", caseId).is("final_policy_id", null);
  if (deleteError) {
    await updateAuditOutcome("partial_failure", { stage: "case_delete", linked_policy_deleted: Boolean(existing.final_policy_id) });
    const referenced = deleteError.code === "23503" || /foreign key|violates/i.test(deleteError.message);
    return { ok: false, error: referenced ? "Cannot delete this case because another record still references it." : `Unable to delete the case: ${deleteError.message}` };
  }

  const byBucket = new Map<string, string[]>();
  for (const document of documents ?? []) {
    if (!document.storage_bucket || !document.storage_path) continue;
    byBucket.set(document.storage_bucket, [...(byBucket.get(document.storage_bucket) ?? []), document.storage_path]);
  }
  const storageResults = await Promise.allSettled(
    Array.from(byBucket.entries()).map(async ([bucket, paths]) => {
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) throw error;
    }),
  );
  const failedStorageBatches = storageResults.filter(result => result.status === "rejected").length;
  const auditComplete = await updateAuditOutcome(
    failedStorageBatches ? "partial_failure" : "completed",
    {
      deleted_case: true,
      linked_policy_deleted: Boolean(existing.final_policy_id),
      storage_batches: storageResults.length,
      failed_storage_batches: failedStorageBatches,
    },
  );

  revalidatePath("/policies/life-health-cases");
  revalidatePath("/policies");
  if (!auditComplete) return {
    ok: false,
    error: "The case deletion ran, but its audit completion could not be recorded. Contact IT to reconcile before retrying.",
  };
  if (failedStorageBatches) return {
    ok: false,
    error: "The case was deleted, but some document cleanup failed. Contact IT to reconcile remaining files.",
  };
  return { ok: true };
}
