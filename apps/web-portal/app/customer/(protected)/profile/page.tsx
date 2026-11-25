import { BadgeCheck } from "lucide-react";
import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";
import { CustomerProfileDocuments } from "@/components/customer-portal/customer-profile-documents";
import { CustomerProfileEditor } from "@/components/customer-portal/customer-profile-editor";
import { CustomerAvatar } from "@/components/customer-portal/customer-avatar";
import { getCustomerWebSession } from "@/lib/customer-web";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import { loadCustomerProfile } from "@/lib/customer-web-phase4-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { user } = await getCustomerWebSession();
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const { customer, documents } = await loadCustomerProfile(account.id);

  return (
    <div className="customer-profile-page flex min-h-0 min-w-0 flex-1 flex-col gap-4">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/profile" />

      <section className="customer-profile-detail-section relative flex shrink-0 min-w-0 flex-col items-center gap-3 rounded-[22px] border border-[#E6E0F5] bg-white p-3 shadow-[0_9px_24px_rgba(79,56,139,0.055)] sm:flex-row sm:items-center sm:gap-4 sm:p-4" aria-label="Customer profile">
        <div className="shrink-0 rounded-full bg-white/85 p-1.5 shadow-[0_8px_24px_rgba(72,45,145,0.14)] ring-1 ring-[#DBD0FF]">
          <CustomerAvatar userId={user.id} size="profile" />
        </div>
        <div className="w-full min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2 pr-12">
            <h1 className="min-w-0 break-words text-[19px] font-black tracking-[-0.02em] text-[#2D205E] sm:text-[22px]">{customer.contact_name}</h1>
            <BadgeCheck className="h-5 w-5 shrink-0 text-[#6E42D5]" aria-label="Verified customer" />
          </div>
          {customer.company_name ? <p className="mt-1 text-[10px] font-semibold text-[#7665A2]">{customer.company_name}</p> : null}
        <CustomerProfileEditor
          customerId={customer.id}
          name={customer.contact_name}
          phone={customer.phone}
          email={customer.email ?? ""}
          address={customer.address ?? ""}
          city={customer.city ?? ""}
          state={customer.state ?? ""}
          postalCode={customer.postal_code ?? ""}
          documentsCount={documents.length}
        />
        </div>
      </section>

      <CustomerProfileDocuments customerId={account.id} documents={documents} />
    </div>
  );
}
