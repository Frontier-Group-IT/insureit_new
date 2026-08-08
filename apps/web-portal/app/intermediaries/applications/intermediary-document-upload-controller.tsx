"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { buildIntermediaryDocumentSlots } from "@/lib/intermediary-document-slots";

const LABELS: Record<string, string> = {
  education: "Education Marksheet",
  aadhaar_front: "Aadhaar front",
  aadhaar_back: "Aadhaar back",
  pan_copy: "PAN copy",
  cancelled_cheque: "Cancelled cheque",
  photograph: "Photograph",
  gst_copy: "GST certificate",
  training_certificate: "Training certificate",
  registration_certificate: "Registration certificate",
  agreement_copy: "Agreement copy",
};
const MAX_FILE_SIZE = 4 * 1024 * 1024;

type UploadItem = { documentType: string; fieldName: string; file: File; label: string; documentLabel?: string | null };
type UploadResult = {
  ok?: boolean;
  message?: string;
  finalize_required?: boolean;
  maintenance_mode?: boolean;
};

export function IntermediaryDocumentUploadController({
  applicationId,
  enabled,
  showGst = false,
  legacyDocuments = false,
}: {
  applicationId: string;
  enabled: boolean;
  showGst?: boolean;
  legacyDocuments?: boolean;
}) {
  const router = useRouter();
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
      const slots = buildIntermediaryDocumentSlots({ legacy: legacyDocuments, hasGst: showGst });

      for (const slot of slots) {
        if (slot.education) {
          const selected = formData.get("education_marksheet");
          const documentType = stringValue(formData.get("education_document_type"));
          if (selected instanceof File && selected.size > 0) {
            if (!documentType) {
              setError("Select the marksheet type before uploading the marksheet.");
              return;
            }
            items.push({ documentType, fieldName: "education_marksheet", file: selected, label: slot.title });
          }
          continue;
        }

        const selected = formData.get(slot.key);
        if (!(selected instanceof File) || selected.size === 0) continue;
        const documentLabel = slot.custom ? stringValue(formData.get(`${slot.key}_label`)) : null;
        if (slot.custom && !documentLabel) {
          setError("Enter a name for every selected Other Document.");
          return;
        }
        items.push({
          documentType: slot.key,
          fieldName: slot.key,
          file: selected,
          label: documentLabel || LABELS[slot.key] || slot.title,
          documentLabel,
        });
      }

      if (!items.length) {
        setError("Choose at least one document to upload or replace.");
        return;
      }

      const oversized = items.find((item) => item.file.size > MAX_FILE_SIZE);
      if (oversized) {
        setError(`${oversized.label} must be 4 MB or smaller.`);
        return;
      }

      try {
        let finalizeRequired = false;

        for (let index = 0; index < items.length; index += 1) {
          const item = items[index];
          setProgress(`Uploading ${item.label} (${index + 1} of ${items.length})`);
          const uploadData = new FormData();
          uploadData.set("application_id", applicationId);
          uploadData.set("document_type", item.documentType);
          if (item.documentLabel) uploadData.set("document_label", item.documentLabel);
          uploadData.set("file", item.file, item.file.name);
          const response = await fetch("/api/intermediary-documents/upload", {
            method: "POST",
            body: uploadData,
            credentials: "same-origin",
            cache: "no-store",
          });
          const result = (await response.json().catch(() => null)) as UploadResult | null;
          if (!response.ok || !result?.ok) throw new Error(result?.message || `${item.label} could not be uploaded.`);
          finalizeRequired ||= result.finalize_required === true;
        }

        if (finalizeRequired) {
          setProgress("Checking required documents");
          const finalResponse = await fetch("/api/intermediary-documents/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ application_id: applicationId }),
            credentials: "same-origin",
            cache: "no-store",
          });
          const finalResult = (await finalResponse.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
          if (!finalResponse.ok || !finalResult?.ok) throw new Error(finalResult?.message || "The document stage could not be saved.");
          router.replace(`/intermediaries/applications/${applicationId}?success=partner_id_generated`);
          return;
        }

        router.replace(`/intermediaries/applications/${applicationId}?success=documents_updated`);
      } catch (uploadError) {
        setProgress(null);
        setError(uploadError instanceof Error ? uploadError.message : "The documents could not be uploaded.");
      }
    };

    form.addEventListener("submit", handleSubmit, true);
    return () => form.removeEventListener("submit", handleSubmit, true);
  }, [applicationId, enabled, legacyDocuments, progress, router, showGst]);

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
