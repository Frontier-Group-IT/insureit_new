export type TrainingRedactionIdentity = {
  customer_name?: string | null;
  mobile?: string | null;
  registration_no?: string | null;
};

const GENERIC_IDENTITY_TOKENS = new Set([
  "customer",
  "insured",
  "caller",
  "unknown",
  "name",
  "named",
]);

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
  const nameTokens = [...new Set(normalized.match(/[A-Za-z]{3,}/g) ?? [])]
    .filter((token) => !GENERIC_IDENTITY_TOKENS.has(token.toLowerCase()))
    .sort((a, b) => b.length - a.length);
  for (const token of nameTokens) {
    result = result.replace(new RegExp(`\\b${escapeRegex(token)}\\b`, "gi"), "[CUSTOMER]");
  }
  return result;
}

function redactNarrativeNamePatterns(value: string) {
  const properName = "[A-Z][A-Za-z'’\\-]{1,30}(?:\\s+[A-Z][A-Za-z'’\\-]{1,30}){0,3}";
  let result = value;

  // Historical provider summaries sometimes introduce a first name that does not match the opportunity identity.
  result = result.replace(new RegExp(`\\b(The customer|Customer),\\s+${properName},`, "g"), "$1, [CUSTOMER],");
  result = result.replace(new RegExp(`\\b(customer|insured|caller) named\\s+${properName}\\b`, "g"), "$1 named [CUSTOMER]");
  result = result.replace(new RegExp(`\\b(?:Mr|Mrs|Ms|Shri|Smt)\\.?\\s+${properName}\\b`, "g"), "[CUSTOMER]");
  result = result.replace(
    new RegExp(
      `\\b(The customer|Customer)\\s+(${properName})(?=\\s+(?:said|stated|expressed|confirmed|requested|mentioned|informed|reported|asked|wants|wanted|agreed|declined|shared|explained)\\b)`,
      "g",
    ),
    "$1 [CUSTOMER]",
  );

  return result;
}

export function redactTrainingText(value: string | null, identity?: TrainingRedactionIdentity) {
  let result = String(value ?? "").trim();
  if (!result) return "";

  // Provider-generated narrative names must be removed before identity-token replacement so generic
  // role words such as "Customer" cannot destroy the narrative pattern and leave a mismatched name behind.
  result = redactNarrativeNamePatterns(result);
  result = redactCustomerName(result, identity?.customer_name);

  // Redact the whole phone expression before literal replacement so country-code prefixes do not remain.
  result = result.replace(/(?:\+?91[-\s]?[6-9]\d{9}\b|\b[6-9]\d{9}\b)/g, "[MOBILE]");
  result = replaceLiteralInsensitive(result, identity?.mobile, "[MOBILE]");

  result = replaceLiteralInsensitive(result, identity?.registration_no, "[RC]");
  result = result.replace(/\b[A-Z]{2}[\s-]?\d{1,2}[\s-]?[A-Z]{0,3}[\s-]?\d{4}\b/gi, "[RC]");
  result = result.replace(/\b\d{12,}\b/g, "[LONG_ID]");
  return result;
}
