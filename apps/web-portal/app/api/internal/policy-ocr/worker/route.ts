import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { processPolicyOcrTrainingWorkerBatch } from "@/app/policies/policy-ocr-actions";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const expected = process.env.POLICY_OCR_WORKER_SECRET?.trim();
  const provided = request.headers.get("x-insureit-policy-ocr-worker-secret")?.trim() ?? "";
  if (!expected || !provided || !safeEqual(expected, provided)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { limit?: number };
  const result = await processPolicyOcrTrainingWorkerBatch(
    request.headers.get("x-vercel-oidc-token"),
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
