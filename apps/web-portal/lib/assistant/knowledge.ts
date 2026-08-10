import type { Capability } from "../roles.ts";
import type { PermissionAccess } from "../permission-management.ts";

export const KNOWLEDGE_RPC_NAME = "search_approved_assistant_knowledge" as const;
export const KNOWLEDGE_RESULT_LIMIT = 5;
export const KNOWLEDGE_QUERY_LIMIT = 500;
export const KNOWLEDGE_EXCERPT_LIMIT = 2_000;

export type ApprovedKnowledgeSource = {
  id: string;
  title: string;
  excerpt: string;
  href?: string;
  requiredCapabilities: Capability[];
  requiredAccess: Exclude<PermissionAccess, "none">;
};

export interface ApprovedKnowledgeRepository {
  /** Fixed PostgreSQL contract: approved + active rows only, hard-limited by the implementation. */
  searchApprovedActive(query: string, limit: number): Promise<ApprovedKnowledgeSource[]>;
}

export type CapabilityCheck = (capability: Capability, minimumAccess?: Exclude<PermissionAccess, "none">) => Promise<boolean>;

function cleanUntrustedText(value: string, limit: number): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ").slice(0, limit).trim();
}

function isInternalHref(value: string): boolean {
  return value.startsWith("/") && !value.startsWith("//") && !/[\\\r\n]/.test(value);
}

export async function searchApprovedKnowledge(input: {
  query: string;
  repository: ApprovedKnowledgeRepository;
  can: CapabilityCheck;
}): Promise<ApprovedKnowledgeSource[]> {
  const query = input.query.trim();
  if (!query || query.length > KNOWLEDGE_QUERY_LIMIT) throw new Error("invalid_knowledge_query");
  const candidates = await input.repository.searchApprovedActive(query, KNOWLEDGE_RESULT_LIMIT);
  const allowed: ApprovedKnowledgeSource[] = [];
  for (const candidate of candidates.slice(0, KNOWLEDGE_RESULT_LIMIT)) {
    if (!candidate?.id || !candidate.title || !candidate.excerpt) continue;
    if (candidate.href && !isInternalHref(candidate.href)) continue;
    const capabilities = Array.isArray(candidate.requiredCapabilities) ? candidate.requiredCapabilities : [];
    const decisions = await Promise.all(capabilities.map((capability) => input.can(capability, candidate.requiredAccess)));
    if (decisions.some((decision) => !decision)) continue;
    const title = cleanUntrustedText(candidate.title, 200);
    const excerpt = cleanUntrustedText(candidate.excerpt, KNOWLEDGE_EXCERPT_LIMIT);
    if (!title || !excerpt) continue;
    allowed.push({ ...candidate, title, excerpt, requiredCapabilities: capabilities });
  }
  return allowed;
}
