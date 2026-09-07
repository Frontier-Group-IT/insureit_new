"use server";

import { revalidatePath } from "next/cache";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingViewer } from "@/lib/policy-ocr-training-access";
import { sanitizeCandidatePatch } from "@/lib/policy-ocr-orchestrator";

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

export async function createPolicyOcrProposalFromFeedback(formData: FormData) {
  await requireApprovalOperator();
  const taskId = String(formData.get("review_task_id") ?? "").trim();
  if (!taskId) throw new Error("Completed reviewer task reference is missing.");
  const admin = createSupabaseAdminClient();
  const { data: task } = await admin.from("policy_ocr_training_review_tasks")
    .select("id,status,task_type,structured_feedback,orchestrator_id,sample_id")
    .eq("id", taskId).maybeSingle<{ id: string; status: string; task_type: string; structured_feedback: Record<string, { answer: string; correctValue: string | null }> | null; orchestrator_id: string | null; sample_id: string | null }>();
  if (!task || task.status !== "completed" || task.task_type !== "comparison" || !task.structured_feedback || !task.orchestrator_id) {
    throw new Error("Only completed structured comparison feedback can generate a proposal.");
  }
  const { data: sample } = task.sample_id
    ? await admin.from("policy_ocr_training_samples").select("insurer_name,product_family,layout_family").eq("id", task.sample_id).maybeSingle<{ insurer_name: string | null; product_family: string | null; layout_family: string | null }>()
    : { data: null };
  const candidate = Object.entries(task.structured_feedback).find(([, answer]) => answer.answer === "provide_correct_value" && answer.correctValue);
  if (!candidate) throw new Error("Feedback does not contain a corrected value; no candidate is generated.");
  const patch = sanitizeCandidatePatch({
    insurer: sample?.insurer_name ?? "Unknown insurer",
    product: sample?.product_family ?? "Unknown product",
    layout: sample?.layout_family ?? "unknown_layout",
    rule: `${candidate[0]} requires an insurer/layout-specific correction confirmed by reviewer feedback; exact value remains in the protected task.`,
  });
  const { data: proposal, error } = await admin.from("policy_ocr_training_change_proposals").insert({
    orchestrator_id: task.orchestrator_id, iteration_no: 1, insurer_name: patch.insurer,
    product_family: patch.product, layout_family: patch.layout, sanitized_patch: patch,
    regression_plan: { source: "completed_structured_reviewer_feedback", required: ["trained_sample", "fresh_sibling_1", "fresh_sibling_2", "fresh_sibling_3"], ci_required: true },
    status: "pending_it_approval",
  }).select("id").single<{ id: string }>();
  if (error || !proposal) throw new Error("The sanitized feedback proposal could not be stored.");
  await dispatchCandidateValidationIfConfigured(proposal.id, patch);
  revalidatePath(QUEUE_PATH);
}

export async function approvePolicyOcrChangeProposal(formData: FormData) {
  const operator = await requireApprovalOperator();
  const proposalId = String(formData.get("proposal_id") ?? "").trim();
  if (!proposalId) throw new Error("Candidate proposal reference is missing.");
  const { data, error } = await createSupabaseAdminClient().from("policy_ocr_training_change_proposals")
    .update({ status: "approved", it_approved_by: operator.id, it_approved_at: new Date().toISOString() })
    .eq("id", proposalId).eq("status", "pending_it_approval").select("id").maybeSingle<{ id: string }>();
  if (error || !data) throw new Error("Candidate is not awaiting IT Super User approval.");
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

async function dispatchCandidateValidationIfConfigured(proposalId: string, patch: Record<string, string>) {
  const token = process.env.POLICY_OCR_GITHUB_APP_TOKEN?.trim();
  const repository = process.env.POLICY_OCR_GITHUB_REPOSITORY?.trim();
  if (!token || !repository || !/^[^/\s]+\/[^/\s]+$/.test(repository)) return false;
  const response = await fetch(`https://api.github.com/repos/${repository}/actions/workflows/policy-ocr-training-candidate.yml/dispatches`, {
    method: "POST",
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ ref: "main", inputs: { candidate_json: JSON.stringify({ proposal_id: proposalId, ...patch }) } }),
    cache: "no-store",
  });
  return response.ok;
}
