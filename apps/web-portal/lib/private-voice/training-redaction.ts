export type TrainingRedactionIdentity = {
  customer_name?: string | null;
  mobile?: string | null;
  registration_no?: string | null;
};

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function replaceLiteralInsensitive(value: string, literal: string | null | undefined, replacement: string) {
  const normalized = literal?.trim();
  if (!normalized) return value;
  return value.replace(new RegExp(escapeRegex(normalized), "gi"), replacement);
}

function redactCustomerName(value: string, customerName: string | null | undefined) {
  const normalized = customerName?.trim();
  if (!normalized) return value;

  let result = replaceLiteralInsensitive(value, normalized, "[CUSTOMER]");
  const nameTokens = [...new Set(normalized.match(/[A-Za-z]{3,}/g) ?? [])].sort((a, b) => b.length - a.length);
  for (const token of nameTokens) {
    result = result.replace(new RegExp(`\\b${escapeRegex(token)}\\b`, "gi"), "[CUSTOMER]");
  }
  return result;
}

export function redactTrainingText(value: string | null, identity?: TrainingRedactionIdentity) {
  let result = String(value ?? "").trim();
  if (!result) return "";

  result = redactCustomerName(result, identity?.customer_name);
  result = replaceLiteralInsensitive(result, identity?.mobile, "[MOBILE]");
  result = replaceLiteralInsensitive(result, identity?.registration_no, "[RC]");
  result = result.replace(/\b(?:\+?91[-\s]?)?[6-9]\d{9}\b/g, "[MOBILE]");
  result = result.replace(/\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{4}\b/gi, "[RC]");
  result = result.replace(/\b\d{12,}\b/g, "[LONG_ID]");
  return result;
}
