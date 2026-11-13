const KEYS = new Set([
  "policy_number", "insurer_name", "policy_product", "policy_start_date", "policy_end_date",
  "insured_name", "vehicle_make", "vehicle_model", "vehicle_registration_status",
  "vehicle_registration_number", "vehicle_engine_number", "vehicle_chassis_number",
  "vehicle_manufacturing_year", "vehicle_rto_name", "idv", "od_premium", "tp_premium", "cpa_premium",
]);

export type N8nOcrField = {
  key: string; label: string; value: string; confidence: number | null;
  page: number | null; evidence: string;
};
export type N8nOcrBridgeResponse = {
  ok: true; fields: N8nOcrField[]; warnings: string[];
  parserId: string; parserVersion: string;
};
export type N8nOcrBridgeInput = {
  intakeId: string; documentId: string; requestId: string; file: File;
};

function plainObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validate the remote response rather than trusting an external workflow to
 * authorize intake changes. No database write, claim, customer creation or
 * finalization happens here. The caller owns scope and lifecycle checks.
 */
export function validateN8nPolicyIntakeResponse(
  value: unknown, ids: Pick<N8nOcrBridgeInput, "intakeId" | "documentId" | "requestId">,
): N8nOcrBridgeResponse {
  if (!plainObject(value) || value.contract_version !== "1") throw new Error("n8n_contract_version_invalid");
  if (value.intake_id !== ids.intakeId || value.document_id !== ids.documentId
      || value.request_id !== ids.requestId) throw new Error("n8n_request_identity_mismatch");
  if (value.ok !== true || value.review_required !== true || value.auto_finalize_allowed !== false
      || value.parser_id !== "icici_3005_n8n_native_pdf"
      || value.parser_version !== "bridge-v1"
      || value.extraction_method !== "native_pdf_text") throw new Error("n8n_review_required");
  if (!plainObject(value.checks) || Object.keys(value.checks).length < 8
      || Object.values(value.checks).some((check) => check !== true)) throw new Error("n8n_financial_validation_failed");
  if (!Array.isArray(value.fields) || value.fields.length < 12 || value.fields.length > KEYS.size
      || !Array.isArray(value.warnings) || value.warnings.length > 30) throw new Error("n8n_fields_invalid");

  const seen = new Set<string>();
  const fields: N8nOcrField[] = value.fields.map((field: unknown): N8nOcrField => {
    if (!plainObject(field) || typeof field.key !== "string" || !KEYS.has(field.key)
        || seen.has(field.key) || typeof field.value !== "string"
        || !field.value.trim() || field.value.length > 300
        || typeof field.label !== "string" || field.label.length > 100
        || typeof field.evidence !== "string" || field.evidence.length > 120
        || field.confidence !== null
        || (field.page !== null && (!Number.isInteger(field.page) || Number(field.page) < 1 || Number(field.page) > 10)))
      throw new Error("n8n_field_shape_invalid");
    seen.add(field.key);
    return { key: field.key, label: field.label, value: field.value,
      confidence: null, page: field.page as number | null, evidence: field.evidence };
  });

  for (const key of ["policy_number", "insurer_name", "insured_name", "policy_start_date",
    "policy_end_date", "vehicle_engine_number", "vehicle_chassis_number", "od_premium", "tp_premium"]) {
    if (!seen.has(key)) throw new Error("n8n_required_field_missing");
  }
  const policyNumber = fields.find((field) => field.key === "policy_number")?.value ?? "";
  if (!/^3005\/\d{7,12}\/\d{2}\/\d{3}$/.test(policyNumber)) throw new Error("n8n_wrong_policy_product");

  // Never accept a remote boolean as proof that the policy's money adds up.
  // All components below are parsed from PDF text by the n8n workflow.
  if (!plainObject(value.premium_components)) throw new Error("n8n_premium_breakdown_missing");
  const premium = value.premium_components;
  function exactMoney(v: unknown): number {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1_000_000_000
        || Math.abs(v * 100 - Math.round(v * 100)) > 0.00001) {
      throw new Error("n8n_premium_amount_invalid");
    }
    return v;
  }
  const basicOd = exactMoney(premium.basic_od_premium);
  const od = exactMoney(premium.total_od_premium);
  const tp = exactMoney(premium.basic_tp_premium);
  const cpa = exactMoney(premium.owner_driver_cpa);
  const liability = exactMoney(premium.total_liability_premium);
  const net = exactMoney(premium.net_premium);
  const igst = exactMoney(premium.igst_exact);
  const tax = exactMoney(premium.printed_total_tax);
  const gross = exactMoney(premium.gross_premium);
  if (!Array.isArray(premium.od_addons) || premium.od_addons.length > 12) {
    throw new Error("n8n_premium_addons_invalid");
  }
  const addOns = premium.od_addons.reduce((total: number, addon: unknown) => {
    if (!plainObject(addon) || typeof addon.name !== "string"
        || addon.name.trim().length < 2 || addon.name.length > 90) {
      throw new Error("n8n_premium_addon_invalid");
    }
    return total + exactMoney(addon.amount);
  }, 0);
  const cents = (number: number) => Math.round(number * 100);
  if (cents(basicOd + addOns) !== cents(od)
      || cents(tp + cpa) !== cents(liability)
      || cents(od + liability) !== cents(net)
      || cents(net + tax) !== cents(gross)
      || Math.round(igst) !== tax) {
    throw new Error("n8n_premium_reconciliation_failed");
  }
  const fieldByKey = new Map(fields.map((field) => [field.key, field.value]));
  const equalsField = (key: string, amount: number) =>
    Number((fieldByKey.get(key) ?? "").replace(/,/g, "")) === amount;
  if (!equalsField("od_premium", od) || !equalsField("tp_premium", tp)
      || !equalsField("cpa_premium", cpa)) {
    throw new Error("n8n_premium_field_mismatch");
  }

  const warnings = value.warnings.map((warning: unknown) => {
    if (typeof warning !== "string" || warning.length > 240) throw new Error("n8n_warning_invalid");
    return warning;
  });
  return { ok: true, fields, warnings, parserId: "icici_3005_n8n_native_pdf",
    parserVersion: "bridge-v1" };
}

