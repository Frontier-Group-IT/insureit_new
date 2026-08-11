import type { Capability } from "../roles.ts";
import type { AssistantActor, NavigationCandidate, NavigationResolver } from "./orchestrator.ts";
// @ts-expect-error Direct Node strip-types regressions require the explicit .ts extension.
import { developmentNavigationSection, navigationCatalogue, visibleNavigationCatalogue, type NavigationPermissionMap } from "../navigation-catalogue.ts";

export type StaticNavigationEntry = NavigationCandidate & { keywords?: string[] };

const NAVIGATION_ALIASES: Record<string, string[]> = {
  "/intermediaries/posp": ["posp list", "posp register", "view posp", "all posp"],
  "/intermediaries/posp/new": ["create posp", "add posp", "new posp", "onboard posp", "posp onboarding"],
  "/customers/posp-misp/existing/new?partner_type=posp": ["add existing posp", "onboard existing posp"],
  "/intermediaries/misp": ["misp list", "misp register", "view misp", "all misp"],
  "/intermediaries/misp/new": ["create misp", "add misp", "new misp", "onboard misp", "misp onboarding"],
  "/customers/posp-misp/existing/new?partner_type=misp": ["add existing misp", "onboard existing misp"],
  "/customers": ["customer list", "customer register", "find customer", "view customers"],
  "/customers?choose_partner=1": ["create customer", "add customer", "new customer", "customer onboarding"],
  "/customers/applications": ["pending kyc", "kyc applications", "customer applications", "onboarding applications"],
  "/customer-kyc": ["customer kyc", "kyc review"],
  "/vehicles": ["vehicle list", "vehicle register", "fleet", "fleet management"],
  "/vehicles/new": ["create vehicle", "add vehicle", "new vehicle"],
  "/policies": ["policy list", "policy register", "find policy", "view policies", "renewals"],
  "/policies/new": ["create policy", "add policy", "new policy", "policy onboarding", "upload policy"],
  "/claims": ["claim list", "claim register", "find claim", "view claims"],
  "/tasks?status=overdue": ["overdue tasks", "late tasks"],
};

const SEARCH_STOP_WORDS = new Set([
  "a", "accounts", "active", "an", "are", "can", "could", "count", "currently", "for", "how", "i", "is", "many", "me", "now", "please", "right", "the", "to", "total", "where", "you",
]);

const DEFAULT_NAVIGATION: StaticNavigationEntry[] = [...navigationCatalogue, developmentNavigationSection].flatMap((section) =>
  section.items.flatMap((node) => node.kind === "group"
    ? node.items.map((entry) => ({ label: entry.label, href: entry.href, requiredCapability: entry.capability, requiredAccess: entry.minimumAccess, keywords: [section.label, node.label] }))
    : [{ label: node.label, href: node.href, requiredCapability: node.capability, requiredAccess: node.minimumAccess, keywords: [section.label] }]),
);

export function createPermissionAwareNavigationResolver(
  permissionAccess: NavigationPermissionMap,
  options: { role: string | null | undefined; intermediaryOnly: boolean },
): NavigationResolver {
  const entries = visibleNavigationCatalogue(permissionAccess, options).flatMap((section) =>
    section.items.flatMap((node) => node.kind === "group"
      ? node.items.map((entry) => ({ label: entry.label, href: entry.href, requiredCapability: entry.capability, requiredAccess: entry.minimumAccess, keywords: [section.label, node.label] }))
      : [{ label: node.label, href: node.href, requiredCapability: node.capability, requiredAccess: node.minimumAccess, keywords: [section.label] }]),
  );
  return createStaticNavigationResolver(entries);
}

function safeEntry(entry: StaticNavigationEntry): boolean {
  return Boolean(entry.label.trim() && entry.href.startsWith("/") && !entry.href.startsWith("//") && !/[\\\r\n]/.test(entry.href));
}

export function createStaticNavigationResolver(entries: StaticNavigationEntry[] = DEFAULT_NAVIGATION): NavigationResolver {
  const catalogue = entries.filter(safeEntry).slice(0, 100).map((entry) => ({
    label: entry.label.trim().slice(0, 120),
    href: entry.href,
    requiredCapability: entry.requiredCapability as Capability | undefined,
    requiredAccess: entry.requiredAccess,
    searchText: [entry.label, entry.href, ...(entry.keywords ?? []), ...(NAVIGATION_ALIASES[entry.href] ?? [])].join(" ").toLowerCase(),
    labelText: entry.label.trim().toLowerCase(),
  }));
  return {
    async search(query: string, _actor: AssistantActor) {
      void _actor;
      const normalized = query.trim().toLowerCase();
      if (!normalized || normalized.length > 500) return [];
      const terms = normalized.split(/\s+/).filter((term) => term && !SEARCH_STOP_WORDS.has(term)).slice(0, 8);
      if (!terms.length) return [];
      return catalogue
        .map((entry) => {
          const matchedTerms = terms.filter((term) => entry.searchText.includes(term));
          if (!matchedTerms.length) return null;
          let score = matchedTerms.length * 10;
          if (matchedTerms.length === terms.length) score += 20;
          if (entry.labelText === normalized) score += 40;
          if (/\b(add|create|new|onboard|upload)\b/.test(normalized)) score += /\b(add|new)\b/.test(entry.labelText) ? 25 : -10;
          if (/\b(list|register|show|view|find|all|count|total|how many)\b/.test(normalized)) score += /\b(all|register)\b/.test(entry.labelText) ? 20 : 0;
          if (/\b(existing)\b/.test(normalized)) score += entry.searchText.includes("existing") ? 30 : -15;
          return { entry, score };
        })
        .filter((candidate): candidate is { entry: (typeof catalogue)[number]; score: number } => candidate !== null)
        .sort((left, right) => right.score - left.score || left.entry.label.localeCompare(right.entry.label))
        .slice(0, 8)
        .map(({ entry: { label, href, requiredCapability, requiredAccess } }) => ({ label, href, requiredCapability, ...(requiredAccess ? { requiredAccess } : {}) }));
    },
  };
}

export const assistantNavigationResolver = createStaticNavigationResolver();
