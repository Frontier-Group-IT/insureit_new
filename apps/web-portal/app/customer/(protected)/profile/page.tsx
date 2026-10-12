import { FileText, Mail, MapPin, Phone, ShieldCheck, UserRound } from "lucide-react";
import {
  CustomerAccountTabs,
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
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/profile" />

      <section className="relative isolate overflow-hidden rounded-2xl bg-[#061B3B] text-white">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[65%] bg-[radial-gradient(ellipse_at_80%_40%,#3299FF_0%,#1155A0_42%,transparent_75%)] opacity-90"/>
        <div className="pointer-events-none absolute -bottom-32 right-[12%] h-72 w-72 rounded-full border-[45px] border-[#80C7FF]/10"/>
        <div className="relative flex min-h-[180px] items-center justify-between gap-4 px-6 py-6 sm:px-8">
          <div className="max-w-[520px]">
            <p className="text-[10px] font-extrabold uppercase tracking-[.16em] text-[#A8C9F4]">Customer account</p>
            <h1 className="mt-2 text-[clamp(27px,3.5vw,40px)] font-black leading-tight">Your <span className="text-[#369BFF]">Profile</span></h1>
            <p className="mt-2 text-[12px] leading-6 text-[#E0EDFF]">Manage your contact information, KYC status and documents in one place.</p>
          </div>
          <div className="hidden shrink-0 items-center gap-3 rounded-2xl border border-white/30 bg-white/95 px-4 py-3 text-[#10213D] shadow-lg sm:flex">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[#DCF7E9] text-[#07865B]"><ShieldCheck className="h-5 w-5"/></span>
            <div><p className="text-[12px] font-black">KYC: {customerKycStatusLabel(kyc?.status)}</p><p className="text-[10px] text-[#657791]">Current account verification status</p></div>
          </div>
        </div>
      </section>
      <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4 shadow-[0_8px_24px_rgba(28,50,82,.04)] sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid h-20 w-20 shrink-0 place-items-center rounded-full bg-[#E1EEFF] text-[24px] font-black text-[#1262BC]">{customer.contact_name?.trim().split(/\\s+/).filter(Boolean).slice(0,2).map(part=>part[0]).join("").toUpperCase() || <UserRound className="h-8 w-8"/>}</span>
            <div className="min-w-0">
              <h2 className="break-words text-[19px] font-black text-[#10213D]">{customer.contact_name}</h2>
              <p className="mt-1 text-[11px] font-semibold text-[#7286A8]">Customer ID: {customer.customer_code}</p>
              <div className="mt-2"><StatusPill tone={customerKycTone(kyc?.status)}>{customerKycStatusLabel(kyc?.status)}</StatusPill></div>
              {customer.company_name ? <p className="mt-1 text-[10px] text-[#8794A7]">{customer.company_name}</p> : null}
            </div>
          </div>
          <CustomerProfileEditor customerId={customer.id} name={customer.contact_name} phone={customer.phone} email={customer.email ?? ""} address={customer.address ?? ""}/>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="flex min-w-0 gap-3 rounded-xl bg-[#F6F9FD] p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E4F0FF] text-[#176BD4]"><Phone className="h-4 w-4"/></span><div className="min-w-0"><p className="text-[10px] text-[#71839A]">Mobile Number</p><p className="mt-1 break-all text-[11px] font-black text-[#10213D]">{customer.phone || "—"}</p></div></div>
          <div className="flex min-w-0 gap-3 rounded-xl bg-[#F6F9FD] p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E4F0FF] text-[#176BD4]"><Mail className="h-4 w-4"/></span><div className="min-w-0"><p className="text-[10px] text-[#71839A]">Email Address</p><p className="mt-1 break-all text-[11px] font-black text-[#10213D]">{customer.email || "—"}</p></div></div>
          <div className="flex min-w-0 gap-3 rounded-xl bg-[#F6F9FD] p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E4F0FF] text-[#176BD4]"><MapPin className="h-4 w-4"/></span><div className="min-w-0"><p className="text-[10px] text-[#71839A]">Location</p><p className="mt-1 text-[11px] font-black text-[#10213D]">{[customer.city,customer.state].filter(Boolean).join(", ") || "—"}</p>{customer.address ? <p className="mt-1 text-[10px] leading-4 text-[#71839A]">{customer.address}{customer.postal_code ? ` · ${customer.postal_code}` : ""}</p> : null}</div></div>
          <div className="flex min-w-0 gap-3 rounded-xl bg-[#F6F9FD] p-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#E4F0FF] text-[#176BD4]"><FileText className="h-4 w-4"/></span><div className="min-w-0"><p className="text-[10px] text-[#71839A]">Total Documents</p><p className="mt-1 text-[11px] font-black text-[#10213D]">{documents.length}</p></div></div>
        </div>
      </section>

      <CustomerProfileDocuments customerId={account.id} documents={documents} />
    </div>
  );
}