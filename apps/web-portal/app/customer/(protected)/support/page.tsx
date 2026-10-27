import { CustomerAnimatedSearchInput } from "@/components/customer-portal/customer-animated-search-input";
import Link from "next/link";
import { ArrowRight, FileText, Headphones, ShieldCheck, Clock3, Search, CarFront, CreditCard, CircleHelp, ClipboardList } from "lucide-react";
import {
  CustomerAccountTabs,
  EmptyCustomerState,
  StatusPill,
} from "@/components/customer-portal/customer-phase1";
import { CustomerSupportTicketPanel } from "@/components/customer-portal/customer-support-ticket-panel";
import { resolveCustomerWebScope } from "@/lib/customer-web-data";
import {
  formatCustomerCompactDate,
  loadCustomerServiceActivity,
  loadCustomerSupportClaims,
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
  const rows = activity.filter((item) =>
    !query ||
    [item.enquiry_no, item.subject, item.service_type, item.status, item.vehicle_no]
      .some((value) => value?.toLowerCase().includes(query)),
  );

  return (
    <div className="space-y-5">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/support" />

      <section className="relative isolate min-h-[172px] overflow-hidden rounded-xl border border-[#E3E7F4] bg-[#F4F5FF] px-5 py-5 sm:px-7">
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[url('/assets/supclaim.jpeg')] bg-no-repeat bg-right-center bg-[length:auto_100%]" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F5F7FF]/96 via-[#F5F7FF]/82 via-40% to-transparent" />
        <div className="relative z-10 max-w-[530px]">
          <h1 className="text-[29px] font-extrabold leading-tight tracking-tight text-[#212755]">Need Help?</h1>
          <p className="mt-1 max-w-[360px] text-[11px] font-medium leading-4 text-[#7781A5]">Get quick support, track your requests<br/>and resolve your queries — all in one place.</p>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
            <div className="flex items-center gap-2"><Headphones className="h-4 w-4 text-[#693CEC]"/><span><b className="block text-[10px] text-[#343B73]">Quick Response</b><small className="text-[9px] text-[#8791AB]">We&apos;re here to help</small></span></div>
            <div className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-[#693CEC]"/><span><b className="block text-[10px] text-[#343B73]">Trusted Support</b><small className="text-[9px] text-[#8791AB]">From real experts</small></span></div>
            <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-[#693CEC]"/><span><b className="block text-[10px] text-[#343B73]">24/7 Assistance</b><small className="text-[9px] text-[#8791AB]">Anytime, Anywhere</small></span></div>
          </div>
        </div>
      </section>

      <section className="space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <h2 className="text-[15px] font-bold text-[#29305D]">Quick Help</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          {([
            {label:"Policy Related",desc:"Download, renewal, changes",icon:FileText,href:"/customer/policies"},
            {label:"Claims",desc:"Status, documents, process",icon:ShieldCheck,href:"/customer/claims"},
            {label:"Vehicle & Policy",desc:"Add vehicle, update details",icon:CarFront,href:"/customer/vehicles"},
            {label:"Payments",desc:"Premium, refunds, receipts",icon:CreditCard,href:"/customer/support"},
            {label:"Other Queries",desc:"General help & FAQs",icon:CircleHelp,href:"/customer/support"},
          ] as const).map(item=><Link key={item.label} href={{pathname:item.href,query:{account:account.id}}} className="group flex min-h-[65px] items-center gap-2 rounded-xl border border-[#EBEDF7] bg-[#F9FAFF] p-2.5 transition hover:border-[#CFC8F9] hover:bg-[#F3F0FF]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEEAFF] text-[#653DEC]"><item.icon className="h-4.5 w-4.5"/></span>
            <span className="min-w-0 flex-1"><b className="block text-[11px] font-bold text-[#2B3268]">{item.label}</b><small className="block text-[9px] text-[#8A94AC]">{item.desc}</small></span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#7D77BD]"/>
          </Link>)}
        </div>
      </section>

      <section id="support-activity" className="space-y-3">
        <CustomerSupportTicketPanel customerId={account.id} claims={claims.map(claim=>({id:claim.id,claim_no:claim.claim_no,status:claim.current_status}))} search={
          <form className="flex h-9 w-full max-w-[465px] items-center gap-2 rounded-lg border border-[#E6E8F4] bg-white px-3 focus-within:border-[#AB9BF5]">
            <Search className="h-3.5 w-3.5 shrink-0 text-[#939AB3]"/>
            <input type="hidden" name="account" value={account.id}/>
            <CustomerAnimatedSearchInput name="q" defaultValue={params.q ?? ""} aria-label="Search support requests" hints={["Search by ticket number or subject…","Search request status…"]} className="text-[10px] text-[#252B5E]"/>
          </form>
        }/>
        <div className="rounded-xl border border-[#EBEDF7] bg-white p-3 sm:p-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {rows.length ? rows.map(item=>(
            <Link key={item.id} href={{pathname:`/customer/support/${item.id}`,query:{account:account.id}}} className="group flex min-h-[105px] flex-col rounded-xl border border-[#E9EBF5] bg-[#FCFCFF] p-3 transition hover:border-[#CFC7F7] hover:shadow-sm">
              <div className="flex items-start gap-2">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#EEEAFE] text-[#6942EB]"><FileText className="h-4 w-4"/></span>
                <span className="min-w-0 flex-1"><b className="block truncate text-[10.5px] text-[#252B5C]">{item.subject}</b><small className="text-[9px] text-[#7D86A5]">{item.enquiry_no}</small></span>
                <StatusPill tone={serviceActivityTone(item.status)}>{item.status.replace("_"," ")}</StatusPill>
              </div>
              <p className="mt-2 text-[9px] leading-4 text-[#8189A5]">{item.vehicle_no?`Vehicle: ${item.vehicle_no} · `:""}{formatCustomerCompactDate(item.updated_at || item.created_at)}</p>
                          </Link>
          )) : <div className="sm:col-span-2 xl:col-span-4"><EmptyCustomerState title={activity.length?"No matching support requests":"No support requests yet"} body={activity.length?"Try a different search term.":"Your raised requests will appear here."}/></div>}
          </div>
        </div>
      </section>

    </div>
  );
}
