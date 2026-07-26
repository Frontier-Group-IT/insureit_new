import { NextRequest, NextResponse } from "next/server";
import { authorizePanWorker } from "@/lib/pan-verification-worker-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const RESULTS = new Set(["matched", "not_found", "invalid", "failed"]);
const RESULT_MESSAGES: Record<string, string> = {
  matched: "Matching Record Found In DataBase",
  not_found: "No Data Found In POS System",
  invalid: "Invalid PAN format"
};

export async function POST(request: NextRequest) {
  const unauthorized = authorizePanWorker(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as {
    jobId?: string;
    status?: string;
    resultMessage?: string;
    error?: string;
    device?: string;
  } | null;

  const jobId = body?.jobId?.trim();
  const status = body?.status?.trim();
  if (!jobId || !status || !RESULTS.has(status)) {
    return NextResponse.json({ error: "invalid_result" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const resultMessage = clean(body?.resultMessage, 500) || RESULT_MESSAGES[status] || null;
  const lastError = status === "failed" ? clean(body?.error, 1000) || "PAN verification failed" : null;
  const device = clean(body?.device, 120);
  const now = new Date().toISOString();

  const { data: currentJob, error: currentJobError } = await admin
    .from("pan_verification_jobs")
    .select("id, application_id, onboarding_profile_id, pan_number, status")
    .eq("id", jobId)
    .maybeSingle<{
      id: string;
      application_id: string;
      onboarding_profile_id: string | null;
      pan_number: string;
      status: string;
    }>();

  if (currentJobError || !currentJob || currentJob.status !== "checking") {
    return NextResponse.json({ error: "completion_failed" }, { status: 409 });
  }

  const { data: currentProfile, error: profileReadError } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id, partner_type, requested_account_type, pan_number")
    .eq("application_id", currentJob.application_id)
    .maybeSingle<{
      id: string;
      partner_type: "posp" | "misp";
      requested_account_type: "posp" | "misp" | null;
      pan_number: string | null;
    }>();

  if (profileReadError || !currentProfile) {
    return NextResponse.json({ error: "profile_not_found" }, { status: 409 });
  }

  const queuedPan = normalizePan(currentJob.pan_number);
  const livePan = normalizePan(currentProfile.pan_number);
  if (!queuedPan || !livePan || queuedPan !== livePan) {
    await admin
      .from("pan_verification_jobs")
      .update({
        status: "failed",
        result_code: "stale_pan",
        result_message: null,
        last_error: "The applicant PAN changed before this result was returned. A fresh check is required.",
        completed_at: now,
        updated_at: now
      })
      .eq("id", jobId)
      .eq("status", "checking");

    return NextResponse.json({ error: "stale_pan_result" }, { status: 409 });
  }

  const { data: job, error } = await admin
    .from("pan_verification_jobs")
    .update({
      status,
      result_code: status,
      result_message: resultMessage,
      last_error: lastError,
      checked_by_device: device,
      completed_at: now,
      updated_at: now
    })
    .eq("id", jobId)
    .eq("status", "checking")
    .eq("pan_number", currentJob.pan_number)
    .select("application_id, onboarding_profile_id")
    .maybeSingle<{ application_id: string; onboarding_profile_id: string | null }>();

  if (error || !job) {
    console.error("PAN verification completion failed", error);
    return NextResponse.json({ error: "completion_failed" }, { status: 409 });
  }

  if (status === "matched" || status === "not_found") {
    const requestedType = currentProfile.requested_account_type ?? currentProfile.partner_type;
    const routeUpdate = status === "not_found"
      ? {
          iib_remarks: resultMessage,
          requested_account_type: requestedType,
          final_account_type: requestedType,
          partner_decision: "not_applicable",
          partner_decision_at: null,
          partner_decision_by: null,
          partner_decision_remark: null,
          updated_at: now
        }
      : {
          iib_remarks: resultMessage,
          requested_account_type: requestedType,
          final_account_type: null,
          partner_decision: "pending",
          partner_decision_at: null,
          partner_decision_by: null,
          partner_decision_remark: null,
          updated_at: now
        };

    const { error: profileError } = await admin
      .from("posp_misp_onboarding_profiles")
      .update(routeUpdate)
      .eq("id", currentProfile.id)
      .eq("pan_number", currentJob.pan_number);

    if (profileError) {
      console.error("PAN result route update failed", profileError);
      return NextResponse.json({ error: "profile_update_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, applicationId: job.application_id });
}

function normalizePan(value: string | null | undefined) {
  const normalized = value?.replace(/\s/g, "").toUpperCase() ?? "";
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized) ? normalized : null;
}

function clean(value: string | undefined, maxLength: number) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized.slice(0, maxLength) : null;
}
