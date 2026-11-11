"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, UploadCloud } from "lucide-react";
import { uploadCustomerClaimDocument } from "@/app/customer/(protected)/claims/[id]/stage/[stage]/upload-action";
import { prepareClaimDocumentUpload, finalizeClaimDocumentUpload, cancelClaimDocumentUploads } from "@/app/claims/[id]/claim-document-upload-actions";
import { createSupabaseBrowserClient } from "@/lib/auth";
import { VerifyDocumentButton } from "@/components/spot-survey/verify-buttons";
import { RequestCustomerDocumentReuploadButton } from "@/components/spot-survey/request-customer-document-reupload-button";
import { CustomerSpotAttachmentDelete } from "@/components/customer-portal/customer-spot-attachment-delete";

export type WorkshopBillDocument = { id: string; file_name?: string | null; verification_status?: string | null };
type Props = { mode: "customer" | "operations"; claimId: string; accountId?: string; documents: WorkshopBillDocument[]; readonly?: boolean; compact?: boolean };
const documentType = "Final Workshop Bill";
const maxFileSize = 5 * 1024 * 1024;

export function ExternalClaimBillUpload({ mode, claimId, accountId, documents, readonly = false, compact = false }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [recent, setRecent] = useState<WorkshopBillDocument[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const files = [...recent, ...documents.filter(doc => !recent.some(item => item.id === doc.id))].filter(doc => !deletedIds.includes(doc.id));
  const openFile = (id: string) => mode === "customer"
    ? "/customer/claim-documents/" + encodeURIComponent(id) + "/open?account=" + encodeURIComponent(accountId ?? "") + "&claim=" + encodeURIComponent(claimId)
    : "/claim-documents/" + encodeURIComponent(id) + "/open";

  function selectFile(file?: File) {
    if (!file || pending || readonly) return;
    if (!/\.(pdf|jpe?g|png)$/i.test(file.name) || !["application/pdf","image/jpeg","image/png"].includes(file.type)) {
      setMessage("Select a PDF, JPG or PNG workshop bill."); return;
    }
    if (file.size <= 0 || file.size > maxFileSize) { setMessage("The workshop bill must be 5 MB or smaller."); return; }
    setMessage("");
    startTransition(async () => {
      try {
        if (mode === "customer") {
          if (!accountId) throw new Error("Customer account is missing.");
          const form = new FormData();
          form.set("account", accountId);
          form.set("claim", claimId);
          form.set("stage", "billing");
          form.set("type", documentType);
          form.set("file", file);
          const result = await uploadCustomerClaimDocument({ error: null }, form);
          if (result.error) throw new Error(result.error);
          if (result.uploaded) setRecent(previous => [result.uploaded!, ...previous]);
        } else {
          const prepared = await prepareClaimDocumentUpload(claimId, documentType, { name: file.name, size: file.size, type: file.type });
          const slot = prepared.uploads?.[0];
          if (!prepared.ok || !slot) throw new Error(prepared.message ?? "Could not prepare bill upload.");
          try {
            const uploaded = await createSupabaseBrowserClient().storage.from("claim-documents").uploadToSignedUrl(slot.path, slot.token, file, { contentType: file.type });
            if (uploaded.error) throw new Error(uploaded.error.message);
            const saved = await finalizeClaimDocumentUpload(claimId, documentType, { path: slot.path, fileName: slot.fileName, documentType: slot.documentType });
            if (!saved.ok) throw new Error(saved.message ?? "Could not save workshop bill.");
          } catch (error) {
            try { await cancelClaimDocumentUploads(claimId, [slot.path]); } catch { /* best-effort cleanup */ }
            throw error;
          }
        }
        setMessage("Final workshop bill uploaded successfully.");
        router.refresh();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to upload workshop bill.");
      } finally {
        if (input.current) input.current.value = "";
      }
    });
  }

  const compactBilling = compact;
  return <div className="min-w-0 text-left">
    <p className={compactBilling ? "mb-1 text-[9px] font-semibold uppercase leading-4 tracking-[0.01em] text-[#174EA6]" : "mb-1.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-[#5673B0]"}>Bill Upload</p>
    <div className={compactBilling ? "flex h-[34px] min-w-0 items-center gap-1.5 rounded-md border border-[#D9E3F0] bg-white px-1.5" : "flex min-h-[76px] items-center gap-2 rounded-2xl border-2 border-[#DFE5ED] bg-[#F8FAFD] px-3 py-2"}>
      <img src="/assets/customer-claim/stages/billing.png" alt="" className={compactBilling ? "hidden h-7 w-7 shrink-0 object-contain sm:block" : "h-12 w-12 shrink-0 object-contain"} />
      <div className="min-w-0 flex-1">
        <p className={compactBilling ? "truncate whitespace-nowrap text-[10px] font-semibold text-[#102B54]" : "text-[12px] font-semibold text-[#102B54]"}>Upload final workshop bill</p>
        {!compactBilling ? <p className="text-[10px] text-[#718096]">PDF, JPG, PNG</p> : null}
      </div>
      {!readonly ? <>
        <input ref={input} type="file" accept=".pdf,.jpg,.jpeg,.png" aria-label="Choose final workshop bill" className="sr-only" onChange={event => selectFile(event.target.files?.[0])} />
        <button type="button" disabled={pending} onClick={() => input.current?.click()} className={compactBilling ? "flex h-[26px] shrink-0 items-center gap-1 whitespace-nowrap rounded bg-[#164A9F] px-2 text-[10px] font-semibold text-white disabled:opacity-50" : "flex shrink-0 items-center gap-1 rounded-xl bg-[#164A9F] px-4 py-3 text-[12px] font-semibold text-white disabled:opacity-50"}><UploadCloud className="h-3.5 w-3.5"/>{pending ? "Uploading…" : "Choose File"}</button>
      </> : null}
    </div>
    {message ? <p role="status" className="mt-1 text-[11px] text-[#315B9A]">{message}</p> : null}
    {files.length ? <div className="mt-1 space-y-1">{files.map(file=><div key={file.id} className="flex min-w-0 items-center justify-between gap-2"><a href={openFile(file.id)} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-1 text-[11px] text-[#155EEF] underline"><FileText className="h-3.5 w-3.5 shrink-0"/><span className="truncate">{file.file_name || "Final workshop bill"}</span></a>{mode === "customer" && !readonly && accountId && file.verification_status === "pending" ? <CustomerSpotAttachmentDelete accountId={accountId} claimId={claimId} documentId={file.id} fileName={file.file_name || "Final workshop bill"} stage="billing" onDeleted={id=>setDeletedIds(previous=>[...previous,id])} /> : null}{mode === "operations" && !readonly ? <RequestCustomerDocumentReuploadButton claimId={claimId} documentId={file.id} fileName={file.file_name || "Final workshop bill"} /> : null}{mode === "operations" && file.verification_status !== "verified" ? <div className="w-16 shrink-0"><VerifyDocumentButton claimId={claimId} documentId={file.id} /></div> : null}{file.verification_status === "verified" ? <span className="text-[10px] font-semibold text-emerald-700">Verified</span> : null}</div>)}</div> : null}
  </div>;
}
