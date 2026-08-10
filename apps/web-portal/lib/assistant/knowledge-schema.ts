export const ASSISTANT_METADATA_HEADERS = ["Key", "Value"] as const;
export const ASSISTANT_KNOWLEDGE_HEADERS = ["Route", "Title", "Content", "Tags", "Source Reference", "Required Capabilities"] as const;
export const ASSISTANT_WORKBOOK_SHEETS = ["Metadata", "Knowledge"] as const;
export const ASSISTANT_TEMPLATE_VERSION = "1" as const;

const METADATA_KEYS = ["template_version", "knowledge_base_name", "owner", "classification"] as const;
const MAX_TITLE = 160;
const MAX_CONTENT = 12_000;
const MAX_SOURCE_REFERENCE = 240;
const MAX_TAGS = 12;
const MAX_REQUIRED_CAPABILITIES = 4;
const APPROVED_CONTENT_CAPABILITIES = new Set([
  "view_dashboard", "view_claims", "manage_claims", "view_intermediaries", "create_intermediary_application",
  "review_intermediary_application", "approve_intermediary_application", "activate_intermediary", "view_customers",
  "manage_customers", "view_kyc", "review_kyc", "view_employees", "manage_employees", "view_org_tree",
  "view_vehicles", "view_policies", "view_tasks", "manage_tasks", "view_reports", "view_notifications",
  "manage_users", "manage_master_data", "manage_system",
]);

export type AssistantKnowledgeMetadata = {
  templateVersion: "1";
  knowledgeBaseName: string;
  owner: string;
  classification: "internal";
};

export type AssistantKnowledgeEntry = {
  route: string;
  title: string;
  content: string;
  tags: string[];
  sourceReference: string;
  requiredCapabilities: string[];
};

export class AssistantKnowledgeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssistantKnowledgeValidationError";
  }
}

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

const HTML_OR_SCRIPT = /<\/?[a-z][^>]*>|\bon\w+\s*=|javascript\s*:|data\s*:\s*text\/html/i;
const LIKELY_SECRET = /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:api[_-]?key|secret|password|passwd|access[_-]?token|refresh[_-]?token|client[_-]?secret)\b\s*[:=]\s*\S{8,}|\b(?:sk_live_|sk_test_|ghp_|github_pat_)[A-Za-z0-9_\-]{12,}|\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/i;
const SENSITIVE_IDENTIFIER = /\b[A-Z]{5}[0-9]{4}[A-Z]\b|\b(?:\d[ -]?){11}\d\b|\b[A-Z0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][A-Z0-9]Z[A-Z0-9]\b|\b(?:account|a\/c|bank account|chassis|engine)\b\s*(?:number|no\.?|#)?\s*[:=-]?\s*[A-Z0-9-]{6,}|\b[6-9]\d{9}\b|\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;

export function assertAssistantSafeText(value: string, field: string) {
  if (HTML_OR_SCRIPT.test(value)) throw new AssistantKnowledgeValidationError(`${field} contains HTML or script content.`);
  if (/^[=+@]/.test(value) || /^-\s*(?:\d|[A-Z]+\()/i.test(value)) {
    throw new AssistantKnowledgeValidationError(`${field} contains formula-like content.`);
  }
  if (LIKELY_SECRET.test(value)) throw new AssistantKnowledgeValidationError(`${field} contains a likely secret.`);
  if (SENSITIVE_IDENTIFIER.test(value)) throw new AssistantKnowledgeValidationError(`${field} contains a sensitive identifier.`);
}

function required(value: unknown, field: string, max: number) {
  const normalized = text(value);
  if (!normalized) throw new AssistantKnowledgeValidationError(`${field} is required.`);
  if (normalized.length > max) throw new AssistantKnowledgeValidationError(`${field} exceeds ${max} characters.`);
  assertAssistantSafeText(normalized, field);
  return normalized;
}

export function validateAssistantRoute(value: unknown) {
  const route = required(value, "Route", 240).toLowerCase();
  if (!/^\/[a-z0-9]+(?:[/-][a-z0-9]+)*$/.test(route) || route.includes("..") || route.includes("//") || route.includes("\\")) {
    throw new AssistantKnowledgeValidationError("Route must be a safe application-relative path without traversal, query strings or fragments.");
  }
  return route;
}

export function validateAssistantMetadata(rows: Array<Record<string, unknown>>): AssistantKnowledgeMetadata {
  const values = new Map<string, string>();
  for (const [index, row] of rows.entries()) {
    const key = text(row.Key).toLowerCase();
    if (!key && !text(row.Value)) continue;
    if (!(METADATA_KEYS as readonly string[]).includes(key)) {
      throw new AssistantKnowledgeValidationError(`Unexpected metadata key in row ${index + 2}: ${key || "(blank)"}.`);
    }
    if (values.has(key)) throw new AssistantKnowledgeValidationError(`Duplicate metadata key: ${key}.`);
    values.set(key, required(row.Value, `Metadata ${key}`, 240));
  }
  for (const key of METADATA_KEYS) {
    if (!values.has(key)) throw new AssistantKnowledgeValidationError(`Required metadata key is missing: ${key}.`);
  }
  if (values.get("template_version") !== ASSISTANT_TEMPLATE_VERSION) throw new AssistantKnowledgeValidationError("Unsupported template_version.");
  if (values.get("classification")?.toLowerCase() !== "internal") throw new AssistantKnowledgeValidationError("Metadata classification must be internal.");
  return {
    templateVersion: ASSISTANT_TEMPLATE_VERSION,
    knowledgeBaseName: values.get("knowledge_base_name")!,
    owner: values.get("owner")!,
    classification: "internal",
  };
}

export function validateAssistantKnowledgeRow(row: Record<string, unknown>, rowNumber: number): AssistantKnowledgeEntry {
  const route = validateAssistantRoute(row.Route);
  const title = required(row.Title, `Title in row ${rowNumber}`, MAX_TITLE);
  const content = required(row.Content, `Content in row ${rowNumber}`, MAX_CONTENT);
  const sourceReference = required(row["Source Reference"], `Source Reference in row ${rowNumber}`, MAX_SOURCE_REFERENCE);
  const rawTags = required(row.Tags, `Tags in row ${rowNumber}`, 480);
  const tags = Array.from(new Set(rawTags.split(",").map((tag) => tag.trim().toLowerCase()).filter(Boolean)));
  if (!tags.length || tags.length > MAX_TAGS || tags.some((tag) => !/^[a-z0-9][a-z0-9 -]{0,39}$/.test(tag))) {
    throw new AssistantKnowledgeValidationError(`Tags in row ${rowNumber} must contain 1-${MAX_TAGS} safe comma-separated labels.`);
  }
  const rawCapabilities = required(row["Required Capabilities"], `Required Capabilities in row ${rowNumber}`, 480);
  const requiredCapabilities = Array.from(new Set(rawCapabilities.split(",").map((capability) => capability.trim().toLowerCase()).filter(Boolean)));
  if (!requiredCapabilities.length || requiredCapabilities.length > MAX_REQUIRED_CAPABILITIES || requiredCapabilities.some((capability) => !APPROVED_CONTENT_CAPABILITIES.has(capability))) {
    throw new AssistantKnowledgeValidationError(`Required Capabilities in row ${rowNumber} must contain 1-${MAX_REQUIRED_CAPABILITIES} approved legacy capability names.`);
  }
  return { route, title, content, tags, sourceReference, requiredCapabilities };
}
