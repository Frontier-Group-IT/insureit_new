"use client";

import { useState } from "react";
import { ChevronDown, FileText } from "lucide-react";
import { CustomerDocumentVault } from "./customer-document-vault";

type Document = {
  id: string; document_type: string; file_name: string; mime_type: string | null;
  file_size: number | null; created_at: string;
};

export function CustomerProfileDocuments({ customerId, documents }: { customerId: string; documents: Document[] }) {
  const [expanded, setExpanded] = useState(false);
  return <section className="overflow-hidden rounded-2xl border border-[#DCE4EE] bg-white shadow-[0_8px_24px_rgba(28,50,82,0.04)]">
    <button type="button" aria-expanded={expanded} aria-controls="customer-profile-vault-content" onClick={() => setExpanded(value => !value)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-[#FAFCFF]">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#17345B] text-white"><FileText className="h-5 w-5"/></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[9px] font-semibold uppercase tracking-wider text-[#7286A8]">Secure document vault</span>
        <span className="block text-[17px] font-bold text-[#10213D]">Documents</span>
        <span className="block text-[10px] text-[#718096]">Customer-level documents stored in the protected document vault.</span>
      </span>
      <span className="shrink-0 rounded-full bg-[#EEF4FF] px-3 py-1.5 text-[10px] font-semibold text-[#174EA6]">{documents.length} files</span>
      <ChevronDown className={`h-4 w-4 shrink-0 text-[#536781] transition-transform ${expanded ? "rotate-180" : ""}`}/>
    </button>
    {expanded ? <div id="customer-profile-vault-content" className="border-t border-[#E2E9F3] p-4"><CustomerDocumentVault customerId={customerId} documents={documents}/></div> : null}
  </section>;
}
