import type { AssistantKnowledgeEntry, AssistantKnowledgeMetadata } from "./knowledge-schema.ts";
// @ts-expect-error Direct Node strip-types regressions require the explicit .ts extension.
import { navigationRouteRequirements } from "../navigation-catalogue.ts";

type AssistantKnowledgeWorkbook = {
  metadata: AssistantKnowledgeMetadata;
  entries: AssistantKnowledgeEntry[];
};

type BuildImportPlanInput = {
  fileName: string;
  fileSha256: string;
  actorProfileId: string;
  workbook: AssistantKnowledgeWorkbook;
};

export function buildAssistantKnowledgeImportPlan(input: BuildImportPlanInput) {
  if (!/^[0-9a-f]{64}$/.test(input.fileSha256)) throw new Error("invalid_workbook_hash");
  const seen = new Set<string>();
  const routePermissions = new Map<string, Record<string, "view" | "edit" | "approve">>();
  input.workbook.entries.forEach((entry) => {
    const requirements = navigationRouteRequirements(entry.route);
    const routeRequirement = requirements.at(-1);
    if (!routeRequirement) throw new Error("knowledge_route_not_allow_listed");
    const rank = { view: 1, edit: 2, approve: 3 } as const;
    if (!entry.requiredCapabilities.includes(routeRequirement.capability) || rank[entry.requiredAccess] < rank[routeRequirement.minimumAccess]) {
      throw new Error("knowledge_route_access_below_catalogue");
    }
    routePermissions.set(entry.route, requirements.reduce<Record<string, "view" | "edit" | "approve">>((result, requirement) => {
      const existing = result[requirement.capability];
      if (!existing || rank[requirement.minimumAccess] > rank[existing]) result[requirement.capability] = requirement.minimumAccess;
      return result;
    }, {}));
    const key = `${entry.route}\u0000${entry.title.toLowerCase()}`;
    if (seen.has(key)) throw new Error("duplicate_knowledge_entry");
    seen.add(key);
  });

  return {
    importRow: {
      file_name: input.fileName.slice(0, 255),
      file_sha256: input.fileSha256,
      template_version: input.workbook.metadata.templateVersion,
      content_version: input.workbook.metadata.contentVersion,
      knowledge_base_name: input.workbook.metadata.knowledgeBaseName,
      owner_label: input.workbook.metadata.owner,
      classification: input.workbook.metadata.classification,
      status: "importing" as const,
      total_rows: input.workbook.entries.length,
      valid_rows: input.workbook.entries.length,
      invalid_rows: 0,
      created_by: input.actorProfileId,
    },
    importRows: input.workbook.entries.map((entry, index) => ({
      row_number: index + 2,
      route: entry.route,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      source_reference: entry.sourceReference,
      required_capabilities: entry.requiredCapabilities,
      required_access: entry.requiredAccess,
      route_required_permissions: routePermissions.get(entry.route),
      status: "valid" as const,
      validation_errors: [] as string[],
    })),
    entries: input.workbook.entries.map((entry) => ({
      route: entry.route,
      title: entry.title,
      content: entry.content,
      tags: entry.tags,
      source_reference: entry.sourceReference,
      required_capabilities: entry.requiredCapabilities,
      required_access: entry.requiredAccess,
      route_required_permissions: routePermissions.get(entry.route),
      version: input.workbook.metadata.contentVersion,
      status: "draft" as const,
      is_revoked: false,
      created_by: input.actorProfileId,
      updated_by: input.actorProfileId,
    })),
  };
}
