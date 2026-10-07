import { FileText } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
} from "@/components/customer-portal/customer-phase1";
import { CustomerDocumentVault } from "@/components/customer-portal/customer-document-vault";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerProfile } from "@/lib/customer-web-phase4-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerDocumentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const { documents } = await loadCustomerProfile(account.id);

  return (
    <div className="space-y-5">
      <CustomerPageHeading
        eyebrow="Secure document vault"
        title="Documents"
        description="Customer-level documents stored in the same protected document vault used by the Customer App."
        action={<span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF4FF] px-3 py-1.5 text-[10px] font-black text-[#174EA6]"><FileText className="h-3.5 w-3.5" />{documents.length} files</span>}
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/documents" />
      <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,0.04)]">
        <CustomerDocumentVault customerId={account.id} documents={documents} />
      </section>
    </div>
  );
}
