import "server-only";

import { headers } from "next/headers";
import { after } from "next/server";
import { processPolicyOcrTrainingBatch } from "@/app/policies/policy-ocr-actions";

export async function schedulePolicyOcrTraining() {
  const secret = process.env.POLICY_OCR_WORKER_SECRET?.trim() || process.env.CRON_SECRET?.trim();
  if (!secret) return;

  const subjectToken = process.env.VERCEL_OIDC_TOKEN
    || (await headers()).get("x-vercel-oidc-token")
    || process.env.GOOGLE_WORKLOAD_IDENTITY_SUBJECT_TOKEN;

  after(async () => {
    const result = await processPolicyOcrTrainingBatch(secret, 1, subjectToken);
    if (!result.ok) console.error("Policy OCR upload follow-up failed", result.error);
  });
}
