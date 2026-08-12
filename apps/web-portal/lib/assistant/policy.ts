export const ASSISTANT_LIMITS = {
  maxMessages: 12,
  maxMessageCharacters: 4_000,
  maxCurrentPathCharacters: 512,
  maxBodyBytes: 32_000,
} as const;

export type AssistantInputMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AssistantRequestPayload = {
  messages: AssistantInputMessage[];
  currentPath: string;
};

export type AssistantValidationCode =
  | "invalid_body"
  | "too_many_messages"
  | "message_too_large"
  | "invalid_current_path";

export type AssistantValidationResult =
  | { ok: true; value: AssistantRequestPayload }
  | { ok: false; code: AssistantValidationCode };

const externalRoles = new Set(["customer", "intermediary"]);
const internalRoles = new Set([
  "super_admin", "admin", "manager", "claims_head", "sales_operations_head",
  "backoffice_executive", "claim_processor", "field_executive", "relationship_manager",
  "director", "sales_head", "zonal_head", "asm", "sales_manager", "agent", "it_super_user",
]);

export function isInternalEmployeeRole(role: string | null | undefined): boolean {
  return Boolean(role && internalRoles.has(role) && !externalRoles.has(role));
}

export type RequestEnvelopeResult =
  | { ok: true }
  | { ok: false; status: 403 | 413 | 415; code: "cross_origin" | "body_too_large" | "unsupported_media_type" };

export function validateRequestEnvelope(request: Request): RequestEnvelopeResult {
  const requestUrl = new URL(request.url);
  const origin = request.headers.get("origin");
  if (!origin || origin !== requestUrl.origin) return { ok: false, status: 403, code: "cross_origin" };
  const contentType = request.headers.get("content-type")?.toLowerCase().split(";", 1)[0].trim() ?? "";
  if (contentType !== "application/json") return { ok: false, status: 415, code: "unsupported_media_type" };
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > ASSISTANT_LIMITS.maxBodyBytes) {
    return { ok: false, status: 413, code: "body_too_large" };
  }
  return { ok: true };
}

export type AssistantLink = { label: string; href: string };
export type AssistantCitation = { id: string; title: string; href?: string };
export type AssistantOutput = { answer: string; links: AssistantLink[]; citations: AssistantCitation[] };

function isSafeInternalHref(href: string): boolean {
  return href.startsWith("/") && !href.startsWith("//") && !/[\\\r\n]/.test(href);
}

export function validateAssistantOutput(input: unknown): { ok: true; value: AssistantOutput } | { ok: false; code: "unsafe_output" } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, code: "unsafe_output" };
  const value = input as Record<string, unknown>;
  if (typeof value.answer !== "string" || !value.answer.trim() || value.answer.length > 8_000 || /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(value.answer) || !Array.isArray(value.links) || !Array.isArray(value.citations)) {
    return { ok: false, code: "unsafe_output" };
  }
  const links = value.links as Array<Record<string, unknown>>;
  const citations = value.citations as Array<Record<string, unknown>>;
  if (links.length > 8 || citations.length > 8) return { ok: false, code: "unsafe_output" };
  if (links.some((link) => typeof link?.label !== "string" || !link.label.trim() || link.label.length > 200 || typeof link.href !== "string" || link.href.length > 512 || !isSafeInternalHref(link.href))) {
    return { ok: false, code: "unsafe_output" };
  }
  if (citations.some((citation) => typeof citation?.id !== "string" || !citation.id.trim() || citation.id.length > 120 || typeof citation.title !== "string" || !citation.title.trim() || citation.title.length > 200 || (citation.href !== undefined && (typeof citation.href !== "string" || citation.href.length > 512 || !isSafeInternalHref(citation.href))))) {
    return { ok: false, code: "unsafe_output" };
  }
  const allowedCitationIds = new Set(citations.map((citation) => citation.id as string));
  const referencedIds = Array.from(value.answer.matchAll(/\[([^\]]+)\]/g), (match) => match[1]);
  if (referencedIds.some((id) => !allowedCitationIds.has(id))) return { ok: false, code: "unsafe_output" };
  return { ok: true, value: value as AssistantOutput };
}

export function validateAssistantRequest(input: unknown): AssistantValidationResult {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { ok: false, code: "invalid_body" };
  const value = input as Record<string, unknown>;
  if (!Array.isArray(value.messages) || value.messages.length < 1) return { ok: false, code: "invalid_body" };
  if (value.messages.length > ASSISTANT_LIMITS.maxMessages) return { ok: false, code: "too_many_messages" };

  const messages: AssistantInputMessage[] = [];
  for (const candidate of value.messages) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return { ok: false, code: "invalid_body" };
    const message = candidate as Record<string, unknown>;
    if ((message.role !== "user" && message.role !== "assistant") || typeof message.content !== "string" || message.content.trim().length === 0) {
      return { ok: false, code: "invalid_body" };
    }
    if (message.content.length > ASSISTANT_LIMITS.maxMessageCharacters) return { ok: false, code: "message_too_large" };
    messages.push({ role: message.role, content: message.content });
  }

  if (typeof value.currentPath !== "string" || value.currentPath.length > ASSISTANT_LIMITS.maxCurrentPathCharacters) {
    return { ok: false, code: "invalid_current_path" };
  }
  if (!value.currentPath.startsWith("/") || value.currentPath.startsWith("//") || /[\\\r\n?#]/.test(value.currentPath)) {
    return { ok: false, code: "invalid_current_path" };
  }

  return { ok: true, value: { messages, currentPath: value.currentPath } };
}
