"use server";

import { revalidatePath } from "next/cache";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingOperator, requirePolicyOcrTrainingViewer } from "@/lib/policy-ocr-training-access";
import { sanitizeCandidatePatch } from "@/lib/policy-ocr-orchestrator";

const QUEUE_PATH = "/policies/ocr-training";

async function requireApprovalOperator() {
  const { profile } = await getAuthenticatedProfile(await getServerAccessToken());
  if (!profile?.id || profile.role !== "it_super_user" || !(await hasEffectiveCapability(profile, "approve_policy_ocr_training", "approve"))) {
    throw new Error("IT Super User approval is required.");
  }
  return profile;
}

export async function createPolicyOcrChangeProposal(formData: FormData) {
  const operator = await requirePolicyOcrTrainingOperator();
  const insurer = String(formData.get("insurer") ?? "").trim();
  const product = String(formData.get("product") ?? "").trim();
  const layout = String(formData.get("layout") ?? "").trim();
  const rule = String(formData.get("rule") ?? "").trim();
  const orchestratorId = String(formData.get("orchestrator_id") ?? "").trim();
  if (!insurer || !product || !layout || !rule || !orchestratorId) throw new Error("A bounded insurer/layout candidate is required.");
  const patch = sanitizeCandidatePatch({ insurer, product, layout, rule });
  const admin = createSupabaseAdminClient();
  const { data: run } = await admin.from("policy_ocr_training_orchestrators").select("id,field_accuracy,wrong_financial_count,status").eq("id", orchestratorId).maybeSingle<{ id: string; field_accuracy: number | null; wrong_financial_count: number; status: string }>();
  if (!run) throw new Error("Training iteration not found.");
  if (Number(run.field_accuracy ?? 0) < 0.95 || run.wrong_financial_count > 0 || !["awaiting_it_approval", "awaiting_satisfaction"].includes(run.status)) {
    throw new Error("Candidate changes require the 95% accuracy gate, zero wrong financial values, fresh siblings and a bounded iteration awaiting approval.");
  }
  const { error } = await admin.from("policy_ocr_training_change_proposals").insert({
    orchestrator_id: orchestratorId,
    iteration_no: 1,
    insurer_name: patch.insurer,
    product_family: patch.product,
    layout_family: patch.layout,
    sanitized_patch: patch,
    regression_plan: { required: ["trained_sample", "fresh_sibling_1", "fresh_sibling_2", "fresh_sibling_3"], ci_required: true },
    status: "pending_it_approval",
  });
  if (error) throw new Error("The sanitized candidate could not be stored.");
  revalidatePath(QUEUE_PATH);
  return { ok: true, createdBy: operator.id };
}

export async function approvePolicyOcrChangeProposal(formData: FormData) {
  const operator = await requireApprovalOperator();
  const proposalId = String(formData.get("proposal_id") ?? "").trim();
  if (!proposalId) throw new Error("Candidate proposal reference is missing.");
  const { data, error } = await createSupabaseAdminClient().from("policy_ocr_training_change_proposals")
    .update({ status: "approved", it_approved_by: operator.id, it_approved_at: new Date().toISOString() })
    .eq("id", proposalId).eq("status", "pending_it_approval").select("id").maybeSingle<{ id: string }>();
  if (error || !data) throw new Error("Candidate is not awaiting IT Super User approval.");
  return { ok: true };
}

export async function recordPolicyOcrSatisfaction(formData: FormData) {
  const reviewer = await requirePolicyOcrTrainingViewer();
  const taskId = String(formData.get("review_task_id") ?? "").trim();
  const satisfied = String(formData.get("satisfied") ?? "") === "yes";
  const note = String(formData.get("note") ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
  if (!taskId) throw new Error("Satisfaction task reference is missing.");
  const { data, error } = await createSupabaseAdminClient().from("policy_ocr_training_review_tasks")
    .update({ task_type: "satisfaction", satisfaction_confirmed: satisfied, satisfaction_note: note || null, status: "completed", completed_at: new Date().toISOString() })
    .eq("id", taskId).eq("assigned_reviewer_profile_id", reviewer.profile.id).eq("task_type", "satisfaction")
    .select("id").maybeSingle<{ id: string }>();
  if (error || !data) throw new Error("The satisfaction task could not be recorded.");
  revalidatePath(QUEUE_PATH);
}
