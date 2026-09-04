import { CLAIM_INTIMATION_DOCUMENT_GROUPS } from "@insureit/claim-journey";

export type FinalDocumentDefinition = {
  groupIndex: number;
  groupSr: number;
  type: string;
  name: string;
};

export const finalDocumentTabs = CLAIM_INTIMATION_DOCUMENT_GROUPS.map((group) => group.label);

export const finalDocumentDefinitions: FinalDocumentDefinition[] =
  CLAIM_INTIMATION_DOCUMENT_GROUPS.flatMap((group, groupIndex) =>
    group.documents.map((document, documentIndex) => ({
      groupIndex,
      groupSr: documentIndex + 1,
      type: document.type,
      name: document.title,
    })),
  );
