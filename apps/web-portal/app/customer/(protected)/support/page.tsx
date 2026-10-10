import Link from "next/link";
import { ArrowRight, CarFront, ChevronRight, CircleHelp, Clock3, FileText, Headphones, Lightbulb, Search, ShieldCheck, TicketCheck } from "lucide-react";
import {
  CustomerAccountTabs,
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
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/support" />

      <section className="relative isolate overflow-hidden rounded-2xl bg-[#061B3B] text-white">
        <div className="pointer-events-none absolute -right-16 -top-36 h-[400px] w-[65%] rounded-full bg-[radial-gradient(circle_at_center,#267AFF_0%,#1262B5_36%,transparent_70%)] opacity-70" />
        <div className="pointer-events-none absolute bottom-[-70px] right-[8%] h-52 w-52 rounded-full border-[28px] border-[#52AEFF]/20" />
        <div className="relative flex min-h-[195px] items-center justify-between gap-5 px-6 py-7 sm:px-9">
          <div className="max-w-[590px]">
            <p className="text-[10px] font-extrabold uppercase tracking-[.15em] text-[#72B9FF]">INSUREIT Care Desk</p>
            <h1 className="mt-3 text-[clamp(25px,3.3vw,40px)] font-black leading-tight">We’re here to <span className="text-[#369BFF]">help you.</span></h1>
            <p className="mt-2 max-w-[530px] text-[12px] leading-6 text-[#E0EDFF]">Get support for your insurance, vehicle, challan or any other INSUREIT service. Raise a ticket and our team will assist you.</p>
          </div>
          <div className="hidden shrink-0 flex-col gap-2 sm:flex">
            <span className="rounded-full bg-white/90 px-4 py-2 text-[10px] font-bold text-[#123A6B]"><ShieldCheck className="mr-2 inline h-4 w-4 text-[#1778E8]"/>Quick support</span>
            <span className="rounded-full bg-white/90 px-4 py-2 text-[10px] font-bold text-[#123A6B]"><Clock3 className="mr-2 inline h-4 w-4 text-[#1778E8]"/>Track your requests</span>
            <span className="rounded-full bg-white/90 px-4 py-2 text-[10px] font-bold text-[#123A6B]"><Headphones className="mr-2 inline h-4 w-4 text-[#1778E8]"/>Dedicated assistance</span>
          </div>
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-3">
        <Link href={{pathname:"/customer/insurance-quote",query:{account:account.id}}} className="flex items-center gap-3 rounded-2xl border border-[#E0E9F4] bg-white p-4 shadow-[0_6px_20px_rgba(28,50,82,.04)] hover:border-[#9EBCE4]">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#E4F1FF] text-[#1778E8]"><ShieldCheck className="h-6 w-6"/></span><span className="min-w-0 flex-1"><strong className="block text-[12px] font-black text-[#10213D]">Insurance Quote Support</strong><span className="mt-1 block text-[10px] leading-4 text-[#647995]">Renewal, new policy or insurer change.</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#1778E8]"/>
        </Link>
        <Link href={{pathname:"/customer/e-challan",query:{account:account.id}}} className="flex items-center gap-3 rounded-2xl border border-[#E0E9F4] bg-white p-4 shadow-[0_6px_20px_rgba(28,50,82,.04)] hover:border-[#9EBCE4]">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#E4F1FF] text-[#1778E8]"><CarFront className="h-6 w-6"/></span><span className="min-w-0 flex-1"><strong className="block text-[12px] font-black text-[#10213D]">Challan Assistance</strong><span className="mt-1 block text-[10px] leading-4 text-[#647995]">Send vehicle and challan details.</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#1778E8]"/>
        </Link>
        <a href="tel:+916264911014" className="flex items-center gap-3 rounded-2xl border border-[#E0E9F4] bg-white p-4 shadow-[0_6px_20px_rgba(28,50,82,.04)] hover:border-[#9EBCE4]">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-[#E4F1FF] text-[#1778E8]"><Headphones className="h-6 w-6"/></span><span className="min-w-0 flex-1"><strong className="block text-[12px] font-black text-[#10213D]">General Support</strong><span className="mt-1 block text-[10px] leading-4 text-[#647995]">Call us for urgent help and questions.</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#1778E8]"/>
        </a>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[1.65fr_1fr]">
        <section className="rounded-2xl border border-[#E0E9F4] bg-white p-5 shadow-[0_6px_20px_rgba(28,50,82,.04)]">
          <div className="mb-4 flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#E4F1FF] text-[#1268C8]"><FileText className="h-6 w-6"/></span><div><h2 className="text-[17px] font-black text-[#10213D]">Raise a Support Ticket</h2><p className="mt-1 text-[10px] text-[#647995]">Tell us what you need and our team will get back to you.</p></div></div>
          <CustomerServiceRequestForm mode="support_ticket" customerId={account.id} claims={claims.map(claim=>({id:claim.id,claim_no:claim.claim_no,status:claim.current_status}))}/>
        </section>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-[#E0E9F4] bg-white p-4 shadow-[0_6px_20px_rgba(28,50,82,.04)]">
            <div className="flex items-center gap-3 rounded-xl bg-[#EDF5FF] p-3"><Lightbulb className="h-6 w-6 text-[#176FD3]"/><div><h3 className="text-[13px] font-black text-[#10213D]">Before you raise a ticket</h3><p className="text-[10px] text-[#647995]">Choose a topic to preselect the support category.</p></div></div>
            <div className="mt-2 divide-y divide-[#E6EDF5]">
              {[
                ["Policy related questions","policy"],
                ["Challan and traffic fines","challan"],
                ["Claim process","claim"],
                ["Vehicle and registration","vehicle"],
                ["Payments and refunds","payments"],
                ["Account and profile","account"],
                ["Other support topics","other"],
              ].map(([label,topic])=><Link key={topic} href={{pathname:"/customer/support",query:{account:account.id,topic}}} className="flex items-center justify-between gap-2 px-2 py-2.5 text-[11px] font-semibold text-[#25466F] hover:bg-[#F6F9FD]"><span className="flex items-center gap-2"><CircleHelp className="h-3.5 w-3.5 text-[#176FD3]"/>{label}</span><ChevronRight className="h-4 w-4"/></Link>)}
            </div>
          </div>
          <a href="#support-activity" className="flex items-center gap-3 rounded-2xl border border-[#E0E9F4] bg-white p-4 shadow-[0_6px_20px_rgba(28,50,82,.04)] hover:border-[#9EBCE4]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#E4F1FF] text-[#1268C8]"><Clock3 className="h-6 w-6"/></span><span className="flex-1"><strong className="block text-[12px] font-black text-[#10213D]">Your Support Activity</strong><span className="mt-1 block text-[10px] text-[#647995]">View and track all your raised requests.</span></span><ChevronRight className="h-5 w-5 text-[#1268C8]"/></a>
        </aside>
      </div>

      <section id="support-activity">
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