import { CheckCircle2, FileText } from "lucide-react";

type UploadRecord = { id: string; document_type: string; file_name?: string | null; created_at: string };

/** Read-only upload inventory for stages without an upload-specific form. */
export function CustomerClaimUploadSummary({ documents }: { documents: UploadRecord[] }) {
  return <section aria-label="Claim documents" className="rounded-2xl border border-[#DCE5F3] bg-white p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-[17px] font-semibold text-[#071D49]">Claim Documents</h2>
      <span className="rounded-lg bg-[#F2F5FB] px-3 py-2 text-[10px] uppercase text-[#75819A]">{documents.length} uploaded</span>
    </div>
    {documents.length ? <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {documents.map(doc => <div key={doc.id} className="flex min-w-0 items-center gap-2 rounded-xl border border-[#DCE5F4] bg-white p-3">
        <FileText className="h-5 w-5 shrink-0 text-[#2460B8]"/>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[11px] font-semibold text-[#071D49]">{doc.document_type}</span>
          <span className="block truncate text-[10px] text-[#61738D]" title={doc.file_name || doc.document_type}>{doc.file_name || new Date(doc.created_at).toLocaleDateString("en-IN")}</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-[#13855B]"><CheckCircle2 className="h-4 w-4"/>Uploaded</span>
      </div>)}
    </div> : <p className="text-[11px] text-[#8794A7]">No documents uploaded yet.</p>}
  </section>;
}
