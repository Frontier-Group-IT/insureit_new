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

function fallbackKnowledgeQuery(query: string): string | null {
  const normalized = query.toLowerCase();
  if (/\b(password|login|sign in)\b/.test(normalized)) return "forgot password";
  if (/\bposp\b/.test(normalized)) return /\b(onboard|create|add|register)\b/.test(normalized) ? "POSP onboarding" : "POSP account";
  if (/\bmisp\b/.test(normalized)) return /\b(onboard|create|add|register)\b/.test(normalized) ? "MISP onboarding" : "MISP account";
  if (/\bpartner\b/.test(normalized)) return "Partner account workflow";
  if (/\bclaim\b/.test(normalized) && /\b(document|replace|upload)\b/.test(normalized)) return "claim document";
  if (/\bclaim\b/.test(normalized)) return "claim customer query";
  if (/\b(policy|renewal|coverage)\b/.test(normalized)) return "policy renewal coverage";
  if (/\b(kyc|customer)\b/.test(normalized) && /\b(onboard|create|add|register|kyc)\b/.test(normalized)) return "customer onboarding KYC";
  if (/\b(vehicle|fleet)\b/.test(normalized)) return "vehicle fleet workflow";
  if (/\b(task|follow up|follow-up)\b/.test(normalized)) return "task follow-up";
  if (/\b(assistant|help|capabilit)\b/.test(normalized)) return "assistant capabilities";
  return null;
}

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
  const searches = [query];
  const fallback = fallbackKnowledgeQuery(query);
  if (fallback && fallback.toLowerCase() !== query.toLowerCase()) searches.push(fallback);
  for (const search of searches) {
    const candidates = await input.repository.searchApprovedActive(search, KNOWLEDGE_RESULT_LIMIT);
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
    if (allowed.length) return allowed;
  }
  return [];
}
