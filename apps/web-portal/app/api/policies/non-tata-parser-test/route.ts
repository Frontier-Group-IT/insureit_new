import { NextRequest, NextResponse } from "next/server";
import { requirePolicyOcrTrainingOperator } from "@/lib/policy-ocr-training-access";
import { extractNativePdfTextPages } from "@/lib/policy-ocr-native-pdf";

export const runtime = "nodejs";
export const maxDuration = 60;

// IT-only read-only test endpoint; isolated from normal Intake/onboarding, no DB writes.
const MAX_BYTES = 4 * 1024 * 1024; // Vercel request body limit; original training samples < 1 MB.
const N8N_TEST_URL = "https://n8n.nishant.uk/webhook/insureit-nontata-motor-pdf-candidate-v1";
const ALLOWED_FIELDS = new Set([
  "policy_number", "insurer_name", "policy_product", "insured_name",
  "policy_issuance_date", "policy_start_date", "policy_end_date",
  "third_party_start_date", "third_party_end_date", "vehicle_registration_number",
  "vehicle_registration_status", "vehicle_class", "vehicle_make", "vehicle_model",
  "vehicle_fuel_type", "vehicle_manufacturing_year", "vehicle_capacity",
  "vehicle_chassis_number", "vehicle_engine_number", "vehicle_rto_state",
  "vehicle_rto_name", "idv", "od_premium", "tp_premium", "cpa_premium",
]);
type Expected = { id: string; issuer: RegExp; layout: RegExp };
const SUPPORTED: Expected[] = [
  { id: "new_india_cv_native_pdf", issuer: /THE NEW INDIA ASSURANCE CO\. LTD\./i, layout: /Commercial Vehicle Package Policy/i },
  { id: "iffco_tokio_cv_native_pdf", issuer: /IFFCO.?TOKIO GENERAL INSURANCE/i, layout: /COMMERCIAL VEHICLE CERTIFICATE/i },
  { id: "go_digit_cv_native_pdf", issuer: /Go Digit General Insurance/i, layout: /Digit Commercial Vehicle Insurance/i },
];
const json = (message: string, status: number) =>
  NextResponse.json({ ok: false, error: message }, { status, headers: { "Cache-Control": "no-store" } });
const obj = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value);
const money = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1_000_000_000
  && Math.abs(Math.round(v * 100) - v * 100) < 0.0001;
const close = (a: number, b: number) => Math.abs(a - b) <= 0.06;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: NextRequest) {
  await requirePolicyOcrTrainingOperator();
  const secret = process.env.INSUREIT_N8N_OCR_HEADER_SECRET;
  if (!secret || secret.length < 32) return json("The isolated n8n reader is not configured.", 503);

  let form: FormData;
  try { form = await request.formData(); }
  catch { return json("Select a valid PDF file.", 400); }
  const file = form.get("file");
  if (!(file instanceof File) || file.type !== "application/pdf"
      || file.size < 128 || file.size > MAX_BYTES)
    return json("Select a digital policy PDF smaller than 4 MB.", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-")
    return json("The uploaded file is not a PDF.", 400);
  let head = "";
  try {
    const pages = await extractNativePdfTextPages(bytes);
    head = pages.slice(0, 2).map(page => page.text).join("\n");
  } catch { return json("This PDF could not be read by the native text extractor.", 422); }
  if (!head.trim()) return json("A scanned or image-only PDF requires manual review.", 422);
  const matched = SUPPORTED.filter(item => item.issuer.test(head) && item.layout.test(head));
  if (matched.length !== 1) {
    // No Tata AIG or ICICI path is ever reached through this isolated test endpoint.
    return json("This test supports only New India commercial, IFFCO Tokio commercial and Go Digit commercial policy PDFs.", 422);
  }

  const ids = { intake_id: crypto.randomUUID(), document_id: crypto.randomUUID(), request_id: crypto.randomUUID() };
  const body = new FormData();
  body.set("intake_id", ids.intake_id);
  body.set("document_id", ids.document_id);
  body.set("request_id", ids.request_id);
  body.set("data", new File([bytes], "policy.pdf", { type: "application/pdf" }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);
  try {
    const response = await fetch(N8N_TEST_URL, {
      method: "POST", body, headers: { "x-insureit-policy-intake-secret": secret },
      cache: "no-store", redirect: "error", signal: controller.signal,
    });
    if (!response.ok) return json("The isolated local n8n webhook is not available yet (HTTP " + response.status + ").", 502);
    const result: unknown = await response.json().catch(() => null);
    if (!obj(result) || result.contract_version !== "1"
        || result.parser_id !== matched[0].id || result.parser_version !== "non-tata-cv-v2"
        || result.extraction_method !== "native_pdf_text"
        || result.review_required !== true || result.auto_finalize_allowed !== false
        || result.intake_id !== ids.intake_id || result.document_id !== ids.document_id
        || result.request_id !== ids.request_id) return json("The local parser response failed identity or layout validation.", 422);
    if (typeof result.ok !== "boolean" || !obj(result.checks) || !obj(result.premium_components)
        || !Array.isArray(result.fields) || !Array.isArray(result.warnings))
      return json("The local parser returned an invalid review response.", 422);
    if (Object.keys(result.checks).length < 14 || Object.keys(result.checks).length > 32
        || Object.values(result.checks).some(v => typeof v !== "boolean"))
      return json("The local parser returned invalid verification checks.", 422);
    if (result.fields.length > 35 || result.warnings.length > 30
        || result.fields.some(f => !obj(f) || typeof f.key !== "string" || !ALLOWED_FIELDS.has(f.key)
          || typeof f.value !== "string" || !f.value.trim() || f.value.length > 300
          || typeof f.label !== "string" || f.label.length > 100
          || f.confidence !== null || f.page !== null
          || typeof f.evidence !== "string" || f.evidence.length > 120)
        || result.warnings.some(w => typeof w !== "string" || w.length > 200))
      return json("The local parser supplied invalid fields or warnings.", 422);
    const keys = result.fields.map((f: { key: string }) => f.key);
    if (new Set(keys).size !== keys.length) return json("The local parser returned duplicate fields.", 422);

    const prem = result.premium_components;
    const amounts = [prem.od, prem.tp, prem.net, prem.gst, prem.gross];
    if (amounts.some(v => !money(v))) {
      if (result.ok === true) return json("The parser claimed success with missing premium amounts.", 422);
    } else if (!close(prem.net as number, (prem.od as number) + (prem.tp as number))
        || !close(prem.gross as number, (prem.net as number) + (prem.gst as number))) {
      if (result.ok === true) return json("The parser claimed success with unreconciled premium totals.", 422);
    }
    if (result.ok === true && Object.values(result.checks).some(v => v !== true))
      return json("The parser claimed success despite failing verification checks.", 422);

    return NextResponse.json({
      ok: true, supportedInsurer: matched[0].id, parserAccepted: result.ok,
      reviewOnly: true, policyBooked: false,
      fields: result.fields, checks: result.checks, warnings: result.warnings,
      premium: { od: prem.od ?? null, tp: prem.tp ?? null, net: prem.net ?? null,
        gst: prem.gst ?? null, gross: prem.gross ?? null },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return json("The isolated local n8n reader timed out or could not be reached. No policy was changed.", 503);
  } finally { clearTimeout(timeout); }
}
