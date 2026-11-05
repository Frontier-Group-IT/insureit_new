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
        <div className="relative flex items-center gap-3">
          <img src="/assets/Custom-Icons/optimized-128/documents.png" alt="" aria-hidden="true" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" />
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] font-black text-[#2E2358]">Document Vault</h2>
            <p className="mt-0.5 text-[10.5px] font-medium text-[#81739B]">Access and manage your important documents.</p>
          </div>
          <button type="button" aria-expanded={expanded} aria-controls="customer-profile-vault-content" onClick={() => setExpanded(value => !value)}
            className="flex shrink-0 items-center gap-2 rounded-lg bg-transparent px-3 py-2 text-[10px] font-bold text-[#6241B5] transition-colors hover:bg-[#F4EEFF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8D6BD6]">
            <FileText className="h-3.5 w-3.5" /> {documents.length} files
            <ChevronRight className={`h-4 w-4 transition-transform ${expanded ? "rotate-90" : ""}`} />
          </button>
        </div>
        <div className="relative mt-4 grid w-full grid-cols-2 gap-2 lg:grid-cols-4" aria-label="Document categories">
          {categories.map(({ label, Icon }) => (
            <span key={label} className="customer-profile-category flex min-w-0 w-full items-center justify-center gap-2 rounded-lg border border-[#EAE3F7] bg-white px-3 py-3 text-center text-[10px] font-bold text-[#6144AA]">
              <Icon className="h-4 w-4" /> {label}
            </span>
          ))}
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
