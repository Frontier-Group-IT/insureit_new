import { NextRequest, NextResponse } from "next/server";
import { authorizePanWorker } from "@/lib/pan-verification-worker-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const RESULTS = new Set(["matched", "not_found", "invalid", "failed"]);
const RESULT_MESSAGES: Record<string, string> = {
  matched: "Matching Record Found In DataBase",
  not_found: "No Data Found In POS System",
  invalid: "Invalid PAN format",
};

type CompletionBody = {
  jobId?: string;
  status?: string;
  resultMessage?: string;
  error?: string;
  device?: string;
  workerSessionId?: string;
};

type JobRow = {
  id: string;
  application_id: string;
  onboarding_profile_id: string | null;
  pan_number: string;
  status: string;
  worker_session_id: string | null;
  lease_expires_at: string | null;
};

export async function POST(request: NextRequest) {
  const unauthorized = authorizePanWorker(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => null) as CompletionBody | null;
  const jobId = clean(body?.jobId, 80);
  const status = clean(body?.status, 32);
  const workerSessionId = clean(body?.workerSessionId, 160);
  if (!jobId || !status || !RESULTS.has(status) || !workerSessionId) {
    return NextResponse.json({ error: "invalid_result" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const resultMessage = clean(body?.resultMessage, 500) || RESULT_MESSAGES[status] || null;
  const lastError = status === "failed" ? clean(body?.error, 1000) || "PAN verification failed" : null;
  const device = clean(body?.device, 120);
  const now = new Date().toISOString();

  const { data: currentJob, error: currentJobError } = await admin
    .from("pan_verification_jobs")
    .select("id,application_id,onboarding_profile_id,pan_number,status,worker_session_id,lease_expires_at")
    .eq("id", jobId)
    .maybeSingle<JobRow>();

  if (currentJobError) {
    console.error("PAN verification job read failed", currentJobError);
    return NextResponse.json({ error: "completion_failed" }, { status: 500 });
  }
  if (!currentJob) return discarded("job_replaced", null);
  if (currentJob.status !== "checking") return discarded(`job_${currentJob.status}`, currentJob.application_id);
  if (currentJob.worker_session_id !== workerSessionId) return discarded("worker_session_mismatch", currentJob.application_id);
  if (!currentJob.lease_expires_at || new Date(currentJob.lease_expires_at).getTime() < Date.now()) {
    return discarded("lease_expired", currentJob.application_id);
  }

  const { data: currentProfile, error: profileReadError } = await admin
    .from("posp_misp_onboarding_profiles")
    .select("id,partner_type,requested_account_type,pan_number,dp_pan_number")
    .eq("application_id", currentJob.application_id)
    .maybeSingle<{
      id: string;
      partner_type: "posp" | "misp";
      requested_account_type: "posp" | "misp" | null;
      pan_number: string | null;
      dp_pan_number: string | null;
    }>();

  if (profileReadError || !currentProfile) return NextResponse.json({ error: "profile_not_found" }, { status: 409 });

  const queuedPan = normalizePan(currentJob.pan_number);
  const livePan = normalizePan(currentProfile.partner_type === "misp" ? currentProfile.dp_pan_number : currentProfile.pan_number);
  if (!queuedPan || !livePan || queuedPan !== livePan) {
    await admin.from("pan_verification_jobs").update({
      status: "failed",
      result_code: "stale_pan",
      result_message: null,
      last_error: "The PAN changed before this result was returned. A fresh check is required.",
      completed_at: now,
      worker_session_id: null,
      lease_expires_at: null,
      updated_at: now,
    }).eq("id", jobId).eq("status", "checking").eq("worker_session_id", workerSessionId);
    return discarded("stale_pan_result", currentJob.application_id);
  }

  const { data: job, error } = await admin.from("pan_verification_jobs").update({
    status,
    result_code: status,
    result_message: resultMessage,
    last_error: lastError,
    checked_by_device: device,
    completed_at: now,
    worker_session_id: null,
    lease_expires_at: null,
    last_worker_heartbeat_at: now,
    updated_at: now,
  })
    .eq("id", jobId)
    .eq("status", "checking")
    .eq("worker_session_id", workerSessionId)
    .eq("pan_number", currentJob.pan_number)
    .gte("lease_expires_at", now)
    .select("application_id,onboarding_profile_id")
    .maybeSingle<{ application_id: string; onboarding_profile_id: string | null }>();

  if (error) {
    console.error("PAN verification completion failed", error);
    return NextResponse.json({ error: "completion_failed" }, { status: 500 });
  }
  if (!job) return discarded("job_state_changed", currentJob.application_id);

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
          updated_at: now,
        }
      : {
          iib_remarks: resultMessage,
          requested_account_type: requestedType,
          final_account_type: null,
          partner_decision: "pending",
          partner_decision_at: null,
          partner_decision_by: null,
          partner_decision_remark: null,
          updated_at: now,
        };

    let profileUpdate = admin.from("posp_misp_onboarding_profiles").update(routeUpdate).eq("id", currentProfile.id);
    profileUpdate = currentProfile.partner_type === "misp"
      ? profileUpdate.eq("dp_pan_number", currentJob.pan_number)
      : profileUpdate.eq("pan_number", currentJob.pan_number);
    const { error: profileError } = await profileUpdate;
    if (profileError) {
      console.error("PAN result route update failed", profileError);
      return NextResponse.json({ error: "profile_update_failed" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, applied: true, applicationId: job.application_id });
}

function discarded(reason: string, applicationId: string | null) {
  return NextResponse.json({ ok: true, applied: false, discarded: true, reason, applicationId });
}

function normalizePan(value: string | null | undefined) {
  const normalized = value?.replace(/\s/g, "").toUpperCase() ?? "";
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(normalized) ? normalized : null;
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}
