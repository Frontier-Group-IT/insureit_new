"use server";

import { requireMasterDataManager } from "@/lib/master-data-server";

const MAX_FILE_SIZE = 15 * 1024 * 1024;
const ALLOWED_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export type PolicyOcrField = {
  key: string;
  label: string;
  value: string;
  confidence: number | null;
  page: number | null;
};

export type PolicyOcrResult =
  | { ok: true; fields: PolicyOcrField[]; model: string; warnings: string[] }
  | { ok: false; error: string };

export async function extractPolicyDocument(formData: FormData): Promise<PolicyOcrResult> {
  await requireMasterDataManager();

  const file = formData.get("policy_document");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Select a policy PDF or image." };
  if (!ALLOWED_TYPES.has(file.type)) return { ok: false, error: "Only PDF, JPG, PNG and WebP policy copies are supported." };
  if (file.size > MAX_FILE_SIZE) return { ok: false, error: "The policy document must be 15 MB or smaller." };

  const serviceUrl = process.env.POLICY_OCR_SERVICE_URL?.replace(/\/$/, "");
  const serviceSecret = process.env.POLICY_OCR_SERVICE_SECRET;
  if (!serviceUrl || !serviceSecret) {
    return { ok: false, error: "Policy OCR service is not configured on this environment." };
  }

  const body = new FormData();
  body.append("file", file, file.name);
  body.append("schema", "indian_motor_policy_v1");

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 180_000);
  try {
    const response = await fetch(`${serviceUrl}/v1/policy/extract`, {
      method: "POST",
      headers: { Authorization: `Bearer ${serviceSecret}` },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => null) as {
      fields?: Array<{ key?: unknown; label?: unknown; value?: unknown; confidence?: unknown; page?: unknown }>;
      model?: unknown;
      warnings?: unknown;
      error?: unknown;
    } | null;

    if (!response.ok) {
      const message = typeof payload?.error === "string" ? payload.error : `OCR service returned ${response.status}.`;
      return { ok: false, error: message };
    }

    const fields = (payload?.fields ?? [])
      .map((field) => ({
        key: clean(field.key, 80),
        label: clean(field.label, 120),
        value: clean(field.value, 1000),
        confidence: typeof field.confidence === "number" && Number.isFinite(field.confidence) ? Math.max(0, Math.min(1, field.confidence)) : null,
        page: typeof field.page === "number" && Number.isInteger(field.page) && field.page > 0 ? field.page : null,
      }))
      .filter((field): field is PolicyOcrField => Boolean(field.key && field.label && field.value));

    if (!fields.length) return { ok: false, error: "No supported policy fields could be extracted from this document." };

    return {
      ok: true,
      fields,
      model: clean(payload?.model, 120) || "PaddleOCR",
      warnings: Array.isArray(payload?.warnings) ? payload.warnings.map((item) => clean(item, 300)).filter(Boolean) as string[] : [],
    };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") return { ok: false, error: "Policy OCR timed out. Try a smaller or clearer document." };
    console.error("Policy OCR request failed", error);
    return { ok: false, error: "Policy OCR service could not be reached." };
  } finally {
    clearTimeout(timeout);
  }
}

function clean(value: unknown, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : "";
}
