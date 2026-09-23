"use client";

import { FileText, Trash2, Upload, X } from "lucide-react";
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
  return <>{DOCUMENTS.map((document) => (
    <DocumentPickerCard
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
  ))}</>;
}

function DocumentPickerCard({
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
  const hasDocument = Boolean(file || existingDocument);
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

  return (
    <div className={`flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 ${hasDocument ? "border-[#A7D8C1] bg-[#F2FBF6]" : "border-dashed border-[#CDD6E3] bg-[#FAFBFD]"}`}>
      <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${hasDocument ? "bg-[#DFF4E8] text-[#14845B]" : "bg-[#EEF4FF] text-[#315B9A]"}`}>
        <FileText className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-semibold text-[#344054]">{label}</p>
        <p className={`mt-0.5 truncate text-[8.5px] ${hasDocument ? "font-medium text-[#14845B]" : "text-[#98A2B3]"}`} title={shownName}>
          {file ? file.name : existingDocument ? existingDocument.fileName : "PDF, JPG, PNG or WebP · Max 50 MB"}
        </p>
        {stagedReplacement ? <p className="mt-0.5 text-[8px] font-medium text-[#667085]">Selected file will replace the saved document after Save.</p> : null}
      </div>
      <input
        ref={inputRef}
        id={`non-motor-document-${type}`}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(event) => {
          selectFile(event.target.files?.[0]);
          event.currentTarget.value = "";
        }}
      />
      {file ? (
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg border border-[#B8DCCA] bg-white px-2.5 py-1.5 text-[8.5px] font-bold text-[#14845B]">Replace</button>
          <button type="button" onClick={onRemoveStaged} aria-label={`Remove selected ${label}`} className="grid h-7 w-7 place-items-center rounded-lg text-[#667085] hover:bg-white"><X className="h-3.5 w-3.5" /></button>
        </div>
      ) : existingDocument ? (
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={() => inputRef.current?.click()} className="rounded-lg border border-[#B8DCCA] bg-white px-2.5 py-1.5 text-[8.5px] font-bold text-[#14845B]">Re-upload</button>
          {onDeleteExisting ? (
            <button type="button" disabled={deleting} onClick={onDeleteExisting} aria-label={`Delete ${label}`} className="grid h-7 w-7 place-items-center rounded-lg text-[#B42318] hover:bg-white disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()} className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#17365D] px-3 py-1.5 text-[8.5px] font-bold text-white">
          <Upload className="h-3.5 w-3.5" /> Upload
        </button>
      )}
    </div>
  );
}
