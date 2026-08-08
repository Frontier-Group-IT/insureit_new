"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const path = (applicationId: string) => `/intermediaries/applications/${applicationId}`;

export async function assignIntermediaryTraining(formData: FormData) {
  const applicationId = value(formData, "application_id");
  if (!applicationId) redirect("/customers/posp-misp");
  const reviewer = await requireScopedPospMispManager(applicationId);
  const title = value(formData, "training_title");
  const url = value(formData, "training_url");
  const instructions = value(formData, "training_instructions");
  const deadline = value(formData, "training_deadline");
  if (!reviewer?.id) redirect("/customers/posp-misp");
  if (!title || !validHttpUrl(url)) redirectFresh(`${path(applicationId)}?stage=review&error=training_assignment_invalid`);

  const admin = createSupabaseAdminClient();
  const { data: application } = await admin
    .from("intermediary_onboarding_applications")
    .select("id,requested_type,final_type,registration_status")
    .eq("id", applicationId)
    .maybeSingle<{ id: string; requested_type: "posp" | "misp"; final_type: string | null; registration_status: string }>();
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("workflow_stage")
    .eq("application_id", applicationId)
    .maybeSingle<{ workflow_stage: string }>();

  const allowedStatus = application && ["training_pending", "training_assigned", "training_in_progress", "iib_submission_pending"].includes(application.registration_status);
  const allowedStage = profile && ["training", "completed"].includes(profile.workflow_stage);
  if (!application || !profile || !allowedStatus || !allowedStage || application.final_type === "partner") {
    redirectFresh(`${path(applicationId)}?stage=review&error=training_assignment_locked`);
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("intermediary_training_exam_assignments").upsert({
    application_id: applicationId,
    training_title: title,
    training_url: url,
    training_instructions: instructions,
    training_deadline: deadline,
    training_assigned_at: now,
    training_status: "assigned",
    assigned_by: reviewer.id,
    updated_by: reviewer.id,
    updated_at: now,
  }, { onConflict: "application_id" });
  if (error) redirectFresh(`${path(applicationId)}?stage=review&error=training_assignment_failed`);

  await admin.from("intermediary_onboarding_applications").update({ status: "under_review", registration_status: "training_assigned", completed_at: null, updated_at: now }).eq("id", applicationId);
  await admin.from("posp_misp_onboarding_profiles").update({ workflow_stage: "training", training_status: "assigned", training_start_date: now.slice(0, 10), updated_by: reviewer.id, updated_at: now }).eq("application_id", applicationId);

  revalidatePath(path(applicationId));
  redirectFresh(`${path(applicationId)}?stage=review&success=training_assigned`);
}

export async function updateIntermediaryTrainingStatus(formData: FormData) {
  const applicationId = value(formData, "application_id");
  if (!applicationId) redirect("/customers/posp-misp");
  const reviewer = await requireScopedPospMispManager(applicationId);
  const status = value(formData, "training_status");
  if (!reviewer?.id) redirect("/customers/posp-misp");
  if (!status || !["assigned", "opened", "in_progress", "completed", "expired"].includes(status)) {
    redirectFresh(`${path(applicationId)}?stage=review&error=training_status_invalid`);
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const update: Record<string, unknown> = { training_status: status, updated_by: reviewer.id, updated_at: now };
  if (status === "in_progress") update.training_started_at = now;
  if (status === "completed") update.training_completed_at = now;
  const { error } = await admin.from("intermediary_training_exam_assignments").update(update).eq("application_id", applicationId);
  if (error) redirectFresh(`${path(applicationId)}?stage=review&error=training_status_failed`);

  const registrationStatus = status === "completed" ? "training_completed" : status === "in_progress" ? "training_in_progress" : "training_assigned";
  await admin.from("intermediary_onboarding_applications").update({ registration_status: registrationStatus, updated_at: now }).eq("id", applicationId);
  await admin.from("posp_misp_onboarding_profiles").update({ workflow_stage: "training", training_status: status, training_end_date: status === "completed" ? now.slice(0, 10) : null, updated_by: reviewer.id, updated_at: now }).eq("application_id", applicationId);

  revalidatePath(path(applicationId));
  redirectFresh(`${path(applicationId)}?stage=review&success=training_status_updated`);
}

export async function allotIntermediaryExam(formData: FormData) {
  const applicationId = value(formData, "application_id");
  if (!applicationId) redirect("/customers/posp-misp");
  const reviewer = await requireScopedPospMispManager(applicationId);
  const title = value(formData, "exam_title");
  const url = value(formData, "exam_url");
  const passingPercentage = numberValue(formData, "passing_percentage");
  const maximumAttempts = integerValue(formData, "maximum_attempts");
  const durationMinutes = integerValue(formData, "exam_duration_minutes");
  const availableFrom = value(formData, "exam_available_from");
  const availableUntil = value(formData, "exam_available_until");
  if (!reviewer?.id) redirect("/customers/posp-misp");
  if (!title || !validHttpUrl(url) || passingPercentage === null || passingPercentage <= 0 || passingPercentage > 100 || maximumAttempts === null || maximumAttempts < 1) {
    redirectFresh(`${path(applicationId)}?stage=review&error=exam_allotment_invalid`);
  }

  const admin = createSupabaseAdminClient();
  const { data: assignment } = await admin.from("intermediary_training_exam_assignments")
    .select("training_status")
    .eq("application_id", applicationId)
    .maybeSingle<{ training_status: string }>();
  if (!assignment || assignment.training_status === "not_assigned") redirectFresh(`${path(applicationId)}?stage=review&error=exam_allotment_locked`);

  const now = new Date().toISOString();
  const examStatus = assignment.training_status === "completed" ? "available" : "locked";
  const { error } = await admin.from("intermediary_training_exam_assignments").update({
    exam_title: title,
    exam_url: url,
    passing_percentage: passingPercentage,
    maximum_attempts: maximumAttempts,
    exam_duration_minutes: durationMinutes,
    exam_available_from: availableFrom ? new Date(availableFrom).toISOString() : null,
    exam_available_until: availableUntil ? new Date(availableUntil).toISOString() : null,
    exam_allotted_at: now,
    exam_status: examStatus,
    updated_by: reviewer.id,
    updated_at: now,
  }).eq("application_id", applicationId);
  if (error) redirectFresh(`${path(applicationId)}?stage=review&error=exam_allotment_failed`);

  await admin.from("intermediary_onboarding_applications").update({ registration_status: "exam_allotted", updated_at: now }).eq("id", applicationId);
  await admin.from("posp_misp_onboarding_profiles").update({ exam_status: examStatus, updated_by: reviewer.id, updated_at: now }).eq("application_id", applicationId);

  revalidatePath(path(applicationId));
  redirectFresh(`${path(applicationId)}?stage=review&success=exam_allotted`);
}

export async function updateIntermediaryExamResult(formData: FormData) {
  const applicationId = value(formData, "application_id");
  if (!applicationId) redirect("/customers/posp-misp");
  const reviewer = await requireScopedPospMispManager(applicationId);
  const result = value(formData, "exam_result");
  const score = numberValue(formData, "exam_score");
  if (!reviewer?.id) redirect("/customers/posp-misp");
  if (!result || !["passed", "failed"].includes(result)) redirectFresh(`${path(applicationId)}?stage=review&error=exam_result_invalid`);

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data: assignment } = await admin.from("intermediary_training_exam_assignments")
    .select("exam_attempts_used")
    .eq("application_id", applicationId)
    .maybeSingle<{ exam_attempts_used: number }>();
  if (!assignment) redirectFresh(`${path(applicationId)}?stage=review&error=exam_result_failed`);

  const { error } = await admin.from("intermediary_training_exam_assignments").update({
    exam_status: result,
    exam_score: score,
    exam_attempts_used: (assignment.exam_attempts_used ?? 0) + 1,
    exam_completed_at: now,
    exam_passed_at: result === "passed" ? now : null,
    agreement_status: result === "passed" ? "not_generated" : undefined,
    updated_by: reviewer.id,
    updated_at: now,
  }).eq("application_id", applicationId);
  if (error) redirectFresh(`${path(applicationId)}?stage=review&error=exam_result_failed`);

  await admin.from("intermediary_onboarding_applications").update({ registration_status: result === "passed" ? "agreement_pending" : "exam_failed", updated_at: now }).eq("id", applicationId);
  await admin.from("posp_misp_onboarding_profiles").update({ exam_status: result, updated_by: reviewer.id, updated_at: now }).eq("application_id", applicationId);

  revalidatePath(path(applicationId));
  redirectFresh(`${path(applicationId)}?stage=review&success=${result === "passed" ? "exam_passed" : "exam_failed"}`);
}

function redirectFresh(href: string): never {
  redirect(href);
}

function value(formData: FormData, name: string) {
  const entry = formData.get(name);
  return typeof entry === "string" && entry.trim() ? entry.trim() : null;
}

function numberValue(formData: FormData, name: string) {
  const raw = value(formData, name);
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function integerValue(formData: FormData, name: string) {
  const parsed = numberValue(formData, name);
  return parsed !== null && Number.isInteger(parsed) ? parsed : null;
}

function validHttpUrl(input: string | null) {
  if (!input) return false;
  try {
    const url = new URL(input);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
