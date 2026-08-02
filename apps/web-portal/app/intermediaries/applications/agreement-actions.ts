"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const applicationPath = (id: string) => `/intermediaries/applications/${id}`;

export async function sendIntermediaryAgreement(formData: FormData) {
  const applicationId = text(formData, "application_id");
  if (!applicationId) redirect("/customers/posp-misp");
  const reviewer = await requireScopedPospMispManager(applicationId);
  const signingUrl = text(formData, "agreement_signing_url");
  if (!reviewer?.id) redirect("/customers/posp-misp");
  if (!validHttpUrl(signingUrl)) redirectFresh(`${applicationPath(applicationId)}?stage=review&error=agreement_url_invalid`);

  const admin = createSupabaseAdminClient();
  const { data: assignment } = await admin.from("intermediary_training_exam_assignments")
    .select("exam_status")
    .eq("application_id", applicationId)
    .maybeSingle<{ exam_status: string }>();
  if (!assignment || assignment.exam_status !== "passed") redirectFresh(`${applicationPath(applicationId)}?stage=review&error=agreement_locked`);

  const now = new Date().toISOString();
  const { error } = await admin.from("intermediary_training_exam_assignments").update({
    agreement_status: "sent",
    agreement_signing_url: signingUrl,
    agreement_sent_at: now,
    agreement_opened_at: null,
    agreement_signed_at: null,
    updated_by: reviewer.id,
    updated_at: now,
  }).eq("application_id", applicationId);
  if (error) redirectFresh(`${applicationPath(applicationId)}?stage=review&error=agreement_send_failed`);

  await admin.from("intermediary_onboarding_applications").update({ registration_status: "agreement_sent", updated_at: now }).eq("id", applicationId);
  revalidatePath(applicationPath(applicationId));
  revalidatePath("/intermediary-portal");
  redirectFresh(`${applicationPath(applicationId)}?stage=review&success=agreement_sent`);
}

export async function updateIntermediaryAgreementStatus(formData: FormData) {
  const applicationId = text(formData, "application_id");
  if (!applicationId) redirect("/customers/posp-misp");
  const reviewer = await requireScopedPospMispManager(applicationId);
  const status = text(formData, "agreement_status");
  if (!reviewer?.id) redirect("/customers/posp-misp");
  if (!status || !["sent", "opened", "signed", "declined", "expired", "failed"].includes(status)) {
    redirectFresh(`${applicationPath(applicationId)}?stage=review&error=agreement_status_invalid`);
  }

  const admin = createSupabaseAdminClient();
  const { data: assignment } = await admin.from("intermediary_training_exam_assignments")
    .select("exam_status,agreement_signing_url,agreement_opened_at")
    .eq("application_id", applicationId)
    .maybeSingle<{ exam_status: string; agreement_signing_url: string | null; agreement_opened_at: string | null }>();
  if (!assignment || assignment.exam_status !== "passed" || !assignment.agreement_signing_url) {
    redirectFresh(`${applicationPath(applicationId)}?stage=review&error=agreement_locked`);
  }

  const now = new Date().toISOString();
  const update: Record<string, unknown> = { agreement_status: status, updated_by: reviewer.id, updated_at: now };
  if (status === "opened" && !assignment.agreement_opened_at) update.agreement_opened_at = now;
  if (status === "signed") {
    update.agreement_opened_at = assignment.agreement_opened_at ?? now;
    update.agreement_signed_at = now;
  }
  const { error } = await admin.from("intermediary_training_exam_assignments").update(update).eq("application_id", applicationId);
  if (error) redirectFresh(`${applicationPath(applicationId)}?stage=review&error=agreement_status_failed`);

  const registrationStatus = status === "signed" ? "agreement_signed" : status === "sent" || status === "opened" ? "agreement_sent" : "agreement_pending";
  await admin.from("intermediary_onboarding_applications").update({ registration_status: registrationStatus, updated_at: now }).eq("id", applicationId);
  revalidatePath(applicationPath(applicationId));
  revalidatePath("/intermediary-portal");
  redirectFresh(`${applicationPath(applicationId)}?stage=review&success=${status === "signed" ? "agreement_signed" : "agreement_status_updated"}`);
}

function redirectFresh(href: string): never {
  redirect(`${href}${href.includes("?") ? "&" : "?"}fresh=${Date.now()}`);
}

function text(formData: FormData, key: string) {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function validHttpUrl(value: string | null) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}
