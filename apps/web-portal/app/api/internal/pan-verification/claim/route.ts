import { NextRequest, NextResponse } from "next/server";
import { authorizePanWorker } from "@/lib/pan-verification-worker-auth";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unauthorized = authorizePanWorker(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({})) as { limit?: number; device?: string };
  const limit = Math.max(1, Math.min(Number(body.limit) || 20, 100));
  const device = typeof body.device === "string" ? body.device.trim().slice(0, 120) : null;
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin.rpc("claim_pan_verification_jobs", {
    p_limit: limit,
    p_worker_device: device
  });

  if (error) {
    console.error("PAN verification claim failed", error);
    return NextResponse.json({ error: "claim_failed" }, { status: 500 });
  }

  return NextResponse.json({ jobs: Array.isArray(data) ? data : [] });
}
