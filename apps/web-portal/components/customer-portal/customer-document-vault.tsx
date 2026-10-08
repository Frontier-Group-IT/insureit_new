"use client";

import { FileText, Loader2, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Doc = {
  id: string; document_type: string; file_name: string; mime_type: string | null; file_size: number | null; created_at: string;
};

export function CustomerDocumentVault({ customerId, documents }: { customerId: string; documents: Doc[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [type, setType] = useState("Other");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function upload(file?: File) {
    if (!file || busy) return;
    setBusy(true); setMessage("");
    try {
      const form = new FormData();
      form.set("customerId", customerId);
      form.set("documentType", type);
      form.set("file", file);
      const response = await fetch("/customer/documents", { method: "POST", body: form });
      const body = await response.json() as { error?: string };
      if (!response.ok) return setMessage(body.error || "Document upload failed.");
      setMessage("Document uploaded.");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch { setMessage("Document upload failed."); }
    finally { setBusy(false); }
  }

  async function remove(documentId: string) {
    if (busy || !window.confirm("Delete this document from your Customer vault?")) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/customer/documents", {
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

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[180px_1fr]">
        <select value={type} onChange={(e) => setType(e.target.value)} className="h-10 rounded-xl border border-[#D8E1EC] bg-white px-3 text-[11px] font-bold text-[#35445B]">
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
          <div key={doc.id} className="flex items-center gap-3 rounded-xl border border-[#E0E7F0] bg-white p-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#EEF4FF] text-[#174EA6]"><FileText className="h-4 w-4" /></span>
            <div className="min-w-0 flex-1"><p className="truncate text-[10.5px] font-black text-[#10213D]">{doc.file_name}</p><p className="mt-0.5 text-[9px] font-semibold text-[#8390A2]">{doc.document_type} · {doc.file_size ? `${Math.max(1, Math.round(doc.file_size / 1024))} KB` : "Size unavailable"}</p></div>
            <a href={`/customer/documents/open?customer=${encodeURIComponent(customerId)}&document=${encodeURIComponent(doc.id)}`} target="_blank" rel="noreferrer" className="rounded-lg border border-[#D6E0EB] px-2.5 py-1.5 text-[9px] font-black text-[#174EA6]">Open</a>
            <button type="button" disabled={busy} onClick={() => void remove(doc.id)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#F0D7D7] text-[#B44949] disabled:opacity-50"><Trash2 className="h-3.5 w-3.5" /></button>
          </div>
        ))}
        {!documents.length ? <p className="rounded-xl bg-[#F7F9FC] p-4 text-center text-[10.5px] font-semibold text-[#74839A]">No Customer vault documents uploaded yet.</p> : null}
      </div>
    </div>
  );
}