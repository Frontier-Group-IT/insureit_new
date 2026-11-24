"use client";

import { FileText, Loader2, Trash2, UploadCloud, ShieldCheck, FileBadge, MapPin, ChevronDown, X } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Doc = {
  id: string; document_type: string; file_name: string; mime_type: string | null; file_size: number | null; created_at: string;
};

const groups = [
  { label: "Policy Documents", Icon: ShieldCheck, types: ["Insurance", "Policy", "Policy Copy", "Insurance Copy", "Policy Document"] },
  { label: "ID Proofs", Icon: FileBadge, types: ["PAN Card", "Aadhaar Card", "Aadhaar Front", "Aadhaar Back", "PAN Copy", "Driving Licence", "Driving License", "Voter ID", "Passport", "ID Proof", "KYC Document"] },
  { label: "Address Proofs", Icon: MapPin, types: ["Address Proof", "Utility Bill", "Electricity Bill", "Rent Agreement", "Address Proof Copy"] },
  { label: "Other Documents", Icon: FileText, types: ["Other", "RC", "Permit", "PUC", "Fitness", "Tax Receipt", "GST Copy"] },
] as const;
const normalizeType = (value: string) => value.trim().toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
function documentGroup(value: string) {
  const normalized = normalizeType(value);
  const index = groups.slice(0, 3).findIndex(group => group.types.some(type => normalizeType(type) === normalized));
  return index < 0 ? 3 : index;
}

