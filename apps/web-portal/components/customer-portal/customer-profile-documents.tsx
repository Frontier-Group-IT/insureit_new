import { CustomerDocumentVault } from "./customer-document-vault";

type Document = {
  id: string; document_type: string; file_name: string; mime_type: string | null;
  file_size: number | null; created_at: string;
};

export function CustomerProfileDocuments({ customerId, documents }: { customerId: string; documents: Document[] }) {
  return (
    <section id="customer-profile-vault" aria-labelledby="customer-profile-vault-title" className="customer-profile-vault flex min-w-0 flex-1 flex-col scroll-mt-24 overflow-hidden rounded-[22px] border border-[#E6E0F5] bg-white shadow-[0_9px_24px_rgba(79,56,139,0.06)]">
      <CustomerDocumentVault key={customerId} customerId={customerId} documents={documents} profileMode />
    </section>
  );
}
