"use client";

import { useMemo, useState } from "react";
import { DocumentVisualCard } from "@/components/document-visual-card";
import {
  buildIntermediaryDocumentSlots,
  findDocumentForSlot,
  slotTitle,
  type IntermediaryDocumentRecord,
} from "@/lib/intermediary-document-slots";

const marksheetOptions = [
  ["education_10th_marksheet", "10th Marksheet"],
  ["education_12th_marksheet", "12th Marksheet"],
  ["education_graduation_marksheet", "Graduation Marksheet"],
  ["education_post_graduation_marksheet", "Post Graduation Marksheet"],
] as const;

type GridDocument = IntermediaryDocumentRecord & {
  href?: string | null;
};

type Props = {
  documents: GridDocument[];
  legacy: boolean;
  hasGst: boolean;
  editable: boolean;
  missingDocument?: string | null;
  onFileSelection?: (name: string, selected: boolean) => void;
};

type CustomDialogState = {
  slotKey: string;
  title: string;
  existingLabel: string;
} | null;

export function IntermediaryDocumentGrid({
  documents,
  legacy,
  hasGst,
  editable,
  missingDocument = null,
  onFileSelection,
}: Props) {
  const slots = useMemo(() => buildIntermediaryDocumentSlots({ legacy, hasGst }), [hasGst, legacy]);
  const [customDialog, setCustomDialog] = useState<CustomDialogState>(null);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(documents.filter((item) => item.document_type.startsWith("custom_")).map((item) => [item.document_type, item.document_label ?? ""])),
  );
  const [selectedNames, setSelectedNames] = useState<Record<string, string>>({});
  const [selectedMarksheetType, setSelectedMarksheetType] = useState(() => {
    const education = documents.find((item) => item.document_type.startsWith("education_"));
    return education?.document_type ?? "";
  });

  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {slots.map((slot) => {
          const document = findDocumentForSlot(slot, documents);
          const title = slotTitle(slot, document);
          const missing = missingDocument === slot.key || (slot.education && missingDocument === "education_document_type");
          const selectedName = selectedNames[slot.key];
          const inputName = slot.education ? "education_marksheet" : slot.key;
          const inputId = `upload-${slot.key}`;
          const emptyOptional = !document && !slot.required;
          const status = missing ? "Action required" : document ? "Uploaded" : selectedName ? "Ready" : slot.required ? "Required" : "Optional";
          const tone = missing ? "error" : document || selectedName ? "uploaded" : slot.required ? "required" : "optional";

          return (
            <DocumentVisualCard
              id={`document-${slot.key}`}
              key={slot.key}
              type={slot.key}
              title={title}
              fileName={document?.file_name || selectedName}
              required={slot.required}
              status={status}
              tone={tone}
              compact
              muted={emptyOptional && !editable}
              action={document?.href ? (
                <a href={document.href} target="_blank" rel="noreferrer" className="inline-flex h-7 items-center rounded-lg border border-[#D7DDF0] bg-white px-2.5 text-[8.5px] font-semibold text-[#24345A] shadow-sm">Open</a>
              ) : null}
            >
              {editable ? (
                <div className="space-y-2">
                  {slot.education ? (
                    <select
                      name="education_document_type"
                      value={selectedMarksheetType}
                      onChange={(event) => setSelectedMarksheetType(event.target.value)}
                      required={Boolean(selectedName)}
                      className="h-8 w-full rounded-lg border border-[#DCE5EF] bg-white px-2 text-[8.5px] font-semibold text-[#334155] outline-none focus:border-[#635BFF]"
                    >
                      <option value="">Select marksheet</option>
                      {marksheetOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                    </select>
                  ) : null}

                  {slot.custom ? (
                    <>
                      <input type="hidden" name={`${slot.key}_label`} value={customLabels[slot.key] ?? document?.document_label ?? ""} />
                      <button
                        type="button"
                        onClick={() => setCustomDialog({ slotKey: slot.key, title, existingLabel: customLabels[slot.key] ?? document?.document_label ?? "" })}
                        className="inline-flex h-8 w-full items-center justify-center rounded-lg bg-gradient-to-r from-[#635BFF] to-[#4B8DF8] px-3 text-[8.5px] font-semibold text-white"
                      >
                        {document || selectedName ? "Replace / rename" : "Add document"}
                      </button>
                    </>
                  ) : (
                    <>
                      <input
                        id={inputId}
                        name={inputName}
                        type="file"
                        required={slot.required && !document}
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(event) => {
                          const file = event.currentTarget.files?.[0];
                          setSelectedNames((current) => ({ ...current, [slot.key]: file?.name ?? "" }));
                          onFileSelection?.(slot.key, Boolean(file));
                        }}
                        className="sr-only"
                      />
                      <label htmlFor={inputId} className="inline-flex h-8 w-full cursor-pointer items-center justify-center rounded-lg bg-gradient-to-r from-[#635BFF] to-[#4B8DF8] px-3 text-[8.5px] font-semibold text-white">
                        {document ? "Replace" : "Upload"}
                      </label>
                    </>
                  )}
                </div>
              ) : null}
            </DocumentVisualCard>
          );
        })}
      </div>

      {customDialog ? (
        <CustomDocumentDialog
          state={customDialog}
          onClose={() => setCustomDialog(null)}
          onConfirm={(label, file) => {
            const input = document.getElementById(`custom-file-${customDialog.slotKey}`) as HTMLInputElement | null;
            if (input) {
              const transfer = new DataTransfer();
              transfer.items.add(file);
              input.files = transfer.files;
            }
            setCustomLabels((current) => ({ ...current, [customDialog.slotKey]: label }));
            setSelectedNames((current) => ({ ...current, [customDialog.slotKey]: file.name }));
            onFileSelection?.(customDialog.slotKey, true);
            setCustomDialog(null);
          }}
        />
      ) : null}

      {editable ? slots.filter((slot) => slot.custom).map((slot) => (
        <input key={slot.key} id={`custom-file-${slot.key}`} name={slot.key} type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only" />
      )) : null}
    </>
  );
}

