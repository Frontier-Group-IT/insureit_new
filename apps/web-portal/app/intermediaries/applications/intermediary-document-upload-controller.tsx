"use client";

import { useEffect, useState } from "react";

const STANDARD_DOCUMENTS = [
  "aadhaar_front",
  "aadhaar_back",
  "pan_copy",
  "cancelled_cheque",
  "photograph",
] as const;
const LABELS: Record<string, string> = {
  education_marksheet: "Marksheet",
  aadhaar_front: "Aadhaar front",
  aadhaar_back: "Aadhaar back",
  pan_copy: "PAN copy",
  cancelled_cheque: "Cancelled cheque",
  photograph: "Photograph",
  gst_copy: "GST certificate",
};
const MAX_FILE_SIZE = 4 * 1024 * 1024;

type UploadItem = { documentType: string; fieldName: string; file: File; label: string };

export function IntermediaryDocumentUploadController({ applicationId, enabled, showGst = false }: { applicationId: string; enabled: boolean; showGst?: boolean }) {
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const editSection = document.querySelector<HTMLInputElement>('input[name="edit_section"][value="documents"]');
    const form = editSection?.closest("form");
    if (!form) return;

    const handleSubmit = async (event: SubmitEvent) => {
      event.preventDefault();
      event.stopPropagation();
      event.stopImmediatePropagation();
      if (progress) return;
      setError(null);

      if (!form.reportValidity()) return;
      const formData = new FormData(form);
      const items: UploadItem[] = [];
      const marksheet = formData.get("education_marksheet");
      const marksheetType = stringValue(formData.get("education_document_type"));
      if (marksheet instanceof File && marksheet.size > 0) {
        if (!marksheetType) {
          setError("Select the marksheet type before uploading the marksheet.");
          return;
        }
        items.push({ documentType: marksheetType, fieldName: "education_marksheet", file: marksheet, label: LABELS.education_marksheet });
      }
      const standardDocuments = showGst ? [...STANDARD_DOCUMENTS, "gst_copy" as const] : STANDARD_DOCUMENTS;
      for (const fieldName of standardDocuments) {
        const selected = formData.get(fieldName);
        if (selected instanceof File && selected.size > 0) {
          items.push({ documentType: fieldName, fieldName, file: selected, label: LABELS[fieldName] });
        }
      }

      const oversized = items.find((item) => item.file.size > MAX_FILE_SIZE);
      if (oversized) {
        setError(`${oversized.label} must be 4 MB or smaller.`);
        return;
      }

      try {
        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          setProgress(`Uploading ${item.label} (${index + 1} of ${items.length})`);
          const uploadData = new FormData();
          uploadData.set("application_id", applicationId);
          uploadData.set("document_type", item.documentType);
          uploadData.set("file", item.file, item.file.name);
          const response = await fetch("/api/intermediary-documents/upload", { method: "POST", body: uploadData });
          const result = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
          if (!response.ok || !result?.ok) throw new Error(result?.message || `${item.label} could not be uploaded.`);
        }

        setProgress("Checking required documents");
        const finalResponse = await fetch("/api/intermediary-documents/finalize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ application_id: applicationId }),
        });
        const finalResult = (await finalResponse.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
        if (!finalResponse.ok || !finalResult?.ok) throw new Error(finalResult?.message || "The document stage could not be saved.");

        window.location.replace(`/intermediaries/applications/${applicationId}?success=documents_saved&stage=documents`);
      } catch (uploadError) {
        setProgress(null);
        setError(uploadError instanceof Error ? uploadError.message : "The documents could not be uploaded.");
      }
    };

    form.addEventListener("submit", handleSubmit, true);
    return () => form.removeEventListener("submit", handleSubmit, true);
  }, [applicationId, enabled, progress, showGst]);

  return (
    <>
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[10.5px] font-medium text-red-700">{error}</div> : null}
      {progress ? (
        <div className="fixed inset-0 z-[220] grid place-items-center bg-[#07152D]/55 px-4 backdrop-blur-sm" role="status" aria-live="polite">
          <div className="w-full max-w-sm rounded-2xl border border-white/60 bg-white p-5 text-center shadow-[0_28px_80px_rgba(15,23,42,.28)]">
            <div className="mx-auto h-9 w-9 animate-spin rounded-full border-4 border-[#E2E8F0] border-t-[#635BFF]" />
            <p className="mt-4 text-[13px] font-semibold text-[#0F172A]">Saving documents</p>
            <p className="mt-1 text-[10.5px] text-[#64748B]">{progress}</p>
            <p className="mt-3 text-[9px] text-[#94A3B8]">Keep this page open until the upload is complete.</p>
          </div>
        </div>
      ) : null}
    </>
  );
}

function stringValue(value: FormDataEntryValue | null) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
