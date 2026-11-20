import "server-only";

import { extractNativePdfTextPages } from "@/lib/policy-ocr-native-pdf";

type Insurer = "new_india_cv_native_pdf" | "iffco_tokio_cv_native_pdf" | "go_digit_cv_native_pdf";
type OcrField = { key: string; label: string; value: string; confidence: null; page: number | null; evidence: string };
export type NonTataCommercialRead = {
  parserId: Insurer;
  parserVersion: "non-tata-cv-v2";
  fields: OcrField[];
  warnings: string[];
  checksPassed: number;
  premium: { od: number; tp: number; net: number; gst: number; gross: number };
};
// Use the SAME approved self-hosted webhook as the production ICICI/Tata bridge.
// Commercial policy verification stays isolated by the insurer classifier and its
// strict response contract; no changes to ICICI or Tata parser logic are needed.
const PRIMARY_WEBHOOK_ORIGIN = "https://n8n.nishant.uk";
const PRIMARY_WEBHOOK_PATH = "/webhook/insureit-policy-intake-icici-v1";
function sharedN8nWebhookUrl(): string {
  if (process.env.INSUREIT_N8N_OCR_ENDPOINT_MODE !== "self_hosted")
    throw new Error("n8n_self_hosted_required");
  const configured = process.env.INSUREIT_N8N_OCR_WEBHOOK_URL;
  if (!configured) throw new Error("n8n_nontata_not_configured");
  let parsed: URL;
  try { parsed = new URL(configured); }
  catch { throw new Error("n8n_nontata_webhook_url_invalid"); }
  if (parsed.protocol !== "https:" || parsed.origin !== PRIMARY_WEBHOOK_ORIGIN
      || parsed.pathname !== PRIMARY_WEBHOOK_PATH || parsed.search || parsed.hash
      || parsed.username || parsed.password)
    throw new Error("n8n_nontata_webhook_url_invalid");
  return parsed.toString();
}
const MAX_BYTES = 4 * 1024 * 1024; // Vercel request-size limit, independent of proxy's 16 MB limit.
const PDF = "%PDF-";
const REQUIRED_BASE = [
  "insurer_verified", "policy_identity_verified", "insured_name_verified",
  "policy_start_end_verified", "issuance_date_evidenced", "vehicle_identification_verified",
  "vehicle_make_model_verified", "vehicle_class_verified", "vehicle_registration_printed",
  "vehicle_idv_verified", "od_tp_components_printed", "net_od_tp_reconciled",
  "gst_independently_evidenced", "gross_net_tax_reconciled",
] as const;
const REQUIRED_EXTRA: Record<Insurer, string[]> = {
  new_india_cv_native_pdf: ["nia_layout", "registration_complete"],
  iffco_tokio_cv_native_pdf: ["iffco_layout", "printed_tax_table", "invoice_taxable_matches", "invoice_gross_matches"],
  go_digit_cv_native_pdf: ["digit_layout", "registered_plate", "od_basic_ncb", "tp_itemization"],
};
const ALLOWED_FIELDS = new Set([
  "policy_number", "insurer_name", "policy_product", "insured_name",
  "policy_issuance_date", "policy_start_date", "policy_end_date", "third_party_start_date",
  "third_party_end_date", "vehicle_registration_number", "vehicle_registration_status",
  "vehicle_class", "vehicle_make", "vehicle_model", "vehicle_fuel_type",
  "vehicle_manufacturing_year", "vehicle_capacity", "vehicle_chassis_number",
  "vehicle_engine_number", "vehicle_rto_name", "vehicle_rto_state",
  "idv", "od_premium", "tp_premium", "cpa_premium",
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const completePlate = (v: string) => /^[A-Z]{2}[- ]?\d{2}[- ]?[A-Z]{1,3}[- ]?\d{3,4}$/i.test(v);
const rtoPrefix = (v: string) => /^(?:MP|HR)-?\d{2}$/i.test(v);
const object = (x: unknown): x is Record<string, unknown> =>
  x !== null && typeof x === "object" && !Array.isArray(x);
const cents = (v: number) => Math.round(v * 100);
const isMoney = (x: unknown): x is number =>
  typeof x === "number" && Number.isFinite(x) && x >= 0 && x <= 1_000_000_000
    && Math.abs(x * 100 - Math.round(x * 100)) < 0.00001;

function insurerForText(head: string): Insurer | null {
  // PDF text extraction can split an insurer/product heading across lines.
  // Normalize whitespace without trusting a caller-supplied insurer label.
  const normalized = head.replace(/\\s+/g, " ");
  const issuer = normalized.slice(0, 2400);
  const product = normalized.slice(0, 5000);
  const matches: Insurer[] = [];
  if (/THE NEW INDIA ASSURANCE CO\\. LTD\\./i.test(issuer) && /Commercial Vehicle Package Policy/i.test(product))
    matches.push("new_india_cv_native_pdf");
  if (/IFFCO.?TOKIO GENERAL INSURANCE/i.test(issuer) && /COMMERCIAL VEHICLE CERTIFICATE/i.test(product))
    matches.push("iffco_tokio_cv_native_pdf");
  if (/Go Digit General Insurance/i.test(issuer) && /Digit Commercial Vehicle Insurance/i.test(product))
    matches.push("go_digit_cv_native_pdf");
  return matches.length === 1 ? matches[0] : null;
}

/** Recognize only printed, trained native-PDF layouts. Never accept insurer names from caller input. */
export async function recognizeNonTataCommercialPdf(file: File): Promise<Insurer | null> {
  if (file.type !== "application/pdf" || file.size < 128) return null;
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== PDF) return null;
  const pages = await extractNativePdfTextPages(bytes);
  const text = pages.slice(0, 2).map((page) => page.text).join("\n");
  return insurerForText(text);
}

function validate(payload: unknown, insurer: Insurer, ids: Record<"intake_id" | "document_id" | "request_id", string>): NonTataCommercialRead {
  if (!object(payload) || payload.contract_version !== "1"
      || payload.parser_id !== insurer || payload.parser_version !== "non-tata-cv-v2"
      || payload.extraction_method !== "native_pdf_text"
      || payload.review_required !== true || payload.auto_finalize_allowed !== false
      || payload.intake_id !== ids.intake_id || payload.document_id !== ids.document_id
      || payload.request_id !== ids.request_id)
    throw new Error("n8n_nontata_identity_or_contract_invalid");
  if (!object(payload.checks) || !Array.isArray(payload.fields)
      || !Array.isArray(payload.warnings) || typeof payload.ok !== "boolean"
      || payload.validation_passed !== payload.ok)
    throw new Error("n8n_nontata_validation_shape_invalid");

  const expected = [...REQUIRED_BASE, ...REQUIRED_EXTRA[insurer]];
  const checks = payload.checks;
  if (Object.keys(checks).length !== expected.length
      || expected.some((name) => typeof checks[name] !== "boolean"))
    throw new Error("n8n_nontata_check_set_invalid");
  const failed = expected.filter((name) => checks[name] !== true);
  const nIndiaPending = insurer === "new_india_cv_native_pdf"
    && failed.length === 1 && failed[0] === "registration_complete" && payload.ok === false;
  if (!((failed.length === 0 && payload.ok === true) || nIndiaPending)) {
    // Only expose names from this server-controlled check list, never raw
    // extracted values, policyholder text, signed links or n8n warnings.
    const diagnostic=failed.slice(0,6).join("__");
    throw new Error(diagnostic
      ? "n8n_failed_checks__"+diagnostic
      : "n8n_nontata_verification_failed");
  }

  if (payload.fields.length < 14 || payload.fields.length > 35
      || payload.warnings.length > 30)
    throw new Error("n8n_nontata_fields_invalid");
  const fields: OcrField[] = payload.fields.map((raw: unknown) => {
    if (!object(raw) || typeof raw.key !== "string" || !ALLOWED_FIELDS.has(raw.key)
        || typeof raw.label !== "string" || raw.label.length > 100
        || typeof raw.value !== "string" || !raw.value.trim() || raw.value.length > 300
        || raw.confidence !== null
        || (raw.page !== null && (!Number.isInteger(raw.page) || (raw.page as number) < 1 || (raw.page as number) > 10))
        || typeof raw.evidence !== "string" || raw.evidence.length > 120)
      throw new Error("n8n_nontata_field_shape_invalid");
    return { key: raw.key, label: raw.label, value: raw.value, confidence: null, page: raw.page as number | null, evidence: raw.evidence };
  });
  const byKey = new Map(fields.map((x) => [x.key, x.value]));
  if (byKey.size !== fields.length) throw new Error("n8n_nontata_duplicate_field");
  for (const key of ["policy_number","insurer_name","insured_name","policy_start_date","policy_end_date",
    "vehicle_registration_status","vehicle_chassis_number","vehicle_engine_number","idv","od_premium","tp_premium"]) {
    if (!byKey.get(key)) throw new Error("n8n_nontata_required_field_missing");
  }
  const printedPlate = byKey.get("vehicle_registration_number") || "";
  if (nIndiaPending) {
    if (!rtoPrefix(printedPlate) || byKey.get("vehicle_registration_status") !== "registration_pending"
        || !/^20\d{2}$/.test(byKey.get("vehicle_manufacturing_year") || ""))
      throw new Error("n8n_nontata_unregistered_evidence_invalid");
  } else if (checks.vehicle_registration_printed === true) {
    if (!completePlate(printedPlate) || byKey.get("vehicle_registration_status") !== "registered")
      throw new Error("n8n_nontata_registered_plate_invalid");
  }
  const dates = ["policy_start_date","policy_end_date","policy_issuance_date"];
  for (const key of dates) {
    const date = byKey.get(key) || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)
        || !Number.isFinite(Date.parse(date + "T00:00:00Z"))
        || new Date(date + "T00:00:00Z").toISOString().slice(0, 10) !== date)
      throw new Error("n8n_nontata_date_invalid");
  }
  if ((byKey.get("policy_end_date") || "") < (byKey.get("policy_start_date") || ""))
    throw new Error("n8n_nontata_coverage_invalid");
  const premium = payload.premium_components;
  if (!object(premium) || ![premium.od, premium.tp, premium.net, premium.gst, premium.gross].every(isMoney))
    throw new Error("n8n_nontata_premium_components_invalid");
  const od = premium.od as number, tp = premium.tp as number;
  const net = premium.net as number, gst = premium.gst as number, gross = premium.gross as number;
  if (Math.abs(cents(od + tp) - cents(net)) > 6 || Math.abs(cents(net + gst) - cents(gross)) > 6
      || cents(Number(byKey.get("od_premium"))) !== cents(od)
      || cents(Number(byKey.get("tp_premium"))) !== cents(tp)
      || !isMoney(Number(byKey.get("idv"))))
    throw new Error("n8n_nontata_financial_reconciliation_failed");
  const warnings = payload.warnings.map((w: unknown) => {
    if (typeof w !== "string" || w.length > 240) throw new Error("n8n_nontata_warning_invalid");
    return w;
  });

  if (nIndiaPending) {
    // Never feed an RTO-only prefix into the registered-vehicle number field.
    warnings.unshift("Policy prints only an RTO prefix. Confirm the vehicle is unregistered before onboarding, or supply its verified full registration number.");
  }
  return {
    parserId: insurer, parserVersion: "non-tata-cv-v2",
    fields: nIndiaPending ? fields.filter((f) => f.key !== "vehicle_registration_number") : fields,
    warnings,
    checksPassed: expected.filter((key) => checks[key] === true).length,
    premium: { od, tp, net, gst, gross },
  };
}

