"use client";

import { useState } from "react";
import type { CustomerClaimFile } from "./customer-claim-compact-document";
import { CustomerSpotAttachmentDelete } from "./customer-spot-attachment-delete";

export function CustomerClaimSavedVoiceNotes({ documents, accountId, claimId, allowDelete }: {
  documents: CustomerClaimFile[]; accountId: string; claimId: string; allowDelete: boolean;
}) {
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const audioDocs = documents.filter(file =>
    ["incidentvoicenote","audio","voicenote","incidentaudio"].includes(
      file.document_type.toLowerCase().replace(/[^a-z0-9]/g,"")
    ) && !deletedIds.includes(file.id));
  if (!audioDocs.length) return null;
  return <div className="mt-3 space-y-2" aria-label="Uploaded voice notes">
    {audioDocs.map(file => <div key={file.id} className="flex min-w-0 flex-wrap items-center gap-2 rounded-lg border border-[#D8E4F0] bg-[#F8FAFC] px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="mb-1 truncate text-[11px] font-semibold text-[#18345C]" title={file.file_name || "Voice note"}>
          {file.file_name || "Voice note"}
        </p>
        <audio controls preload="none" className="h-9 w-full max-w-[360px]"
          aria-label={file.file_name || "Uploaded voice note"}
          src={`/customer/claim-documents/${encodeURIComponent(file.id)}/open?account=${encodeURIComponent(accountId)}&claim=${encodeURIComponent(claimId)}`}/>
      </div>
      {allowDelete && file.verification_status === "pending" ?
        <CustomerSpotAttachmentDelete accountId={accountId} claimId={claimId}
          documentId={file.id} fileName={file.file_name || "Voice note"}
          onDeleted={id => setDeletedIds(prev => [...prev,id])}/> : null}
    </div>)}
  </div>;
}
