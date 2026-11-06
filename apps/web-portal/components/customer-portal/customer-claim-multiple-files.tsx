"use client";

import { useState } from "react";
import { FileText } from "lucide-react";
import type { CustomerClaimFile } from "./customer-claim-compact-document";
import { CustomerSpotAttachmentDelete } from "./customer-spot-attachment-delete";

export function CustomerClaimMultipleFiles({ documents, accountId, claimId, allowDelete }: {
  documents: CustomerClaimFile[]; accountId: string; claimId: string; allowDelete: boolean;
}) {
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const shown = documents.filter(file => !deletedIds.includes(file.id));
  return <>
    <span className="text-[11px] font-semibold text-[#087A57]">{shown.length} Uploaded</span>
    {shown.length > 0 ? <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
      {shown.map(file => <div key={file.id} className="flex min-w-0 items-center rounded-lg border border-[#CCD4DF] bg-[#F8FAFC] pr-1">
        <a href={`/customer/claim-documents/${encodeURIComponent(file.id)}/open?account=${encodeURIComponent(accountId)}&claim=${encodeURIComponent(claimId)}`}
          target="_blank" rel="noopener noreferrer" title={file.file_name || "Uploaded document"}
          className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-[11px] text-[#204D83] hover:underline focus-visible:outline-2 focus-visible:outline-[#1769DC]">
          <FileText className="h-4 w-4 shrink-0" aria-hidden="true"/>
          <span className="truncate">{file.file_name || "Uploaded document"}</span>
        </a>
        {allowDelete && file.verification_status === "pending" ?
          <CustomerSpotAttachmentDelete accountId={accountId} claimId={claimId}
            documentId={file.id} fileName={file.file_name || "Uploaded document"}
            onDeleted={id => setDeletedIds(prev => [...prev,id])}/> : null}
      </div>)}
    </div> : null}
  </>;
}
