"use client";

import { useState } from "react";
import { ChevronRight, FileBadge, FileText, FolderOpen, MapPin, ShieldCheck } from "lucide-react";
import { CustomerDocumentVault } from "./customer-document-vault";

type Document = {
  id: string; document_type: string; file_name: string; mime_type: string | null;
  file_size: number | null; created_at: string;
};

const categories = [
  { label: "Policy Documents", Icon: ShieldCheck },
  { label: "ID Proofs", Icon: FileBadge },
  { label: "Address Proofs", Icon: MapPin },
  { label: "Other Documents", Icon: FileText },
];

export function CustomerProfileDocuments({ customerId, documents }: { customerId: string; documents: Document[] }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <section id="customer-profile-vault" className="customer-profile-vault scroll-mt-24 overflow-hidden rounded-[22px] border border-[#E6E0F5] bg-white shadow-[0_9px_24px_rgba(79,56,139,0.06)]">
      <div className="relative isolate overflow-hidden px-4 py-4 sm:px-5 sm:py-5">
        <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full border-[35px] border-white/45" />
        <div className="relative flex items-center gap-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#8B56EF] to-[#4D27B0] text-white shadow-[0_8px_20px_rgba(82,45,173,0.2)]"><FileText className="h-6 w-6" /></span>
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-black text-[#2E2358]">Document Vault</h2>
            <p className="mt-0.5 text-[10.5px] font-medium text-[#81739B]">Access and manage your important documents.</p>
          </div>
          <button type="button" aria-expanded={expanded} aria-controls="customer-profile-vault-content" onClick={() => setExpanded(value => !value)}
            className="flex shrink-0 items-center gap-2 rounded-full border border-[#E8DFFF] bg-white/90 px-3 py-2 text-[10px] font-bold text-[#6241B5] shadow-sm hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8D6BD6]">
            <FileText className="h-3.5 w-3.5" /> {documents.length} files
            <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        </div>
        <div className="relative mt-4 flex flex-wrap gap-2" aria-label="Document categories">
          {categories.map(({ label, Icon }) => (
            <span key={label} className="customer-profile-category inline-flex items-center gap-2 rounded-lg bg-white/95 px-3 py-2 text-[10px] font-bold text-[#6144AA] shadow-[0_2px_8px_rgba(91,59,162,0.05)]">
              <Icon className="h-4 w-4" /> {label}
            </span>
          ))}
        </div>
        <div aria-hidden="true" className="pointer-events-none absolute bottom-[-25px] right-[9%] hidden h-24 w-28 rotate-[-7deg] place-items-center rounded-2xl border border-[#CDBDF6] bg-white/70 shadow-[0_8px_20px_rgba(102,67,178,0.08)] lg:grid">
          <FileText className="h-12 w-12 text-[#A38BE9]" strokeWidth={1.4} />
          <span className="absolute -bottom-1 -right-3 grid h-10 w-10 place-items-center rounded-xl bg-[#6C42C8] text-white"><ShieldCheck className="h-6 w-6" /></span>
        </div>
      </div>
      {expanded && (
        <div id="customer-profile-vault-content" className="customer-profile-vault-content relative border-t border-[#E6DDF9] bg-white p-4">
          {documents.length === 0 && (
            <div className="mb-3 rounded-2xl border border-dashed border-[#DACDF5] bg-[#FAF8FF] px-4 py-5 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-[#EEE7FF] text-[#714AC6]"><FolderOpen className="h-7 w-7"/></span>
              <h3 className="mt-2 text-[12px] font-black text-[#35275F]">No documents uploaded yet</h3>
              <p className="mt-1 text-[10px] text-[#81739B]">Upload documents to your customer vault.</p>
            </div>
          )}
          <CustomerDocumentVault customerId={customerId} documents={documents}/>
        </div>
      )}
    </section>
  );
}
