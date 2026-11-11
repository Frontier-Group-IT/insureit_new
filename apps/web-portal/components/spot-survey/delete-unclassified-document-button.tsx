"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { deleteVerifiedSpotSurveyDocument } from "@/app/claims/[id]/spot-survey-actions";
import { ClaimStageErrorDialog } from "@/components/claim-manager/claim-stage-error-dialog";

export function DeleteUnclassifiedDocumentButton({
  claimId, documentId, fileName,
}: {
  claimId: string;
  documentId: string;
  fileName: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function removeDocument() {
    if (pending || !window.confirm(`Permanently delete "${fileName}" from this claim? This cannot be undone.`)) return;
    startTransition(async () => {
      try {
        const result = await deleteVerifiedSpotSurveyDocument(claimId, documentId);
        if (!result.ok) {
          setError(result.message || "Unable to delete document. Please try again.");
          return;
        }
        router.refresh();
      } catch {
        setError("Unable to delete document. Please try again.");
      }
    });
  }

  return <>
    <button
      type="button"
      aria-label={`Delete ${fileName}`}
      title={`Delete ${fileName}`}
      disabled={pending}
      onClick={removeDocument}
      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-red-600 transition hover:bg-red-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-600 disabled:cursor-wait disabled:opacity-50"
    >
      <Trash2 aria-hidden="true" className="h-4 w-4" />
    </button>
    <ClaimStageErrorDialog message={error} onClose={() => setError(null)} title="Delete document failed" />
  </>;
}
