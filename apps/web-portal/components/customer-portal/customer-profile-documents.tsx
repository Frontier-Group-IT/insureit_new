import { CustomerDocumentVault } from "./customer-document-vault";

type Document = {
  id: string; document_type: string; file_name: string; mime_type: string | null;
  file_size: number | null; created_at: string;
};

export function CustomerProfileDocuments({ customerId, documents }: { customerId: string; documents: Document[] }) {
  return (
    <section id="customer-profile-vault" className="customer-profile-vault scroll-mt-24 overflow-hidden rounded-[22px] border border-[#E6E0F5] bg-white shadow-[0_9px_24px_rgba(79,56,139,0.06)]">
      <div className="flex items-center gap-3 px-4 py-4 sm:px-5">
        <img src="/assets/Custom-Icons/optimized-128/documents.png" alt="" aria-hidden="true" width={48} height={48} className="h-12 w-12 shrink-0 object-contain" />
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-black text-[#2E2358]">Document Vault</h2>
          <p className="mt-0.5 text-[10.5px] font-medium text-[#81739B]">Access and manage your important documents.</p>
        </div>
      </div>
      <div className="px-4 pb-4 sm:px-5">
        <CustomerDocumentVault key={customerId} customerId={customerId} documents={documents} profileMode />
      </div>
    </section>
  );
}