function CustomDocumentDialog({
  state,
  onClose,
  onConfirm,
}: {
  state: NonNullable<CustomDialogState>;
  onClose: () => void;
  onConfirm: (label: string, file: File) => void;
}) {
  const [label, setLabel] = useState(state.existingLabel);
  const [file, setFile] = useState<File | null>(null);
  const validLabel = label.trim().length > 0 && label.trim().length <= 60 && /[A-Za-z0-9]/.test(label);

  return (
    <div className="fixed inset-0 z-[230] grid place-items-center bg-[#07152D]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Add other document">
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_30px_90px_rgba(15,23,42,.3)]">
        <div className="border-b border-[#E2E8F0] px-5 py-4">
          <p className="text-[9px] font-semibold uppercase tracking-[.08em] text-[#635BFF]">Other document</p>
          <h2 className="mt-1 text-[16px] font-semibold text-[#0F172A]">Name and choose the document</h2>
        </div>
        <div className="space-y-4 px-5 py-5">
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold text-[#344054]">Document name *</label>
            <input value={label} onChange={(event) => setLabel(event.target.value)} maxLength={60} placeholder="Example: Address proof" className="h-11 w-full rounded-xl border border-[#CBD5E1] px-3.5 text-[11px] outline-none focus:border-[#635BFF] focus:ring-2 focus:ring-[#E7E5FF]" autoFocus />
            <p className="mt-1 text-[8.5px] text-[#64748B]">Maximum 60 characters.</p>
          </div>
          <div>
            <label className="mb-1.5 block text-[10px] font-semibold text-[#344054]">File *</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} className="block w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-[10px]" />
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
          <button type="button" onClick={onClose} className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] font-semibold text-[#475569]">Cancel</button>
          <button type="button" disabled={!validLabel || !file} onClick={() => file && onConfirm(label.trim(), file)} className="h-10 rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4B8DF8] px-4 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">Use document</button>
        </div>
      </div>
    </div>
  );
}
