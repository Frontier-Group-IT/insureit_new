import Link from "next/link";
import { Headphones, Search, ShieldCheck, TicketCheck } from "lucide-react";
import {
  CustomerAccountTabs,
  CustomerPageHeading,
  EmptyCustomerState,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import { CustomerServiceRequestForm } from "@/components/customer-portal/customer-service-request-form";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  formatCustomerCompactDate,
  loadCustomerServiceActivity,
  loadCustomerSupportClaims,
  serviceActivityLabel,
  serviceActivityTone,
} from "@/lib/customer-web-phase3-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerSupportPage({
  searchParams,
}: {
  searchParams?: Promise<{ account?: string; q?: string }>;
}) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const [activity, claims] = await Promise.all([
    loadCustomerServiceActivity(account.id),
    loadCustomerSupportClaims(account.id),
  ]);
  const query = params.q?.trim().toLowerCase() ?? "";
  const rows = activity.filter((item) => !query || [item.enquiry_no,item.subject,item.service_type,item.status,item.vehicle_no].some((value) => value?.toLowerCase().includes(query)));

  return (
    <div className="space-y-5">
      <CustomerPageHeading
        eyebrow="InsureIT care desk"
        title="Support"
        description="Track quote, challan and support-ticket requests from the same Customer service-enquiry workflow."
      />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/support" />

      <div className="grid gap-3 md:grid-cols-3">
        <Link href={{ pathname: "/customer/insurance-quote", query: { account: account.id } }} className="rounded-2xl border border-[#CFE0FF] bg-white p-4 hover:border-[#9EBCE4]">
          <ShieldCheck className="h-5 w-5 text-[#174EA6]" /><p className="mt-2 text-[12px] font-black text-[#10213D]">Insurance Quote</p><p className="mt-1 text-[10px] font-semibold text-[#74839A]">Renewal, new policy or insurer change.</p>
        </Link>
        <Link href={{ pathname: "/customer/e-challan", query: { account: account.id } }} className="rounded-2xl border border-[#CFE0FF] bg-white p-4 hover:border-[#9EBCE4]">
          <TicketCheck className="h-5 w-5 text-[#174EA6]" /><p className="mt-2 text-[12px] font-black text-[#10213D]">Challan Assistance</p><p className="mt-1 text-[10px] font-semibold text-[#74839A]">Send vehicle and challan details.</p>
        </Link>
        <a href="tel:+916264911014" className="rounded-2xl border border-[#CFE0FF] bg-white p-4 hover:border-[#9EBCE4]">
          <Headphones className="h-5 w-5 text-[#174EA6]" /><p className="mt-2 text-[12px] font-black text-[#10213D]">Urgent help</p><p className="mt-1 text-[10px] font-semibold text-[#74839A]">Call the support desk.</p>
        </a>
      </div>

      <section className="rounded-2xl border border-[#DCE4EE] bg-white p-4">
        <div className="mb-4">
          <p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#718096]">Raise support ticket</p>
          <h2 className="mt-1 text-[16px] font-black text-[#10213D]">Tell us what you need</h2>
        </div>
        <CustomerServiceRequestForm
          mode="support_ticket"
          customerId={account.id}
          claims={claims.map((claim) => ({ id: claim.id, claim_no: claim.claim_no, status: claim.current_status }))}
        />
      </section>

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div><p className="text-[10px] font-black uppercase tracking-[0.13em] text-[#718096]">Your activity</p><h2 className="mt-1 text-[16px] font-black text-[#10213D]">Requests & tickets</h2></div>
          <form className="flex max-w-sm items-center gap-2 rounded-xl border border-[#D8E1EC] bg-white px-3 py-2">
            <Search className="h-4 w-4 text-[#73829A]" />
            <input type="hidden" name="account" value={account.id} />
            <input name="q" defaultValue={params.q ?? ""} placeholder="Search requests" className="min-w-0 flex-1 bg-transparent text-[11px] font-semibold text-[#10213D] outline-none" />
          </form>
        </div>

        <div className="mt-3 space-y-2">
          {rows.map((item) => (
            <Link key={item.id} href={{ pathname: `/customer/support/${item.id}`, query: { account: account.id } }} className="flex items-center gap-3 rounded-2xl border border-[#DCE4EE] bg-white p-3 hover:border-[#B9C9DB]">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#174EA6]"><Headphones className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="truncate text-[11.5px] font-black text-[#10213D]">{item.enquiry_no}</p><StatusPill tone={serviceActivityTone(item.status)}>{item.status.replace("_"," ")}</StatusPill></div>
                <p className="mt-0.5 truncate text-[10px] font-bold text-[#64748B]">{serviceActivityLabel(item.service_type)} · {item.subject}</p>
                <p className="mt-0.5 text-[9.5px] font-semibold text-[#8995A8]">{formatCustomerCompactDate(item.updated_at || item.created_at)}</p>
              </div>
            </Link>
          ))}
          {rows.length === 0 ? <EmptyCustomerState title={activity.length ? "No matching support activity" : "No support activity yet"} body={activity.length ? "Try a different search term." : "Your quote, challan and support-ticket requests will appear here."} /> : null}
        </div>
      </section>
    </div>
  );
}
