import { NextRequest, NextResponse } from "next/server";
import { processPolicyOcrTrainingBatch } from "@/app/policies/policy-ocr-actions";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  const secret = process.env.POLICY_OCR_WORKER_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  const authorization = request.headers.get("authorization");
  if (!secret || authorization !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const configuredBatchSize = Number(process.env.POLICY_OCR_WORKER_BATCH_SIZE ?? "2");
  const batchSize = Math.max(1, Math.min(Number.isFinite(configuredBatchSize) ? Math.trunc(configuredBatchSize) : 2, 2));
  const result = await processPolicyOcrTrainingBatch(
    secret,
    batchSize,
    request.headers.get("x-vercel-oidc-token"),
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
