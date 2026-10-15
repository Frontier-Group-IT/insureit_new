import { BadgeCheck, ShieldCheck } from "lucide-react";
import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";
import { CustomerProfileDocuments } from "@/components/customer-portal/customer-profile-documents";
import { CustomerProfileEditor } from "@/components/customer-portal/customer-profile-editor";
import { CustomerAvatar } from "@/components/customer-portal/customer-avatar";
import { getCustomerWebSession } from "@/lib/customer-web";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  customerKycStatusLabel,
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
  const { user } = await getCustomerWebSession();
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const data = await loadCustomerProfile(account.id);
  const { customer, kyc, documents } = data;

  return (
    <div className="space-y-5">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/profile" />

      <section className="relative isolate overflow-hidden rounded-2xl bg-[#061B3B] text-white">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[65%] bg-[radial-gradient(ellipse_at_80%_40%,#3299FF_0%,#1155A0_42%,transparent_75%)] opacity-90"/>
        <div className="pointer-events-none absolute -bottom-32 right-[12%] h-72 w-72 rounded-full border-[45px] border-[#80C7FF]/10"/>
        <div className="relative flex min-h-[180px] items-center justify-between gap-4 px-6 py-6 sm:px-8">
          <div className="max-w-[520px]">
            <h1 className="text-[clamp(27px,3.5vw,40px)] font-black leading-tight">Your <span className="text-[#369BFF]">Profile</span></h1>
          </div>
          <div className="hidden shrink-0 items-center gap-3 rounded-2xl border border-white/30 bg-white/95 px-4 py-3 text-[#10213D] shadow-lg sm:flex">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#DCF7E9] text-[#07865B]"><ShieldCheck className="h-5 w-5"/></span>
            <div><p className="text-[12px] font-black">KYC: {customerKycStatusLabel(kyc?.status)}</p></div>
          </div>
        </div>
      </section>
      <section className="relative rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,.04)] sm:p-5">
        <div className="flex min-w-0 items-center gap-4 pr-20 sm:pr-24">
          <CustomerAvatar userId={user.id} size="profile" />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <h2 className="break-words text-[19px] font-black text-[#10213D]">{customer.contact_name}</h2>
              <BadgeCheck className="h-4.5 w-4.5 shrink-0 text-[#0B8A61]" aria-label="Verified customer" />
            </div>
            <p className="mt-0.5 text-[11px] font-bold text-[#7286A8]">{customer.customer_code}</p>
            {customer.company_name ? <p className="mt-0.5 text-[10px] font-bold text-[#8794A7]">{customer.company_name}</p> : null}
          </div>
        </div>
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
      </section>

      <CustomerProfileDocuments customerId={account.id} documents={documents} />
    </div>
  );
}