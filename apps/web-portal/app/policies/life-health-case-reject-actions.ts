"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { requirePolicyCreator } from "@/lib/policy-access-server";
import { requireOperationsHeadRecordOwnership } from "@/lib/operations-head-record-authorization";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { recordDailyWorkflowActivity } from "@/lib/daily-workflow-audit";

/** Reject a still-pending case without deleting its customer or documents. */
export async function rejectLifeHealthCase(caseId: string, submittedReason: string):
  Promise<{ ok: true } | { ok: false; error: string }> {
  const reason = submittedReason.trim().replace(/\s+/g, " ");
  if (!caseId) return { ok: false, error: "Case reference is missing." };
  if (!reason || reason.length > 2000) return { ok: false, error: "Enter a rejection reason (maximum 2,000 characters)." };

  const { profile: requester } = await getAuthenticatedProfile(await getServerAccessToken());
  const profile = requester?.role === "operations_head_life"
    ? await requireOperationsHeadRecordOwnership("life_health_case", caseId)
    : await requirePolicyCreator();
  const admin = createSupabaseAdminClient();

  const { data: row, error: loadError } = await admin.from("life_health_cases")
    .select("id,status,final_policy_id,remarks,details")
    .eq("id", caseId).maybeSingle<{
      id: string; status: string; final_policy_id: string | null;
      remarks: string | null; details: Record<string, unknown> | null;
    }>();
  if (loadError || !row) return { ok: false, error: "Case could not be loaded. Refresh and retry." };
  if (row.final_policy_id || row.status === "issued") return { ok: false, error: "Issued cases cannot be rejected." };
  if (row.status === "rejected") return { ok: false, error: "This case is already rejected." };
  if (row.status !== "awaiting_policy" && row.status !== "draft") return { ok: false, error: "Only pending cases can be rejected." };

  const now = new Date().toISOString();
  const timestamp = new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(new Date());
  const entry = `[${timestamp}] Case rejected: ${reason}`;
  const old = row.remarks?.trim() ?? "";
  const remarks = old ? `${old}\n\n${entry}` : entry;
  if (remarks.length > 50000) return { ok: false, error: "The case remarks history is full." };
  const details = {
    ...(row.details ?? {}),
    rejection: { reason, rejected_at: now, rejected_by: profile.id },
  };

  // All conditions are checked in the UPDATE, so concurrent issue/reject/remark
  // requests cannot silently overwrite each other's status or remarks.
  let update = admin.from("life_health_cases")
    .update({ status: "rejected", remarks, details, updated_at: now })
    .eq("id", caseId).eq("status", row.status).is("final_policy_id", null);
  update = row.remarks === null ? update.is("remarks", null) : update.eq("remarks", row.remarks);
  const { data: saved, error: saveError } = await update.select("id").maybeSingle<{ id: string }>();
  if (saveError || !saved) return { ok: false, error: "The case changed in another session. Refresh and try again." };
  await recordDailyWorkflowActivity(admin,{actorId:profile.id,table:"life_health_cases",recordId:caseId,action:"life_health_case_rejected"});

  revalidatePath("/policies/life-health-cases");
  revalidatePath(`/policies/life-health-cases/${caseId}`);
  return { ok: true };
}
