"use client";

import { useState } from "react";
import { ChevronDown, FileText, FolderOpen } from "lucide-react";
import { CustomerDocumentVault } from "./customer-document-vault";

type Document = {
  id: string; document_type: string; file_name: string; mime_type: string | null;
  file_size: number | null; created_at: string;
};

export function CustomerProfileDocuments({ customerId, documents }: { customerId: string; documents: Document[] }) {
  const [expanded, setExpanded] = useState(true);
  return <section className="overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_24px_rgba(28,50,82,0.04)]">
    <button type="button" aria-expanded={expanded} aria-controls="customer-profile-vault-content" onClick={() => setExpanded(value => !value)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-[#FAFCFF]">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#17345B] text-white"><FileText className="h-5 w-5"/></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#7286A8]">Secure document vault</span>
        <span className="block text-[17px] font-bold text-[#10213D]">Document Vault</span>
        <span className="block text-[10px] text-[#718096]">Your documents are stored securely and used for KYC verification and INSUREIT services.</span>
      </span>
      <span className="shrink-0 rounded-full bg-[#EEF4FF] px-3 py-1.5 text-[10px] font-semibold text-[#174EA6]">{documents.length} files</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-[#536781] transition-transform ${expanded ? "rotate-180" : ""}`}/>
    </button>
    {expanded ? <div id="customer-profile-vault-content" className="border-t border-[#E2E9F3] p-4">
      {documents.length === 0 ? <div className="mb-3 rounded-2xl border border-dashed border-[#C8DCF5] bg-[#FAFCFF] px-4 py-5 text-center"><span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#EAF3FF] text-[#267AFF]"><FolderOpen className="h-7 w-7"/></span><h3 className="mt-2 text-[12px] font-black text-[#10213D]">No documents uploaded yet</h3><p className="mt-1 text-[10px] text-[#71839A]">Upload your documents to keep them in your secure customer vault.</p></div> : null}
      <CustomerDocumentVault customerId={customerId} documents={documents}/>
    </div> : null}
  </section>;
}
