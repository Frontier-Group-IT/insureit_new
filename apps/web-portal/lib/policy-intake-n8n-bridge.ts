import "server-only";
import { validateN8nPolicyIntakeResponse, type N8nOcrBridgeInput, type N8nOcrBridgeResponse } from "@/lib/policy-intake-n8n-validation";
export { validateN8nPolicyIntakeResponse } from "@/lib/policy-intake-n8n-validation";
export type { N8nOcrField, N8nOcrBridgeInput, N8nOcrBridgeResponse } from "@/lib/policy-intake-n8n-validation";

const EXPECTED_N8N_ORIGIN = "https://insureit.app.n8n.cloud";
const EXPECTED_WEBHOOK_PATH = "/webhook/insureit-policy-intake-icici-v1";
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Opt-in server-only adapter. Not called by the current Policy Intake pipeline.
 * Enable only after per-intake authorization, original document revision checks,
 * a configured n8n Header Auth credential, and approved feature-flag rollout.
 */
export async function requestN8nPolicyIntakeExtraction(
  input: N8nOcrBridgeInput, signal?: AbortSignal,
): Promise<N8nOcrBridgeResponse> {
  if (![input.intakeId, input.documentId, input.requestId].every((id) => UUID.test(id)))
    throw new Error("n8n_request_identifier_invalid");
  if (!(input.file instanceof File) || input.file.type !== "application/pdf"
      || !input.file.size || input.file.size > MAX_FILE_BYTES) throw new Error("n8n_file_invalid");
  const configuredUrl = process.env.INSUREIT_N8N_OCR_WEBHOOK_URL;
  const secret = process.env.INSUREIT_N8N_OCR_HEADER_SECRET;
  if (!configuredUrl || !secret || secret.length < 32) throw new Error("n8n_bridge_not_configured");
  const url = new URL(configuredUrl);
  if (url.origin !== EXPECTED_N8N_ORIGIN || url.pathname !== EXPECTED_WEBHOOK_PATH
      || url.search || url.hash || url.username || url.password) throw new Error("n8n_webhook_url_not_allowed");

  const form = new FormData();
  form.set("intake_id", input.intakeId);
  form.set("document_id", input.documentId);
  form.set("request_id", input.requestId);
  form.set("data", input.file, input.file.name);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "x-insureit-policy-intake-secret": secret },
      body: form,
      cache: "no-store",
      signal: controller.signal,
      redirect: "error",
    });
    if (!response.ok) throw new Error("n8n_bridge_http_failure");
    const payload: unknown = await response.json();
    return validateN8nPolicyIntakeResponse(payload, input);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}
