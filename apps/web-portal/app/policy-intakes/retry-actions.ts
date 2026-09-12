"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { extractPolicyIntakeDocumentTrusted } from "@/lib/policy-intake-ocr-service";
import { requirePolicyIntakeReviewer } from "@/lib/policy-intake-server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

const STALE_OCR_MS = 5 * 60 * 1000;

type RetryableIntake = {
  id: string;
  status: string;
  ocr_status: string;
  created_at: string;
  storage_bucket: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
};

export type RetryPolicyIntakeOcrResult =
  | { ok: true; status: "processing" }
  | { ok: false; error: string };

export function isPolicyIntakeOcrRetryable(input: { status: string; ocrStatus: string; createdAt: string }, now = Date.now()) {
  if (input.status !== "processing") return false;
  if (input.ocrStatus === "failed") return true;
  if (!new Set(["pending", "processing"]).has(input.ocrStatus)) return false;
  const created = new Date(input.createdAt).getTime();
  return Number.isFinite(created) && now - created >= STALE_OCR_MS;
}

export async function retryPolicyIntakeOcr(id: string): Promise<RetryPolicyIntakeOcrResult> {
  await requirePolicyIntakeReviewer();
  const admin = createSupabaseAdminClient();
  const { data: intake, error } = await admin
    .from("policy_intake_requests")
    .select("id,status,ocr_status,created_at,storage_bucket,storage_path,file_name,mime_type")
    .eq("id", id)
    .maybeSingle<RetryableIntake>();

  if (error || !intake) return { ok: false, error: "This policy intake is unavailable. Refresh and try again." };
  if (!isPolicyIntakeOcrRetryable({ status: intake.status, ocrStatus: intake.ocr_status, createdAt: intake.created_at })) {
    return { ok: false, error: "This detail fetch is already running or no longer needs a retry." };
  }

  let claim = admin
    .from("policy_intake_requests")
    .update({ ocr_status: "pending", ocr_warnings: [] })
    .eq("id", id)
    .eq("status", "processing");

  if (intake.ocr_status === "failed") {
    claim = claim.eq("ocr_status", "failed");
  } else {
    const staleBefore = new Date(Date.now() - STALE_OCR_MS).toISOString();
    claim = claim.in("ocr_status", ["pending", "processing"]).lte("created_at", staleBefore);
  }

  const { data: claimed, error: claimError } = await claim.select("id").maybeSingle<{ id: string }>();
  if (claimError || !claimed) {
    return { ok: false, error: "Another retry has already started. Refresh to see the latest status." };
  }

  revalidatePath("/policy-intakes");
  revalidatePath(`/policy-intakes/${id}`);
  after(async () => {
    await processRetry(id, intake.storage_path);
  });
  return { ok: true, status: "processing" };
}

async function processRetry(id: string, expectedStoragePath: string) {
  const admin = createSupabaseAdminClient();
  const { data: intake } = await admin
    .from("policy_intake_requests")
    .select("id,status,ocr_status,storage_bucket,storage_path,file_name,mime_type")
    .eq("id", id)
    .maybeSingle<Omit<RetryableIntake, "created_at">>();

  if (!intake || intake.status !== "processing" || intake.ocr_status !== "pending" || intake.storage_path !== expectedStoragePath) return;

  const { data: started } = await admin
    .from("policy_intake_requests")
    .update({ ocr_status: "processing" })
    .eq("id", id)
    .eq("status", "processing")
    .eq("ocr_status", "pending")
    .eq("storage_path", expectedStoragePath)
    .select("id")
    .maybeSingle<{ id: string }>();
  if (!started) return;

  const { data: blob, error: downloadError } = await admin.storage.from(intake.storage_bucket).download(intake.storage_path);
  if (downloadError || !blob) {
    await markRetryFailure(id, expectedStoragePath, "The stored policy copy could not be read automatically.");
    return;
  }

  try {
    const file = new File([await blob.arrayBuffer()], intake.file_name, { type: intake.mime_type || blob.type || "application/pdf" });
    const formData = new FormData();
    formData.set("policy_document", file);
    const ocr = await extractPolicyIntakeDocumentTrusted(formData);
    if (!ocr.ok) {
      await markRetryFailure(id, expectedStoragePath, ocr.error);
      return;
    }

    await admin
      .from("policy_intake_requests")
      .update({
        status: "ready_for_review",
        ocr_status: "completed",
        ocr_fields: ocr.fields,
        ocr_parser_id: ocr.parserId,
        ocr_parser_version: ocr.parserVersion,
        ocr_warnings: ocr.warnings,
        attention_reason: null,
      })
      .eq("id", id)
      .eq("status", "processing")
      .eq("storage_path", expectedStoragePath);
  } catch {
    await markRetryFailure(id, expectedStoragePath, "Automatic detail fetch failed again. You can retry or continue with manual review.");
  } finally {
    revalidatePath("/policy-intakes");
    revalidatePath(`/policy-intakes/${id}`);
  }
}

async function markRetryFailure(id: string, storagePath: string, message: string) {
  const admin = createSupabaseAdminClient();
  await admin
    .from("policy_intake_requests")
    .update({ ocr_status: "failed", ocr_warnings: [message] })
    .eq("id", id)
    .eq("status", "processing")
    .eq("storage_path", storagePath);
}