/**
 * Normal Policy Read/Intake adapter. Null means unrelated insurer/layout;
 * a recognized trained insurer that fails never falls back silently to Google.
 * No policy, customer, vehicle or queue writes occur here.
 */
export async function tryReadNonTataCommercialPolicy(
  file: File,
  ids?: Record<"intake_id" | "document_id" | "request_id", string>,
): Promise<NonTataCommercialRead | null> {
  const insurer = await recognizeNonTataCommercialPdf(file);
  if (!insurer) return null;
  if (file.size > MAX_BYTES) throw new Error("n8n_nontata_pdf_exceeds_4mb");
  const secret = process.env.INSUREIT_N8N_OCR_HEADER_SECRET;
  if (!secret || secret.length < 32) throw new Error("n8n_nontata_not_configured");
  const requestIds = ids ?? { intake_id: crypto.randomUUID(), document_id: crypto.randomUUID(), request_id: crypto.randomUUID() };
  if (Object.values(requestIds).some((id) => !UUID.test(id)))
    throw new Error("n8n_nontata_invalid_request_ids");
  const body = new FormData();
  for (const [key, value] of Object.entries(requestIds)) body.set(key, value);
  body.set("data", file, "policy.pdf");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);
  try {
    const response = await fetch(sharedN8nWebhookUrl(), {
      method: "POST", headers: { "x-insureit-policy-intake-secret": secret },
      body, signal: controller.signal, cache: "no-store", redirect: "error",
    });
    if (!response.ok) throw new Error("n8n_nontata_http_" + response.status);
    const payload: unknown = await response.json();
    return validate(payload, insurer, requestIds);
  } finally { clearTimeout(timeout); }
}

