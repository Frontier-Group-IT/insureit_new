"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
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

type ContextPayload = {
  ok?: boolean;
  legacy?: boolean;
  has_gst?: boolean;
  documents?: GridDocument[];
  message?: string;
};

type Props = {
  documents: GridDocument[];
  legacy: boolean;
  hasGst: boolean;
  editable: boolean;
  applicationId?: string;
  missingDocument?: string | null;
  onFileSelection?: (name: string, selected: boolean) => void;
};

type CustomDialogState = {
  slotKey: string;
  title: string;
  existingLabel: string;
  hasExistingDocument: boolean;
} | null;

export function IntermediaryDocumentGrid({
  documents,
  legacy,
  hasGst,
  editable,
  applicationId,
  missingDocument = null,
  onFileSelection,
}: Props) {
  const pathname = usePathname();
  const routeApplicationId = pathname.match(/^\/intermediaries\/applications\/([^/]+)/)?.[1] ?? null;
  const resolvedApplicationId = applicationId ?? routeApplicationId;
  const [resolvedDocuments, setResolvedDocuments] = useState<GridDocument[]>(documents);
  const [resolvedLegacy, setResolvedLegacy] = useState(legacy);
  const [resolvedHasGst, setResolvedHasGst] = useState(hasGst);
  const [customDialog, setCustomDialog] = useState<CustomDialogState>(null);
  const [customLabels, setCustomLabels] = useState<Record<string, string>>(() => customLabelMap(documents));
  const [selectedNames, setSelectedNames] = useState<Record<string, string>>({});
  const [selectedMarksheetType, setSelectedMarksheetType] = useState(() => currentEducationType(documents));
  const [maintenanceMessage, setMaintenanceMessage] = useState<string | null>(null);
  const [maintenanceBusy, setMaintenanceBusy] = useState(false);

  useEffect(() => {
    setResolvedDocuments(documents);
    setResolvedLegacy(legacy);
    setResolvedHasGst(hasGst);
    setCustomLabels((current) => ({ ...customLabelMap(documents), ...current }));
    setSelectedMarksheetType((current) => current || currentEducationType(documents));
  }, [documents, hasGst, legacy]);

  useEffect(() => {
    if (!resolvedApplicationId) return;
    let cancelled = false;

    void fetch(`/api/intermediary-documents/context?application_id=${encodeURIComponent(resolvedApplicationId)}`, {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => null)) as ContextPayload | null;
        if (!response.ok || !payload?.ok) throw new Error(payload?.message || "The document context could not be loaded.");
        return payload;
      })
      .then((payload) => {
        if (cancelled) return;
        const nextDocuments = payload.documents ?? [];
        setResolvedDocuments(nextDocuments);
        setResolvedLegacy(payload.legacy === true);
        setResolvedHasGst(payload.has_gst === true);
        setCustomLabels((current) => ({ ...customLabelMap(nextDocuments), ...current }));
        setSelectedMarksheetType((current) => current || currentEducationType(nextDocuments));
      })
      .catch(() => {
        // Keep the server-rendered fallback. A failed enhancement must not block uploads or reviews.
      });

    return () => {
      cancelled = true;
    };
  }, [resolvedApplicationId]);

  const slots = useMemo(
    () => buildIntermediaryDocumentSlots({ legacy: resolvedLegacy, hasGst: resolvedHasGst, documents: resolvedDocuments }),
    [resolvedDocuments, resolvedHasGst, resolvedLegacy],
  );

  async function renameCustomDocument(slotKey: string, label: string) {
    if (!resolvedApplicationId) return false;
    setMaintenanceBusy(true);
    setMaintenanceMessage(null);
    try {
      const response = await fetch("/api/intermediary-documents/custom", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ application_id: resolvedApplicationId, document_type: slotKey, document_label: label }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.message || "The document could not be renamed.");
      setResolvedDocuments((current) => current.map((item) => item.document_type === slotKey ? { ...item, document_label: label } : item));
      setCustomLabels((current) => ({ ...current, [slotKey]: label }));
      setMaintenanceMessage("Document name updated.");
      return true;
    } catch (error) {
      setMaintenanceMessage(error instanceof Error ? error.message : "The document could not be renamed.");
      return false;
    } finally {
      setMaintenanceBusy(false);
    }
  }



  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        {slots.map((slot) => {
          const existingDocument = findDocumentForSlot(slot, resolvedDocuments) as GridDocument | undefined;
          const title = slotTitle(slot, existingDocument);
          const missing = missingDocument === slot.key || (slot.education && missingDocument === "education_document_type");
          const selectedName = selectedNames[slot.key];
          const inputName = slot.education ? "education_marksheet" : slot.key;
          const inputId = `upload-${slot.key}`;
          const emptyOptional = !existingDocument && !slot.required;
          const status = missing
            ? "Action required"
            : existingDocument
              ? "Uploaded"
              : selectedName
                ? "Ready"
                : slot.system
                  ? "Registration stage"
                  : slot.required
                    ? "Required"
                    : "Optional";
          const tone = missing ? "error" : existingDocument || selectedName ? "uploaded" : slot.required ? "required" : "optional";

          return (
            <DocumentVisualCard
              id={`document-${slot.key}`}
              key={slot.key}
              type={slot.key}
              title={title}
              fileName={existingDocument?.file_name || selectedName}
              required={slot.required}
              status={status}
              tone={tone}
              compact
              muted={emptyOptional && !editable && !slot.system}
              action={(existingDocument?.href || (editable && (slot.system ? Boolean(existingDocument) : true))) ? (
                <div className="flex items-center gap-1.5">
                  {existingDocument?.href ? (
                    <a
                      href={existingDocument.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`View ${title}`}
                      title="View"
                      className={compactActionClass}
                    >
                      <EyeIcon />
                    </a>
                  ) : null}
                  {editable && slot.system && existingDocument ? (
                    <a
                      href={`${pathname}?stage=registration`}
                      aria-label={`Replace ${title}`}
                      title="Replace"
                      className={compactActionClass}
                    >
                      <RefreshIcon />
                    </a>
                  ) : editable && !slot.system && slot.custom ? (
                    <button
                      type="button"
                      disabled={maintenanceBusy}
                      onClick={() => setCustomDialog({
                        slotKey: slot.key,
                        title,
                        existingLabel: customLabels[slot.key] ?? existingDocument?.document_label ?? "",
                        hasExistingDocument: Boolean(existingDocument),
                      })}
                      aria-label={existingDocument || selectedName ? `Replace ${title}` : `Add ${title}`}
                      title={existingDocument || selectedName ? "Replace" : "Add document"}
                      className={`${compactActionClass} disabled:cursor-not-allowed disabled:opacity-50`}
                    >
                      {existingDocument || selectedName ? <RefreshIcon /> : <PlusIcon />}
                    </button>
                  ) : editable && !slot.system ? (
                    <label
                      htmlFor={inputId}
                      aria-label={existingDocument || selectedName ? `Replace ${title}` : `Upload ${title}`}
                      title={existingDocument || selectedName ? "Replace" : "Add document"}
                      className={`${compactActionClass} cursor-pointer`}
                    >
                      {existingDocument || selectedName ? <RefreshIcon /> : <PlusIcon />}
                    </label>
                  ) : null}
                </div>
              ) : null}
            >
              {slot.system && !existingDocument ? (
                <p className="text-[8px] font-medium leading-4 text-[#64748B]">This slot is reserved for the signed certificate uploaded during Registration.</p>
              ) : editable && !slot.system ? (
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
                    <input type="hidden" name={`${slot.key}_label`} value={customLabels[slot.key] ?? existingDocument?.document_label ?? ""} />
                  ) : (
                    <input
                      id={inputId}
                      name={inputName}
                      type="file"
                      required={slot.required && !existingDocument}
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0];
                        setSelectedNames((current) => ({ ...current, [slot.key]: file?.name ?? "" }));
                        onFileSelection?.(slot.key, Boolean(file));
                      }}
                      className="sr-only"
                    />
                  )}
                </div>
              ) : null}
            </DocumentVisualCard>
          );
        })}
      </div>

      {maintenanceMessage ? <p className="mt-3 rounded-xl border border-[#DCE5EF] bg-[#F8FAFC] px-3 py-2 text-[9px] font-semibold text-[#475569]">{maintenanceMessage}</p> : null}

      {customDialog ? (
        <CustomDocumentDialog
          state={customDialog}
          busy={maintenanceBusy}
          onClose={() => setCustomDialog(null)}
          onConfirm={async (label, file) => {
            if (!file && customDialog.hasExistingDocument) {
              const renamed = await renameCustomDocument(customDialog.slotKey, label);
              if (renamed) setCustomDialog(null);
              return;
            }
            if (!file) return;
            const input = globalThis.document.getElementById(`custom-file-${customDialog.slotKey}`) as HTMLInputElement | null;
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

const compactActionClass = "inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#D7DDF0] bg-white text-[#0F2A55] shadow-[0_4px_12px_rgba(15,23,42,0.08)] transition hover:border-[#B8C7DE] hover:bg-[#F8FAFC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C7D2FE]";

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M2.5 12s3.4-5.5 9.5-5.5 9.5 5.5 9.5 5.5-3.4 5.5-9.5 5.5S2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.6" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 7v5h-5" />
      <path d="M4 17v-5h5" />
      <path d="M6.1 8.1A7 7 0 0 1 18.7 9L20 12" />
      <path d="M17.9 15.9A7 7 0 0 1 5.3 15L4 12" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function CustomDocumentDialog({
  state,
  busy,
  onClose,
  onConfirm,
}: {
  state: NonNullable<CustomDialogState>;
  busy: boolean;
  onClose: () => void;
  onConfirm: (label: string, file: File | null) => void | Promise<void>;
}) {
  const [label, setLabel] = useState(state.existingLabel);
  const [file, setFile] = useState<File | null>(null);
  const validLabel = label.trim().length > 0 && label.trim().length <= 60 && /[A-Za-z0-9]/.test(label);
  const canConfirm = validLabel && (Boolean(file) || state.hasExistingDocument);

  return (
    <div className="fixed inset-0 z-[230] grid place-items-center bg-[#07152D]/55 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Manage other document">
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
            <label className="mb-1.5 block text-[10px] font-semibold text-[#344054]">{state.hasExistingDocument ? "Replacement file (optional)" : "File *"}</label>
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" onChange={(event) => setFile(event.currentTarget.files?.[0] ?? null)} className="block w-full rounded-xl border border-[#CBD5E1] bg-white px-3 py-2 text-[10px]" />
            {state.hasExistingDocument ? <p className="mt-1 text-[8.5px] text-[#64748B]">Leave the file empty to rename the existing document only.</p> : null}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#E2E8F0] bg-[#F8FAFC] px-5 py-4">
          <button type="button" disabled={busy} onClick={onClose} className="h-10 rounded-xl border border-[#CBD5E1] bg-white px-4 text-[10px] font-semibold text-[#475569] disabled:opacity-50">Cancel</button>
          <button type="button" disabled={!canConfirm || busy} onClick={() => void onConfirm(label.trim(), file)} className="h-10 rounded-xl bg-gradient-to-r from-[#635BFF] to-[#4B8DF8] px-4 text-[10px] font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50">{file ? "Use document" : "Rename document"}</button>
        </div>
      </div>
    </div>
  );
}

function customLabelMap(documents: GridDocument[]) {
  return Object.fromEntries(
    documents
      .filter((item) => item.document_type.startsWith("custom_"))
      .map((item) => [item.document_type, item.document_label ?? ""]),
  );
}

function currentEducationType(documents: GridDocument[]) {
  return documents.find((item) => item.document_type.startsWith("education_"))?.document_type ?? "";
}
