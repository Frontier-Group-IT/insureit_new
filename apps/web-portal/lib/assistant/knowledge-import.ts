import type { AssistantKnowledgeEntry, AssistantKnowledgeMetadata } from "./knowledge-schema.ts";

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
  input.workbook.entries.forEach((entry) => {
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
      version: input.workbook.metadata.contentVersion,
      status: "draft" as const,
      is_revoked: false,
      created_by: input.actorProfileId,
      updated_by: input.actorProfileId,
    })),
  };
}
