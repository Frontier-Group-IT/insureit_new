import { NextRequest, NextResponse } from "next/server";
import { authorizePanWorker } from "@/lib/pan-verification-worker-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = authorizePanWorker(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({})) as {
    limit?: number;
    device?: string;
    workerSessionId?: string;
  };
  const limit = Math.max(1, Math.min(Number(body.limit) || 3, 10));
  const device = clean(body.device, 120);
  const workerSessionId = clean(body.workerSessionId, 160);
  if (!workerSessionId) return NextResponse.json({ error: "worker_session_required" }, { status: 400 });

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_pan_verification_jobs", {
    p_limit: limit,
    p_worker_device: device,
    p_worker_session_id: workerSessionId,
    p_lease_minutes: 5,
  });

  if (error) {
    console.error("PAN verification claim failed", error);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  return NextResponse.json({ jobs: Array.isArray(data) ? data : [] });
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : null;
}
