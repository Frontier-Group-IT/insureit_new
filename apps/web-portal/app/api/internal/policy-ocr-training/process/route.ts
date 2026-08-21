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

  const configuredBatchSize = Number(process.env.POLICY_OCR_WORKER_BATCH_SIZE ?? "3");
  const batchSize = Math.max(1, Math.min(Number.isFinite(configuredBatchSize) ? Math.trunc(configuredBatchSize) : 3, 3));
  const result = await processPolicyOcrTrainingBatch(
    secret,
    batchSize,
    request.headers.get("x-vercel-oidc-token")
      || process.env.VERCEL_OIDC_TOKEN
      || process.env.GOOGLE_WORKLOAD_IDENTITY_SUBJECT_TOKEN,
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
