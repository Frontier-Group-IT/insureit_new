import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processPolicyOcrTrainingOrchestratorBatch } from "@/app/policies/policy-ocr-actions";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expected = process.env.POLICY_OCR_WORKER_SECRET?.trim();
  const provided = request.headers.get("x-insureit-policy-ocr-worker-secret")?.trim() ?? "";
  if (!expected || !provided || !safeEqual(expected, provided)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (process.env.POLICY_OCR_ORCHESTRATOR_ENABLED !== "true") {
    return NextResponse.json({ error: "orchestrator_disabled" }, { status: 503 });
  }
  const body = await request.json().catch(() => ({})) as { limit?: number; orchestrator_id?: string };
  const orchestratorId = body.orchestrator_id?.trim() || process.env.POLICY_OCR_ORCHESTRATOR_ID?.trim();
  if (!orchestratorId) return NextResponse.json({ error: "orchestrator_id_missing" }, { status: 503 });
  const admin = createSupabaseAdminClient();
  const { data: run } = await admin.from("policy_ocr_training_orchestrators").select("id,status").eq("id", orchestratorId).maybeSingle<{ id: string; status: string }>();
  if (!run || run.status !== "running") return NextResponse.json({ error: "orchestrator_not_running" }, { status: 409 });
  const result = await processPolicyOcrTrainingOrchestratorBatch(
    request.headers.get("x-vercel-oidc-token"),
    orchestratorId,
    Number.isFinite(Number(body.limit)) ? Number(body.limit) : 2,
  );
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.error === "claim_failed" ? 500 : 503 });
  }
  return NextResponse.json(result);
}

function safeEqual(left: string, right: string) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
