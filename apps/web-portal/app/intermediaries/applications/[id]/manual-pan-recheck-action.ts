"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireScopedPospMispManager } from "@/lib/master-data-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const PAN_PATTERN = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

export async function manuallyRecheckIibPan(data: FormData) {
  const applicationId = value(data, "application_id");
  if (!applicationId) redirect("/intermediaries/partner");

  const actor = await requireScopedPospMispManager(applicationId);
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id,partner_type,pan_number,dp_pan_number")
    .eq("application_id", applicationId)
    .maybeSingle<{
      id: string;
      partner_type: "posp" | "misp";
      pan_number: string | null;
      dp_pan_number: string | null;
    }>();

  const panNumber = (profile?.partner_type === "misp" ? profile.dp_pan_number : profile?.pan_number)
    ?.replace(/\s/g, "")
    .toUpperCase() ?? "";

  if (!profile?.id || !PAN_PATTERN.test(panNumber)) {
    redirectWith(applicationId, "pan_verification_invalid");
  }

  const now = new Date().toISOString();
  const { error: profileError } = await admin
    .from("posp_misp_onboarding_profiles")
    .update({
      iib_remarks: null,
      iib_upload_status: "pending",
      iib_uploaded: false,
      iib_uploaded_at: null,
      iib_completed_at: null,
      updated_by: actor.id,
      updated_at: now,
    })
    .eq("id", profile.id);

  if (profileError) redirectWith(applicationId, "pan_verification_reset_failed");

  const { error: jobError } = await admin.from("pan_verification_jobs").upsert({
    application_id: applicationId,
    onboarding_profile_id: profile.id,
    partner_type: profile.partner_type,
    pan_number: panNumber,
    status: "pending",
    result_code: null,
    result_message: null,
    requested_at: now,
    started_at: null,
    completed_at: null,
    attempt_count: 0,
    last_error: null,
    checked_by_device: null,
    requested_by: actor.id,
    override_reason: null,
    overridden_by: null,
    overridden_at: null,
    worker_session_id: null,
    lease_expires_at: null,
    last_worker_heartbeat_at: null,
    updated_at: now,
  }, { onConflict: "application_id" });

  if (jobError) redirectWith(applicationId, "pan_verification_queue_failed");

  revalidatePath(`/intermediaries/applications/${applicationId}`);
  redirect(`/intermediaries/applications/${applicationId}?success=pan_verification_requeued&fresh=${Date.now()}`);
}

function value(data: FormData, key: string) {
  const current = data.get(key);
  return typeof current === "string" && current.trim() ? current.trim() : null;
}

function redirectWith(applicationId: string, error: string): never {
  redirect(`/intermediaries/applications/${applicationId}?error=${error}&fresh=${Date.now()}`);
}
