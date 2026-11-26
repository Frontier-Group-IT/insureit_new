"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { ClaimDocumentDeleteConfirmation } from "@/components/claim-manager/claim-document-delete-confirmation";
import { ClaimStageErrorDialog } from "@/components/claim-manager/claim-stage-error-dialog";
import { deleteCustomerSpotAttachment, deleteCustomerClaimStageDocument } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/delete-document-action";

export function CustomerSpotAttachmentDelete({
  accountId, claimId, documentId, fileName, onDeleted, stage,
}: {
  accountId: string; claimId: string; documentId: string;
  fileName: string; onDeleted?: (id: string) => void;
  stage?: "spot_intimation" | "claim_intimation" | "billing";
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [deleted,setDeleted] = useState(false);
  const remove = () => startTransition(async () => {
    try {
    const result = stage
      ? await deleteCustomerClaimStageDocument(accountId, claimId, documentId, stage)
      : await deleteCustomerSpotAttachment(accountId, claimId, documentId);
    setConfirming(false);
    if (!result.ok) { setError(result.message); return; }
    setDeleted(true);
    } catch { setConfirming(false); setError("Deletion could not be confirmed. Refresh the claim before retrying."); }
  });
  return <>
    <button type="button" disabled={pending || deleted} onClick={() => setConfirming(true)}
      aria-label={`Delete ${fileName}`} title={`Delete ${fileName}`}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-red-600 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-600 disabled:opacity-50">
      <Trash2 className="h-4 w-4" aria-hidden="true"/>
    </button>
    {confirming ? <ClaimDocumentDeleteConfirmation filename={fileName} pending={pending}
      onCancel={() => setConfirming(false)} onConfirm={remove}/> : null}
    <ClaimStageErrorDialog title="Unable to delete document" message={error} onClose={() => setError(null)}/>
    <ClaimStageErrorDialog success title="Success" message={deleted ? "Document deleted successfully." : null} onClose={() => { setDeleted(false); onDeleted?.(documentId); router.refresh(); }}/>
  </>;
}
