import { MapPin, UserRound } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import { CustomerProfileDocuments } from "@/components/customer-portal/customer-profile-documents";
import { CustomerProfileEditor } from "@/components/customer-portal/customer-profile-editor";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  customerKycStatusLabel,
  customerKycTone,
  loadCustomerProfile,
} from "@/lib/customer-web-phase4-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerProfilePage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const data = await loadCustomerProfile(account.id);
  const { customer, kyc, documents } = data;

  return (
    <div className="space-y-5">
      <CustomerPageHeading
        eyebrow="Customer account"
        title="Profile"
        description="Contact information, KYC status and your Customer document vault."
        action={<StatusPill tone={customerKycTone(kyc?.status)}>{customerKycStatusLabel(kyc?.status)}</StatusPill>}
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/profile" />

      <section className="rounded-2xl border border-[#DCE4EE] bg-white p-5 shadow-[0_8px_24px_rgba(28,50,82,0.04)]">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#174EA6]"><UserRound className="h-6 w-6" /></span>
            <div>
              <h2 className="text-[16px] font-black text-[#10213D]">{customer.contact_name}</h2>
              <p className="mt-0.5 text-[10px] font-bold text-[#718096]">Customer ID: {customer.customer_code}</p>
              {customer.company_name ? <p className="mt-0.5 text-[10px] font-semibold text-[#8794A7]">{customer.company_name}</p> : null}
            </div>
          </div>
          <CustomerProfileEditor
            customerId={customer.id}
            name={customer.contact_name}
            phone={customer.phone}
            email={customer.email ?? ""}
            address={customer.address ?? ""}
          />
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl bg-[#F7F9FC] p-3"><p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8794A7]">Mobile</p><p className="mt-1 break-all text-[11px] font-black text-[#35445B]">{customer.phone || "—"}</p></div>
          <div className="rounded-xl bg-[#F7F9FC] p-3"><p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8794A7]">Email</p><p className="mt-1 break-all text-[11px] font-black text-[#35445B]">{customer.email || "—"}</p></div>
          <div className="rounded-xl bg-[#F7F9FC] p-3"><p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8794A7]">Location</p><p className="mt-1 text-[11px] font-black text-[#35445B]">{[customer.city, customer.state].filter(Boolean).join(", ") || "—"}</p></div>
          <div className="rounded-xl bg-[#F7F9FC] p-3"><p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#8794A7]">Documents</p><p className="mt-1 text-[11px] font-black text-[#35445B]">{documents.length}</p></div>
        </div>

        {customer.address ? <p className="mt-3 inline-flex items-start gap-1.5 text-[10px] font-semibold leading-5 text-[#6B7A90]"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />{customer.address}{customer.postal_code ? ` · ${customer.postal_code}` : ""}</p> : null}
      </section>

      <CustomerProfileDocuments customerId={account.id} documents={documents} />
    </div>
  );
}