import { NextRequest, NextResponse } from "next/server";
import { authorizePanWorker } from "@/lib/pan-verification-worker-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = authorizePanWorker(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({})) as {
    jobIds?: string[];
    workerSessionId?: string;
    device?: string;
  };
  const workerSessionId = clean(body.workerSessionId, 160);
  const device = clean(body.device, 120);
  const jobIds = Array.isArray(body.jobIds)
    ? body.jobIds.filter((value): value is string => typeof value === "string").slice(0, 10)
    : [];

  if (!workerSessionId) return NextResponse.json({ error: "worker_session_required" }, { status: 400 });
  if (!jobIds.length) return NextResponse.json({ ok: true, jobs: [] });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("heartbeat_pan_verification_jobs", {
    p_job_ids: jobIds,
    p_worker_session_id: workerSessionId,
    p_worker_device: device,
    p_lease_minutes: 5,
  });

  if (error) {
    console.error("PAN verification heartbeat failed", error);
    return NextResponse.json({ error: "heartbeat_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, jobs: Array.isArray(data) ? data : [] });
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}
