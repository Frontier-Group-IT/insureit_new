/**
 * Customer-visible claim document re-upload state.  Reuse Operations' existing
 * claim_document_reuploaded events; never derive requests from claim progress.
 */
export type ClaimReuploadEvent = {
  id: string;
  title: string;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};
export type ClaimReuploadDocument = {
  id: string;
  document_type: string;
  verification_status: string | null;
  created_at: string;
};
export type ClaimReuploadRequest = {
  id: string;
  documentType: string;
  reason: string;
  stage: "spot_intimation" | "claim_intimation";
  status: "action_required" | "awaiting_verification";
};

export const normalizeClaimDocumentType = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

const aliases: Record<string, string> = {
  spotphoto: "accidentphoto",
  accidentphotos: "accidentphoto",
  grbill: "grloadbill",
  drivinglicence: "driverlicence",
  driverslicence: "driverlicence",
};

export function sameClaimDocumentType(a: string, b: string) {
  const left = normalizeClaimDocumentType(a);
  const right = normalizeClaimDocumentType(b);
  return (aliases[left] ?? left) === (aliases[right] ?? right);
}

const spotDocuments = new Set([
  "accidentphoto", "rccopy", "insurancecopy", "driverlicence", "grloadbill",
  "accidentvideo", "spotintimationattachment", "incidentvoicenote",
  "audio", "voicenote", "incidentaudio", "otherdocument",
]);
export function claimReuploadStage(documentType: string): ClaimReuploadRequest["stage"] {
  return spotDocuments.has(normalizeClaimDocumentType(documentType)) ? "spot_intimation" : "claim_intimation";
}

export function resolveClaimReuploadRequests(
  events: ClaimReuploadEvent[],
  documents: ClaimReuploadDocument[],
): ClaimReuploadRequest[] {
  const seenTypes = new Set<string>();
  const sortedEvents = [...events].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
  return sortedEvents.flatMap((event): ClaimReuploadRequest[] => {
    const type = typeof event.metadata?.document_type === "string"
      ? event.metadata.document_type.trim() : "";
    const documentId = typeof event.metadata?.document_id === "string"
      ? event.metadata.document_id : "";
    // A real document from this customer-scoped claim must anchor every request.
    const original = documents.find(doc => doc.id === documentId && sameClaimDocumentType(doc.document_type, type));
    if (!type || !original) return [];
    const family = normalizeClaimDocumentType(type);
    if (seenTypes.has(family)) return [];
    seenTypes.add(family);
    if (original.verification_status !== "rejected") return [];
    const replacement = documents
      .filter(doc => doc.id !== original.id && sameClaimDocumentType(doc.document_type, type)
        && Date.parse(doc.created_at) > Date.parse(event.created_at))
      .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
    if (replacement?.verification_status === "verified") return [];
    return [{
      id: event.id,
      documentType: type,
      reason: event.message?.trim() || "Operations could not verify this file. Please upload a clearer replacement.",
      stage: claimReuploadStage(type),
      status: replacement && replacement.verification_status !== "rejected"
        ? "awaiting_verification" : "action_required",
    }];
  });
}
