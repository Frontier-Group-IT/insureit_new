import { BadgeCheck, FileText, Mail, Phone, ShieldCheck, UserRound } from "lucide-react";
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
    <div className="space-y-4 pb-4">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/profile" />

      <section className="customer-profile-hero relative isolate overflow-hidden rounded-[22px] border border-[#E4DDFB] bg-white shadow-[0_10px_30px_rgba(83,58,151,0.08)]">
        <div aria-hidden="true" className="pointer-events-none absolute -right-16 -top-40 h-[330px] w-[520px] rounded-full border-[60px] border-white/30" />
        <div aria-hidden="true" className="pointer-events-none absolute bottom-[-125px] right-[18%] h-[270px] w-[340px] rotate-[-25deg] rounded-[80px] bg-[#A99EF8]/15" />
        <div className="relative flex min-h-[174px] items-center justify-between gap-5 px-5 py-5 sm:px-7 lg:px-9">
          <div className="flex min-w-0 items-center gap-4 sm:gap-5">
            <div className="shrink-0 rounded-full bg-white/85 p-1.5 shadow-[0_8px_24px_rgba(72,45,145,0.14)] ring-1 ring-[#DBD0FF]">
              <CustomerAvatar userId={user.id} size="profile" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="break-words text-[22px] font-black tracking-[-0.02em] text-[#2D205E] sm:text-[26px]">{customer.contact_name}</h1>
                <BadgeCheck className="h-5 w-5 shrink-0 text-[#6E42D5]" aria-label="Verified customer" />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-semibold text-[#55437E]">
                <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-[#6743C6]" />{customer.phone || "—"}</span>
                <span className="inline-flex min-w-0 items-center gap-1.5"><Mail className="h-3.5 w-3.5 shrink-0 text-[#6743C6]" /><span className="break-all">{customer.email || "—"}</span></span>
              </div>
              {customer.company_name ? <p className="mt-2 text-[10px] font-semibold text-[#7665A2]">{customer.company_name}</p> : null}
            </div>
          </div>
          <div aria-hidden="true" className="relative hidden h-[134px] w-[215px] shrink-0 items-center justify-center lg:flex">
            <div className="absolute bottom-1 right-0 h-[110px] w-[150px] rotate-[8deg] rounded-2xl border border-[#B5A6F6] bg-white/80 shadow-[0_12px_30px_rgba(81,51,157,0.18)]">
              <div className="flex items-center gap-3 border-b border-[#DDD5FA] px-4 py-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#E7DDFF] text-[#714AD0]"><UserRound className="h-5 w-5" /></span>
                <div className="space-y-1.5"><div className="h-2 w-14 rounded-full bg-[#A28DE9]" /><div className="h-1.5 w-10 rounded-full bg-[#DFD6F8]" /></div>
              </div>
              <div className="space-y-2 px-4 py-3"><div className="h-2 w-20 rounded-full bg-[#D5C8F4]" /><div className="h-2 w-24 rounded-full bg-[#E3DBFA]" /></div>
            </div>
            <div className="absolute bottom-1 right-0 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[#8F63F1] to-[#4D27AF] text-white shadow-[0_9px_20px_rgba(91,50,175,0.28)]"><ShieldCheck className="h-8 w-8" /></div>
            <FileText className="absolute left-3 top-3 h-10 w-10 -rotate-12 text-[#B3A1EF]" strokeWidth={1.25} />
          </div>
        </div>
      </section>

      <section className="customer-profile-detail-section relative rounded-[22px] border border-[#E6E0F5] bg-white p-4 shadow-[0_9px_24px_rgba(79,56,139,0.055)] sm:p-5">
        <div className="flex items-start gap-3 pr-20 sm:pr-24">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[13px] bg-gradient-to-br from-[#8C5EF1] to-[#5734BD] text-white shadow-[0_5px_12px_rgba(97,61,191,0.18)]"><FileText className="h-5 w-5" /></span>
          <div className="min-w-0">
            <h2 className="text-[16px] font-black text-[#2E2358]">Your Details</h2>
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