export function CustomerDocumentVault({ customerId, documents, profileMode = false }: { customerId: string; documents: Doc[]; profileMode?: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [type, setType] = useState("Other");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [picked, setPicked] = useState<File | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [expanded, setExpanded] = useState<number[]>([]);

  async function upload(file?: File) {
    if (!file || busy) return;
    setBusy(true); setMessage(""); setUploadError("");
    try {
      const form = new FormData();
      form.set("customerId", customerId);
      form.set("documentType", type);
      form.set("file", file);
      const response = await fetch("/api/customer/documents", { method: "POST", body: form });
      const body = await response.json() as { error?: string };
      if (!response.ok) { const error = body.error || "Document upload failed."; setUploadError(error); return setMessage(error); }
      if (inputRef.current) inputRef.current.value = "";
      if (profileMode) { setPicked(null); setExpanded(old => Array.from(new Set([...old, documentGroup(type)]))); dialogRef.current?.close(); setMessage("Document uploaded."); }
      router.refresh();
    } catch { setUploadError("Document upload failed."); setMessage("Document upload failed."); }
    finally { setBusy(false); }
  }

  async function remove(documentId: string) {
    if (busy || !window.confirm("Delete this document from your Customer vault?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/customer/documents", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, documentId }),
      });
      const body = await response.json() as { error?: string };
      if (!response.ok) return setMessage(body.error || "Document could not be deleted.");
      setMessage("Document deleted.");
      router.refresh();
    } catch { setMessage("Document could not be deleted."); }
    finally { setBusy(false); }
  }

  function renderDocument(doc: Doc) {
    return (
          <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-[#E0E7F0] bg-white p-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#EEF4FF] text-[#174EA6]"><FileText className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><a href={`/api/customer/documents/open?customer=${encodeURIComponent(customerId)}&document=${encodeURIComponent(doc.id)}`} target="_blank" rel="noopener noreferrer" title={doc.file_name} className="block truncate text-[10.5px] font-black text-[#174EA6] hover:underline">{doc.file_name}</a><p className="mt-0.5 text-[9px] font-semibold text-[#8390A2]">{doc.document_type} · {doc.file_size ? `${Math.max(1, Math.round(doc.file_size / 1024))} KB` : "Size unavailable"}</p></div>
            <button type="button" disabled={busy} onClick={() => void remove(doc.id)} aria-label={`Delete ${doc.file_name}`} className="grid h-8 w-8 place-items-center rounded-lg border border-[#F0D7D7] text-[#B44949] disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
    );
  }

  if (profileMode) return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-[#6241B5]">{documents.length} files</span>
        <button type="button" disabled={busy} onClick={() => { setType("Other"); setPicked(null); setUploadError(""); if (inputRef.current) inputRef.current.value = ""; dialogRef.current?.showModal(); }} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[#6742BB] px-4 py-2 text-[12px] font-bold text-white shadow-sm hover:bg-[#53329E] focus-visible:ring-2 focus-visible:ring-[#8D6BD6] disabled:opacity-60"><UploadCloud className="h-4 w-4" /> Upload Document</button>
      </div>
      {message ? <p role="status" className="rounded-lg bg-[#F3F7FD] px-3 py-2 text-[11px] font-bold text-[#45617E]">{message}</p> : null}
      {groups.map(({ label, Icon }, index) => {
        const items = documents.filter(doc => documentGroup(doc.document_type) === index);
        const open = expanded.includes(index);
        return <div key={label} className="overflow-hidden rounded-xl border border-[#E6DDF9]">
          <button type="button" aria-expanded={open} aria-controls={`customer-vault-group-${index}`} onClick={() => setExpanded(old => open ? old.filter(item => item !== index) : [...old, index])} className="flex w-full items-center gap-2 bg-[#FAF8FF] px-4 py-3 text-left text-[12px] font-bold text-[#6144AA] hover:bg-[#F4EEFF] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8D6BD6]">
            <Icon className="h-4 w-4 shrink-0" /><span className="flex-1">{label}</span><span>{items.length} files</span><ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
          <div id={`customer-vault-group-${index}`} hidden={!open} className="space-y-2 border-t border-[#E6DDF9] p-3">
            {items.length ? items.map(renderDocument) : <p className="py-2 text-center text-[11px] text-[#81739B]">No documents in this category.</p>}
          </div>
        </div>;
      })}
      <dialog ref={dialogRef} onCancel={event => { if (busy) event.preventDefault(); }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-[#E6DDF9] bg-white p-5 text-[#2E2358] shadow-xl backdrop:bg-black/40" aria-labelledby="customer-upload-title">
        <div className="flex items-center justify-between gap-2"><h3 id="customer-upload-title" className="text-base font-bold">Upload Document</h3><button type="button" disabled={busy} aria-label="Close upload dialog" onClick={() => dialogRef.current?.close()} className="rounded-lg p-2 hover:bg-[#F4EEFF]"><X className="h-5 w-5" /></button></div>
        <label className="mt-4 block text-[12px] font-bold">Document type<select value={type} onChange={event => setType(event.target.value)} disabled={busy} className="mt-1 block h-10 w-full rounded-lg border border-[#D8E1EC] bg-white px-3 text-[12px]">{groups.map(group => <optgroup key={group.label} label={group.label}>{group.types.map(value => <option key={value}>{value}</option>)}</optgroup>)}</select></label>
        <label className="mt-4 block text-[12px] font-bold">Choose file<input ref={inputRef} type="file" disabled={busy} accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" onChange={event => { setPicked(event.target.files?.[0] ?? null); setUploadError(""); }} className="mt-1 block w-full rounded-lg border border-[#D8E1EC] p-2 text-[11px]" /></label>
        <p className="mt-2 text-[11px] text-[#81739B]">PDF, JPG, PNG or WEBP · maximum 5 MB.</p>
        {uploadError ? <p role="alert" className="mt-2 text-[11px] font-bold text-red-700">{uploadError}</p> : null}
        <div className="mt-4 flex justify-end gap-2"><button type="button" disabled={busy} onClick={() => dialogRef.current?.close()} className="rounded-lg border border-[#D8E1EC] px-4 py-2 text-[12px] font-bold">Cancel</button><button type="button" disabled={!picked || busy} onClick={() => { if (!picked) return; if (picked.size <= 0 || picked.size > 5 * 1024 * 1024) return setUploadError("Document must be 5 MB or smaller."); void upload(picked); }} className="inline-flex items-center gap-2 rounded-lg bg-[#6742BB] px-4 py-2 text-[12px] font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />} {busy ? "Uploading..." : "Upload"}</button></div>
      </dialog>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
        <select aria-label="Document type" value={type} onChange={(e) => setType(e.target.value)} disabled={busy} className="relative z-10 h-10 w-full cursor-pointer appearance-auto rounded-xl border border-[#D8E1EC] bg-white px-3 text-[11px] font-bold text-[#35445B] outline-none focus:border-[#267AFF] focus:ring-2 focus:ring-[#267AFF]/20 disabled:cursor-not-allowed disabled:opacity-60">
          <option>Other</option><option>RC</option><option>Insurance</option><option>Permit</option><option>PUC</option><option>Fitness</option><option>Tax Receipt</option>
        </select>
        <label className="flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-[#9FB6D2] bg-[#F7FAFE] text-[10px] font-black text-[#174EA6]">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          {busy ? "Working..." : "Upload document"}
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => void upload(e.target.files?.[0])} />
        </label>
      </div>
      <p className="text-[9.5px] font-semibold text-[#8491A3]">PDF, JPG, PNG or WEBP · maximum 5 MB.</p>
      {message ? <p className="rounded-lg bg-[#F3F7FD] px-3 py-2 text-[10px] font-bold text-[#45617E]">{message}</p> : null}
      <div className="space-y-2">
        {documents.map((doc) => (
          renderDocument(doc)
        ))}
        {!documents.length ? <p className="rounded-xl bg-[#F7F9FC] p-4 text-center text-[10.5px] font-semibold text-[#74839A]">No Customer vault documents uploaded yet.</p> : null}
      </div>
    </div>
  );
}