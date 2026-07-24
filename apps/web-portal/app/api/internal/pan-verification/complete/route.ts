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
    .select("application_id, onboarding_profile_id")
    .maybeSingle<{ application_id: string; onboarding_profile_id: string | null }>();

  if (error || !job) {
    console.error("PAN verification completion failed", error);
    return NextResponse.json({ error: "completion_failed" }, { status: 409 });
  }

  if (status === "matched" || status === "not_found") {
    await admin
      .from("posp_misp_onboarding_profiles")
      .update({
        iib_remarks: resultMessage,
        updated_at: now
      })
      .eq("application_id", job.application_id);
  }

  return NextResponse.json({ ok: true, applicationId: job.application_id });
}

function clean(value: string | undefined, maxLength: number) {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized ? normalized.slice(0, maxLength) : null;
}
