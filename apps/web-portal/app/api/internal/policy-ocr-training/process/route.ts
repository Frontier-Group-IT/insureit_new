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

  const result = await processPolicyOcrTrainingBatch(
    secret,
    3,
    request.headers.get("x-vercel-oidc-token")
      || process.env.VERCEL_OIDC_TOKEN
      || process.env.GOOGLE_WORKLOAD_IDENTITY_SUBJECT_TOKEN,
  );
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
