"use server";

import { revalidatePath } from "next/cache";
import { hasEffectiveCapability } from "@/lib/effective-permissions";
import { getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyOcrTrainingViewer } from "@/lib/policy-ocr-training-access";
import { createSanitizedTrainingCandidate, type TrainingDatabaseReference, type TrainingProposal } from "@/lib/policy-ocr-training";
import { startPolicyOcrTrainingFromReview } from "./ocr-training-review-actions";

const QUEUE_PATH = "/policies/ocr-training";

type ReviewedTrainingLabel = {
  id: string;
  reviewed_by: string | null;
  parser_id: string | null;
  parser_version: string | null;
  proposal: TrainingProposal | null;
  section_02_reference: Partial<TrainingDatabaseReference> | null;
  insurer_name: string | null;
  policy_product: string | null;
  valid_from: string | null;
  valid_upto: string | null;
  idv: number | null;
  od_premium: number | null;
  tp_premium: number | null;
  cpa_opted: boolean | null;
  cpa_premium: number | null;
  printed_net_premium: number | null;
  printed_gst: number | null;
  printed_gross_premium: number | null;
};

export async function autoFinalizeReviewedPolicyOcrTraining(limit = 50) {
  const admin = createSupabaseAdminClient();
  const { data: completedTasks } = await admin
    .from("policy_ocr_training_review_tasks")
    .select("id,training_label_id,assigned_reviewer_profile_id")
    .eq("status", "completed")
    .not("assigned_reviewer_profile_id", "is", null)
    .limit(Math.max(1, Math.min(limit, 100)))
    .returns<Array<{ id: string; training_label_id: string; assigned_reviewer_profile_id: string }>>();

  const taskResults = await Promise.allSettled(
    (completedTasks ?? []).map((task) => startPolicyOcrTrainingFromReview(task.id, task.assigned_reviewer_profile_id)),
  );
  let finalized = taskResults.filter((result) => result.status === "fulfilled").length;
  let skipped = taskResults.length - finalized;

  const { data: labels, error } = await admin
    .from("policy_ocr_training_labels")
    .select("id,reviewed_by,parser_id,parser_version,proposal,section_02_reference,insurer_name,policy_product,valid_from,valid_upto,idv,od_premium,tp_premium,cpa_opted,cpa_premium,printed_net_premium,printed_gst,printed_gross_premium")
    .eq("status", "reviewed")
    .eq("processing_status", "ready")
    .not("reviewed_by", "is", null)
    .limit(Math.max(1, Math.min(limit, 100)))
    .returns<ReviewedTrainingLabel[]>();
  if (error || !labels?.length) return { attempted: (completedTasks ?? []).length, finalized, skipped };
  for (const label of labels) {
    if (!label.reviewed_by) {
      skipped += 1;
      continue;
    }
    const section02 = label.section_02_reference ?? {};
    const values: TrainingDatabaseReference = {
      vehicle_registration_status: section02.vehicle_registration_status ?? null,
      vehicle_registration_number: section02.vehicle_registration_number ?? null,
      vehicle_class: section02.vehicle_class ?? null,
      vehicle_make: section02.vehicle_make ?? null,
      vehicle_model: section02.vehicle_model ?? null,
      vehicle_fuel_type: section02.vehicle_fuel_type ?? null,
      vehicle_manufacturing_year: section02.vehicle_manufacturing_year ?? null,
      vehicle_capacity: section02.vehicle_capacity ?? null,
      vehicle_chassis_number: section02.vehicle_chassis_number ?? null,
      vehicle_engine_number: section02.vehicle_engine_number ?? null,
      vehicle_rto_name: section02.vehicle_rto_name ?? null,
      vehicle_rto_state: section02.vehicle_rto_state ?? null,
      insurer_name: label.insurer_name,
      policy_product: label.policy_product,
      policy_number: null,
      valid_from: label.valid_from,
      valid_upto: label.valid_upto,
      idv: label.idv,
      od_premium: label.od_premium,
      tp_premium: label.tp_premium,
      cpa_opted: label.cpa_opted,
      cpa_premium: label.cpa_premium,
      printed_net_premium: label.printed_net_premium,
      printed_gst: label.printed_gst,
      printed_gross_premium: label.printed_gross_premium,
    };
    if (
      values.od_premium !== null
      && values.tp_premium !== null
      && values.cpa_premium !== null
      && values.printed_net_premium !== null
      && Math.abs(values.od_premium + values.tp_premium + values.cpa_premium - values.printed_net_premium) > 2
    ) {
      skipped += 1;
      continue;
    }

    const candidate = createSanitizedTrainingCandidate({
      labelId: label.id,
      parserId: label.parser_id,
      parserVersion: label.parser_version,
      values,
      proposal: label.proposal,
    });
    const { data: candidateId, error: approvalError } = await admin.rpc("approve_policy_ocr_training_candidate", {
      p_label_id: label.id,
      p_actor_id: label.reviewed_by,
      p_candidate_payload: candidate,
    });
    if (approvalError || !candidateId) skipped += 1;
    else {
      const { error: queueError } = await admin.rpc("enqueue_policy_ocr_refinement_job", { p_candidate_id: candidateId });
      if (queueError) skipped += 1;
      else finalized += 1;
    }
  }
  return { attempted: labels.length, finalized, skipped };
}

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
