"use client";

import { FileText, Files, LoaderCircle, RefreshCw, Trash2, Upload, X } from "lucide-react";
import { useRef } from "react";

export type NonMotorDocumentType = "policy_copy" | "proposal_form" | "kyc" | "other_document";
export type NonMotorStagedDocuments = Partial<Record<NonMotorDocumentType, File>>;
export type ExistingNonMotorDocument = { id: string; fileName: string };
export type ExistingNonMotorDocuments = Partial<Record<NonMotorDocumentType, ExistingNonMotorDocument>>;

const DOCUMENTS: Array<{ type: NonMotorDocumentType; label: string }> = [
  { type: "policy_copy", label: "Policy Copy" },
  { type: "proposal_form", label: "Proposal Form" },
  { type: "kyc", label: "KYC" },
  { type: "other_document", label: "Other Document" },
];

const ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp";
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export function NonMotorDocumentPicker({
  files,
  existingDocuments = {},
  deletingType,
  onChange,
  onDeleteExisting,
  onError,
}: {
  files: NonMotorStagedDocuments;
  existingDocuments?: ExistingNonMotorDocuments;
  deletingType?: NonMotorDocumentType | null;
  onChange: (files: NonMotorStagedDocuments) => void;
  onDeleteExisting?: (type: NonMotorDocumentType) => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="md:col-span-2 xl:col-span-4 flex flex-wrap items-start gap-3">
      {DOCUMENTS.map((document) => (
        <DocumentPickerControl
          key={document.type}
          type={document.type}
          label={document.label}
          file={files[document.type]}
          existingDocument={existingDocuments[document.type]}
          deleting={deletingType === document.type}
          onSelect={(file) => onChange({ ...files, [document.type]: file })}
          onRemoveStaged={() => {
            const next = { ...files };
            delete next[document.type];
            onChange(next);
          }}
          onDeleteExisting={onDeleteExisting ? () => onDeleteExisting(document.type) : undefined}
          onError={onError}
        />
      ))}
    </div>
  );
}

function DocumentPickerControl({
  type,
  label,
  file,
  existingDocument,
  deleting,
  onSelect,
  onRemoveStaged,
  onDeleteExisting,
  onError,
}: {
  type: NonMotorDocumentType;
  label: string;
  file?: File;
  existingDocument?: ExistingNonMotorDocument;
  deleting: boolean;
  onSelect: (file: File) => void;
  onRemoveStaged: () => void;
  onDeleteExisting?: () => void;
  onError: (message: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shownName = file?.name ?? existingDocument?.fileName ?? "";
  const stagedReplacement = Boolean(file && existingDocument);

  function selectFile(fileValue?: File) {
    if (!fileValue) return;
    if (fileValue.size > MAX_FILE_SIZE) {
      onError(`${label} must be 50 MB or smaller.`);
      return;
    }
    if (!["application/pdf", "image/jpeg", "image/png", "image/webp"].includes(fileValue.type)) {
      onError(`${label} must be a PDF, JPG, PNG or WebP file.`);
      return;
    }
    onSelect(fileValue);
  }

  function viewSavedDocument() {
    if (!existingDocument) return;
    window.open(
      `/policies/documents/${encodeURIComponent(existingDocument.id)}/open`,
      "_blank",
      "noopener,noreferrer",
    );
  }

  return (
    <div className="min-w-0">
      <input
        ref={inputRef}
        id={`non-motor-document-${type}`}
        type="file"
        accept={ACCEPT}
        className="sr-only"
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />

      {file ? (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <div
            role="group"
            aria-label={`${label} selected file actions`}
            className="inline-flex h-9 items-stretch overflow-hidden rounded-xl border border-[#BFD3F7] bg-[#F7FAFF] text-[#174EA6]"
          >
            <span className="inline-flex min-w-0 items-center gap-2 px-3 text-[10px] font-semibold">
              <FileText className="h-3.5 w-3.5 shrink-0" />
              {stagedReplacement ? `Replace ${label}` : `Add ${label}`}
            </span>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              aria-label={`Choose another ${label}`}
              title={`Choose another ${label}`}
              className="inline-flex w-9 items-center justify-center bg-[#DBEAFE] text-[#2563EB] transition hover:bg-[#BFDBFE]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onRemoveStaged}
              aria-label={`Remove selected ${label}`}
              title="Remove selected file"
              className="inline-flex w-9 items-center justify-center border-l border-[#E3E8EF] bg-white text-[#667085] transition hover:bg-[#F8FAFC]"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <span title={shownName} className="max-w-[220px] truncate pl-1 text-[8px] font-medium leading-3 text-[#6B7A90]">
            {shownName}
          </span>
          {stagedReplacement ? <span className="pl-1 text-[8px] leading-3 text-[#667085]">Will replace the saved document after Save.</span> : null}
        </div>
      ) : existingDocument ? (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <div
            role="group"
            aria-label={`${label} actions`}
            className="inline-flex h-9 items-stretch overflow-hidden rounded-xl border border-[#BFD3F7] bg-[#F7FAFF] text-[#174EA6]"
          >
            <button
              type="button"
              onClick={viewSavedDocument}
              aria-label={`View ${label}`}
              title={existingDocument.fileName ? `View ${label}: ${existingDocument.fileName}` : `View ${label}`}
              className="inline-flex min-w-0 items-center gap-2 px-3 text-[10px] font-semibold transition hover:bg-[#EEF5FF]"
            >
              <Files className="h-3.5 w-3.5 shrink-0" />
              View {label}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={deleting}
              aria-label={`Re-upload ${label}`}
              title={`Re-upload ${label}`}
              className="inline-flex w-9 items-center justify-center bg-[#DBEAFE] text-[#2563EB] transition hover:bg-[#BFDBFE] disabled:cursor-wait disabled:opacity-60"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
            {onDeleteExisting ? (
              <button
                type="button"
                disabled={deleting}
                onClick={onDeleteExisting}
                aria-label={`Delete ${label}`}
                title={`Delete ${label}`}
                className="inline-flex w-9 items-center justify-center border-l border-[#F2D5D1] bg-[#FFF5F3] text-[#B5534F] transition hover:bg-[#FDE9E6] hover:text-[#9E403C] disabled:cursor-wait disabled:opacity-60"
              >
                {deleting ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              </button>
            ) : null}
          </div>
          <span title={existingDocument.fileName} className="max-w-[220px] truncate pl-1 text-[8px] font-medium leading-3 text-[#6B7A90]">
            {existingDocument.fileName}
          </span>
        </div>
      ) : (
        <div className="flex min-w-0 flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#BFD3F7] bg-[#F7FAFF] px-3 text-[10px] font-semibold text-[#174EA6] transition hover:bg-[#EEF5FF]"
          >
            <Upload className="h-3.5 w-3.5" />
            Add {label}
          </button>
          <span className="pl-1 text-[8px] font-medium leading-3 text-[#98A2B3]">PDF, JPG, PNG or WebP</span>
        </div>
      )}
    </div>
  );
}
