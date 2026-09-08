"use server";

import { revalidatePath } from "next/cache";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingViewer } from "@/lib/policy-ocr-training-access";

const QUEUE_PATH = "/policies/ocr-training";

async function requireApprovalOperator() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || profile.role !== "it_super_user" || !(await hasEffectiveCapability(profile, "approve_policy_ocr_training", "approve"))) {
    throw new Error("IT Super User approval is required.");
  }
  return profile;
}

export async function createPolicyOcrTrainingRun() {
  const operator = await requireApprovalOperator();
  const { data, error } = await createSupabaseAdminClient().from("policy_ocr_training_orchestrators")
    .insert({ status: "planned", created_by: operator.id }).select("id").single<{ id: string }>();
  if (error || !data) throw new Error("The planned OCR training iteration could not be created.");
  revalidatePath(QUEUE_PATH);
}

export async function startPolicyOcrTrainingRun(formData: FormData) {
  await requireApprovalOperator();
  const id = String(formData.get("orchestrator_id") ?? "").trim();
  if (!id) throw new Error("Training iteration reference is missing.");
  const { data, error } = await createSupabaseAdminClient().from("policy_ocr_training_orchestrators")
    .update({ status: "running", lease_token: crypto.randomUUID(), lease_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString() })
    .eq("id", id).eq("status", "planned").select("id").maybeSingle<{ id: string }>();
  if (error || !data) throw new Error("Only a planned iteration can be started.");
  revalidatePath(QUEUE_PATH);
}

export async function stopPolicyOcrTrainingRun(formData: FormData) {
  await requireApprovalOperator();
  const id = String(formData.get("orchestrator_id") ?? "").trim();
  if (!id) throw new Error("Training iteration reference is missing.");
  const { data, error } = await createSupabaseAdminClient().from("policy_ocr_training_orchestrators")
    .update({ status: "stopped", lease_token: null, lease_expires_at: null, operator_override: "stopped_by_it_super_user" })
    .eq("id", id).in("status", ["planned", "running", "paused"]).select("id").maybeSingle<{ id: string }>();
  if (error || !data) throw new Error("The iteration is not in a stoppable state.");
  revalidatePath(QUEUE_PATH);
}

export async function recordPolicyOcrSatisfaction(formData: FormData) {
  const reviewer = await requirePolicyOcrTrainingViewer();
  const taskId = String(formData.get("review_task_id") ?? "").trim();
  const satisfied = String(formData.get("satisfied") ?? "") === "yes";
  const note = String(formData.get("note") ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!taskId) throw new Error("Satisfaction task reference is missing.");
  const { data, error } = await createSupabaseAdminClient().from("policy_ocr_training_review_tasks")
    .update({ satisfaction_confirmed: satisfied, satisfaction_note: note || null, status: "completed", completed_at: new Date().toISOString() })
    .eq("id", taskId).eq("assigned_reviewer_profile_id", reviewer.profile.id).eq("task_type", "satisfaction")
    .select("id").maybeSingle<{ id: string }>();
  if (error || !data) throw new Error("The satisfaction task could not be recorded.");
  revalidatePath(QUEUE_PATH);
}
