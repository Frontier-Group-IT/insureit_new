import "server-only";
import { verifyTataAigSigningDateEvidence } from "@/lib/policy-issuance-signature-evidence";
import { validateN8nPolicyIntakeResponse, type N8nOcrBridgeInput, type N8nOcrBridgeResponse } from "@/lib/policy-intake-n8n-validation";
export { validateN8nPolicyIntakeResponse } from "@/lib/policy-intake-n8n-validation";
export type { N8nOcrField, N8nOcrBridgeInput, N8nOcrBridgeResponse, N8nVerifiedPremiumBreakdown } from "@/lib/policy-intake-n8n-validation";

const EXPECTED_N8N_ORIGIN = "https://insureit.app.n8n.cloud";
// Approved prospective dedicated webhook hostname. A Cloudflare Tunnel,
// working HTTPS and n8n Header Auth MUST be configured before opting in.
// Never accept arbitrary n8n URLs from a request or environment variable.
const SELF_HOSTED_N8N_ORIGIN = "https://n8n.nishant.uk";
const EXPECTED_WEBHOOK_PATH = "/webhook/insureit-policy-intake-icici-v1";
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const TRUSTED_STORAGE_ORIGIN = "https://ilzhsfqqjyppzzvfscmh.supabase.co";
const SIGNED_OBJECT_PREFIX = "/storage/v1/object/sign/policy-documents/intakes/";

/** Only inspect already-authorized current private objects; never persist bytes. */
async function readEvidencePdf(url: URL): Promise<Uint8Array | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, {cache:"no-store",redirect:"error",signal:controller.signal});
    if(!response.ok || (response.headers.get("content-type")??"").includes("text/html")) return null;
    const declared=Number(response.headers.get("content-length")??0);
    if(declared>MAX_FILE_BYTES) return null;
    const reader=response.body?.getReader();
    if(!reader)return null;
    let size=0;
    const chunks:Uint8Array[]=[];
    for(;;) {
      const {done,value}=await reader.read();
      if(done)break;
      size+=value.byteLength;
      if(size>MAX_FILE_BYTES) {await reader.cancel();return null;}
      chunks.push(value);
    }
    const bytes=new Uint8Array(size);
    let offset=0;
    for(const chunk of chunks) {bytes.set(chunk,offset);offset+=chunk.byteLength;}
    return bytes;
  } catch {return null;}
  finally {clearTimeout(timer);}
}
async function attachSigningProposal(extraction:N8nOcrBridgeResponse,pdf:Uint8Array|null):Promise<N8nOcrBridgeResponse> {
  if(!pdf || !extraction.parserId.startsWith("tata_aig_") || !extraction.receiptDate) return extraction;
  const issuanceEvidence=await verifyTataAigSigningDateEvidence(pdf,extraction.receiptDate);
  return issuanceEvidence?{...extraction,issuanceEvidence}:extraction;
}

// Preserve only the HTTP status, never webhook response bodies, URLs,
// authentication headers, PDF bytes or customer details.
function assertN8nHttpSuccess(response: Response): void {
  if (response.ok) return;
  const code = Number.isInteger(response.status) && response.status >= 400
    && response.status <= 599 ? response.status : 0;
  throw new Error("n8n_bridge_http_failure_" + code);
}


/** Signed source is issued only by our server after checking the current private document. */
export type N8nSignedSourceInput = Pick<N8nOcrBridgeInput, "intakeId" | "documentId" | "requestId"> & {
  signedUrl: string;
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * The site mints a one-object short-lived Supabase Storage link; n8n itself
 * retrieves the PDF. Never accept arbitrary user-supplied fetch destinations.
 * A signed URL is a temporary bearer secret: do not log or show it in UI.
 */
export async function requestN8nPolicyIntakeBySignedSource(
  input: N8nSignedSourceInput, signal?: AbortSignal,
): Promise<N8nOcrBridgeResponse> {
  if (![input.intakeId, input.documentId, input.requestId].every(id => UUID.test(id))) {
    throw new Error("n8n_request_identifier_invalid");
  }
  let signed: URL;
  try { signed = new URL(input.signedUrl); }
  catch { throw new Error("n8n_signed_source_invalid"); }
  if (signed.origin !== TRUSTED_STORAGE_ORIGIN
      || !signed.pathname.startsWith(SIGNED_OBJECT_PREFIX + input.intakeId + "/")
      || signed.pathname.includes("..") || signed.username || signed.password || signed.hash
      || !signed.searchParams.get("token")) {
    throw new Error("n8n_signed_source_invalid");
  }
  const { url, secret } = n8nConfiguration();
  // Read signature metadata in parallel with n8n, while the short-lived URL is
  // still valid. Errors do not interrupt regular verified policy extraction.
  const evidencePdf=readEvidencePdf(signed);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60_000);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-insureit-policy-intake-secret": secret,
      },
      body: JSON.stringify({
        intake_id: input.intakeId,
        document_id: input.documentId,
        request_id: input.requestId,
        signed_pdf_url: signed.toString(),
      }),
      cache: "no-store",
      signal: controller.signal,
      redirect: "error",
    });
    assertN8nHttpSuccess(response);
    const payload: unknown = await response.json();
    const extracted=validateN8nPolicyIntakeResponse(payload, input);
    return attachSigningProposal(extracted,await evidencePdf);
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function n8nConfiguration(): { url: URL; secret: string } {
  // Full provider cutover must NEVER silently select old n8n Cloud even if
  // an old env configuration remains; preserve n8n-only fail-closed semantics.
  if (process.env.INSUREIT_POLICY_OCR_PROVIDER === "n8n"
      && process.env.INSUREIT_N8N_OCR_ENDPOINT_MODE !== "self_hosted")
    throw new Error("n8n_self_hosted_required");
  const configuredUrl = process.env.INSUREIT_N8N_OCR_WEBHOOK_URL;
  const secret = process.env.INSUREIT_N8N_OCR_HEADER_SECRET;
  if (!configuredUrl || !secret || secret.length < 32) throw new Error("n8n_bridge_not_configured");
  const url = new URL(configuredUrl);
  // Default remains Cloud for safe rollback; the self-hosted destination must
  // be explicitly opted into after a successful end-to-end read-only test.
  const origin = process.env.INSUREIT_N8N_OCR_ENDPOINT_MODE === "self_hosted"
    ? SELF_HOSTED_N8N_ORIGIN
    : EXPECTED_N8N_ORIGIN;
  if (url.origin !== origin || url.protocol !== "https:" || url.pathname !== EXPECTED_WEBHOOK_PATH
      || url.search || url.hash || url.username || url.password) {
    throw new Error("n8n_webhook_url_not_allowed");
  }
  return { url, secret };
}

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
  const { url, secret } = n8nConfiguration();

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
    assertN8nHttpSuccess(response);
    const payload: unknown = await response.json();
    const extracted=validateN8nPolicyIntakeResponse(payload, input);
    if(!extracted.parserId.startsWith("tata_aig_") || !extracted.receiptDate) return extracted;
    const pdfBytes=new Uint8Array(await input.file.arrayBuffer());
    return attachSigningProposal(extracted,pdfBytes);
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}
