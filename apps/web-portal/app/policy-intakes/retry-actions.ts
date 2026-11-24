"use server";

import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { requirePolicyIntakeReviewer, requirePolicyIntakeViewer } from "@/lib/policy-intake-server";

/** Legacy Google/manual retry is retired. Reprocessing must use the controlled
 * n8n queue and current-PDF verification in AI Policy Studio. */
export type RetryPolicyIntakeOcrResult =
  | { ok: true; status: "processing" }
  | { ok: false; error: string };

export async function getPolicyIntakeOcrRetryState(id: string) {
  await requirePolicyIntakeViewer(id);
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.from("policy_intake_requests")
    .select("ocr_status").eq("id",id)
    .maybeSingle<{ocr_status:string}>();
  if(error||!data)return {ok:false as const,retryable:false,error:"Intake status is unavailable."};
  return {ok:true as const,retryable:false,ocrStatus:data.ocr_status};
}

export async function retryPolicyIntakeOcr(id:string):Promise<RetryPolicyIntakeOcrResult> {
  await requirePolicyIntakeReviewer(id);
  return {ok:false,error:"The old manual OCR retry is retired. Reprocess the current PDF through AI Policy Studio."};
}
