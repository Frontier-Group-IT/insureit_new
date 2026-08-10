import type { Capability } from "../roles.ts";
import type { AssistantActor, NavigationCandidate, NavigationResolver } from "./orchestrator.ts";
// @ts-expect-error Direct Node strip-types regressions require the explicit .ts extension.
import { developmentNavigationSection, navigationCatalogue, visibleNavigationCatalogue, type NavigationPermissionMap } from "../navigation-catalogue.ts";

export type StaticNavigationEntry = NavigationCandidate & { keywords?: string[] };

const DEFAULT_NAVIGATION: StaticNavigationEntry[] = [...navigationCatalogue, developmentNavigationSection].flatMap((section) =>
  section.items.flatMap((node) => node.kind === "group"
    ? node.items.map((entry) => ({ label: entry.label, href: entry.href, requiredCapability: entry.capability, keywords: [section.label, node.label] }))
    : [{ label: node.label, href: node.href, requiredCapability: node.capability, keywords: [section.label] }]),
);

export function createPermissionAwareNavigationResolver(
  permissionAccess: NavigationPermissionMap,
  options: { role: string | null | undefined; intermediaryOnly: boolean },
): NavigationResolver {
  const entries = visibleNavigationCatalogue(permissionAccess, options).flatMap((section) =>
    section.items.flatMap((node) => node.kind === "group"
      ? node.items.map((entry) => ({ label: entry.label, href: entry.href, requiredCapability: entry.capability, keywords: [section.label, node.label] }))
      : [{ label: node.label, href: node.href, requiredCapability: node.capability, keywords: [section.label] }]),
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
    searchText: [entry.label, entry.href, ...(entry.keywords ?? [])].join(" ").toLowerCase(),
  }));
  return {
    async search(query: string, _actor: AssistantActor) {
      void _actor;
      const normalized = query.trim().toLowerCase();
      if (!normalized || normalized.length > 500) return [];
      const terms = normalized.split(/\s+/).filter(Boolean).slice(0, 8);
      return catalogue
        .filter((entry) => terms.some((term) => entry.searchText.includes(term)))
        .slice(0, 8)
        .map(({ label, href, requiredCapability }) => ({ label, href, requiredCapability }));
    },
  };
}

export const assistantNavigationResolver = createStaticNavigationResolver();