// The AI Policy Automation queue has a current, server-authorized Supabase signed
// source, not a browser-uploaded File. Reuse the same strict non-Tata validator,
// with a bounded private download and exact-storage-origin protection.
export async function tryReadNonTataCommercialSignedPolicy(
  source: { signedUrl: string; intakeId: string; documentId: string; requestId: string },
): Promise<NonTataCommercialRead | null> {
  const ids = { intake_id: source.intakeId, document_id: source.documentId, request_id: source.requestId };
  if (Object.values(ids).some((id) => !UUID.test(id)))
    throw new Error("n8n_nontata_invalid_request_ids");
  let url: URL;
  try { url = new URL(source.signedUrl); }
  catch { throw new Error("n8n_nontata_signed_source_invalid"); }
  if (url.origin !== "https://ilzhsfqqjyppzzvfscmh.supabase.co"
      || !url.pathname.startsWith("/storage/v1/object/sign/policy-documents/intakes/" + ids.intake_id + "/")
      || url.pathname.includes("..") || !url.searchParams.has("token")
      || url.username || url.password || url.hash)
    throw new Error("n8n_nontata_signed_source_invalid");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: "no-store", redirect: "error" });
    if (!response.ok) throw new Error("n8n_nontata_pdf_download_failed");
    const declaredSize = Number(response.headers.get("content-length") ?? "0");
    if (declaredSize > MAX_BYTES) throw new Error("n8n_nontata_pdf_exceeds_4mb");
    const reader = response.body?.getReader();
    if (!reader) throw new Error("n8n_nontata_pdf_download_failed");
    const chunks: Uint8Array[] = [];
    let length = 0;
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > MAX_BYTES) {
        await reader.cancel();
        throw new Error("n8n_nontata_pdf_exceeds_4mb");
      }
      chunks.push(part.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== PDF)
      throw new Error("n8n_nontata_pdf_not_pdf");
    const file = new File([bytes], "current-policy.pdf", { type: "application/pdf" });
    return await tryReadNonTataCommercialPolicy(file, ids);
  } finally { clearTimeout(timer); }
}
