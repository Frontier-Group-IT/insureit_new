"use server";

import { requirePolicyIntakeFinalizer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type PolicyIntakePolicyCopyState =
  | { ok: true; intakeId: string; documentId: string; fileName: string }
  | { ok: false; error: string };

export async function verifyPolicyIntakeCurrentPolicyCopy(id: string): Promise<PolicyIntakePolicyCopyState> {
  const profile = await requirePolicyIntakeFinalizer();
  const intakeId = id.trim();
  if (!intakeId) return { ok: false, error: "Policy Intake reference is missing." };

  const admin = createSupabaseAdminClient();
  const { data: intake, error: intakeError } = await admin
    .from("policy_intake_requests")
    .select("id,status,assigned_to_profile_id,storage_bucket,storage_path")
    .eq("id", intakeId)
    .maybeSingle<{ id: string; status: string; assigned_to_profile_id: string | null; storage_bucket: string; storage_path: string }>();

  if (intakeError || !intake) return { ok: false, error: "Policy Intake is unavailable." };
  if (intake.status !== "in_review" || intake.assigned_to_profile_id !== profile.id) {
    return { ok: false, error: "This Policy Intake is not assigned to you for finalization." };
  }

  const { data: document, error: documentError } = await admin
    .from("policy_intake_documents")
    .select("id,file_name,storage_bucket,storage_path")
    .eq("intake_id", intakeId)
    .eq("is_current", true)
    .maybeSingle<{ id: string; file_name: string; storage_bucket: string; storage_path: string }>();

  if (documentError || !document || !document.storage_bucket?.trim() || !document.storage_path?.trim()) {
    return { ok: false, error: "The current Policy Intake copy is unavailable. Upload or restore the policy copy before finalizing." };
  }

  if (document.storage_bucket !== intake.storage_bucket || document.storage_path !== intake.storage_path) {
    return { ok: false, error: "The current Policy Intake copy changed. Reload the intake before finalizing." };
  }

  return { ok: true, intakeId, documentId: document.id, fileName: document.file_name };
}
