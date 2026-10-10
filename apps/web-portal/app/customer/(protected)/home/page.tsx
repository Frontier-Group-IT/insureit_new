import Link from "next/link";
import { AlertCircle, ArrowRight, BadgeIndianRupee, BellRing, CalendarClock, CarFront, ChartPie, CheckCircle2, ClipboardList, FilePlus2, Headphones, MessageCircle, PhoneCall, ReceiptText, RefreshCcw, ShieldCheck } from "lucide-react";
import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";
import { customerPolicyTone, loadCustomerWebPolicies, loadCustomerWebVehicles, resolveCustomerWebScope } from "@/lib/customer-web-data";
import { isCompletedCustomerClaim, loadCustomerClaimListContext } from "@/lib/customer-web-phase2-data";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function CustomerHomePage({ searchParams }: { searchParams?: Promise<{ account?: string }> }) {
  const params = searchParams ? await searchParams : {};
  const { account, accounts } = await resolveCustomerWebScope(params.account);
  const [vehicles, policies, claimContext] = await Promise.all([
    loadCustomerWebVehicles(account.id),
    loadCustomerWebPolicies(account.id),
    loadCustomerClaimListContext(account.id),
  ]);
  const { claims, milestones_by_claim } = claimContext;
  const currentPolicies = policies.filter((p) => customerPolicyTone(p.end_date).tone !== "expired");
  const coveredIds = new Set(currentPolicies.map((p) => p.vehicle_id).filter(Boolean));
  const covered = vehicles.filter((v) => coveredIds.has(v.id)).length;
  const uncovered = vehicles.length - covered;
  const coverage = vehicles.length ? Math.round((covered / vehicles.length) * 100) : 0;
  const due = policies.filter((p) => customerPolicyTone(p.end_date).tone === "due").length;
  const settled = claims.filter((claim) => isCompletedCustomerClaim(claim, milestones_by_claim.get(claim.id) ?? [])).length;
  const open = claims.filter((claim) => !isCompletedCustomerClaim(claim, milestones_by_claim.get(claim.id) ?? []) && claim.current_status !== "Rejected").length;
  const accountQuery = { account: account.id };
  const kpis = [
    { label: "Vehicles", value: vehicles.length, icon: CarFront, info: "In your fleet" },
    { label: "Active cover", value: currentPolicies.length, icon: ShieldCheck, info: "Policies not expired" },
    { label: "Renewal due", value: due, icon: CalendarClock, info: "Due for renewal" },
    { label: "Fleet covered", value: `${coverage}%`, icon: ChartPie, info: `${covered} of ${vehicles.length} vehicles` },
    { label: "Uncovered vehicles", value: uncovered, icon: AlertCircle, info: "Without active cover" },
  ];

  const actions = [
    { label: "Renewal", href: "/customer/renewals", icon: CalendarClock },
    { label: "Start claim", href: "/customer/start-claim", icon: FilePlus2 },
    { label: "Exchange", href: "/customer/exchange", icon: RefreshCcw },
    { label: "Get quote", href: "/customer/insurance-quote", icon: BadgeIndianRupee },
    { label: "Pay challan", href: "/customer/e-challan", icon: ReceiptText },
  ];

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-[20px] font-black tracking-tight text-[#10213D]">Welcome, {account.contact_name?.split(" ")[0] || "Customer"}</h1>
        <p className="mt-1 flex items-center gap-2 text-[11px] font-bold text-[#66768F]"><BellRing className="h-3.5 w-3.5 text-[#D49A32]" /> {uncovered + due} fleet items need attention</p>
      </div>
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/home" />

      <section className="overflow-hidden rounded-2xl border border-[#E1E9F4] bg-white shadow-[0_4px_18px_rgba(21,47,81,0.06)]">
        <div className="grid min-h-[150px] grid-cols-[minmax(125px,1fr)_minmax(0,2fr)_minmax(92px,.8fr)] items-center gap-2 px-4 py-3">
          <div className="self-stretch flex flex-col justify-between gap-2">
            <div><p className="text-[11px] font-black uppercase tracking-wide text-[#61728B]">Your Fleet Summary</p><p className="mt-2 text-3xl font-black text-[#112A52] sm:text-4xl">{vehicles.length}</p><p className="text-[10px] font-black uppercase text-[#758198]">Vehicles</p></div>
            <Link href={{ pathname: "/customer/vehicles", query: accountQuery }} className="flex max-w-[260px] items-center justify-between gap-2 rounded-lg bg-[#FFF2F2] px-2.5 py-2 text-[10px] font-semibold text-[#D82D38] hover:bg-[#FFE8E8]"><span className="flex items-center gap-1.5"><AlertCircle className="h-4 w-4 shrink-0"/>{uncovered ? `${uncovered} vehicle${uncovered === 1 ? "" : "s"} without active policy` : "All vehicles covered"}</span><ArrowRight className="h-4 w-4 shrink-0"/></Link>
          </div>
          <img src="/customer-fleet-banner.svg" alt="Two passenger cars and a blue commercial truck in front of a city skyline" className="h-[130px] w-full object-contain sm:h-[150px]" />
          <div className="flex justify-center"><div className="grid h-[76px] w-[76px] place-items-center rounded-full p-2 sm:h-[108px] sm:w-[108px]" style={{background:`conic-gradient(#1684E9 ${coverage}%, #E7EEF8 ${coverage}% 100%)`}}><div className="grid h-full w-full place-content-center rounded-full bg-white text-center"><p className="text-xl font-black text-[#112A52] sm:text-3xl">{coverage}%</p><p className="text-[10px] font-bold text-[#66758D]">Covered</p></div></div></div>
        </div>
      </section>
      <section aria-label="Fleet key metrics" className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map(({ label, value, icon: Icon, info }, index) => (
          <div key={label} className={`flex min-h-[95px] items-center gap-3 rounded-2xl border border-white/80 p-3 shadow-[0_3px_12px_rgba(21,47,81,0.04)] ${["bg-[#F1F7FF]","bg-[#EFFAF4]","bg-[#FFF8EB]","bg-[#F0F7FF]","bg-[#FFF0F1]"][index]}`}>
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-xl ${["bg-[#DCEBFF] text-[#1755AB]","bg-[#DDF7E9] text-[#08955E]","bg-[#FFF0D3] text-[#E18D14]","bg-[#E0F0FF] text-[#2182D0]","bg-[#FFE1E4] text-[#D52B37]"][index]}`}><Icon className="h-7 w-7"/></span>
            <div className="min-w-0"><p className="text-[10px] font-black uppercase text-[#63758F]">{label}</p><p className="mt-1 text-2xl font-black text-[#112A52]">{value}</p><p className="text-[10px] text-[#758198]">{info}</p></div>
          </div>
        ))}
      </section>
      <section className="rounded-[22px] border border-[#D9E3F0] bg-white p-3 shadow-[0_4px_18px_rgba(21,47,81,0.06)]">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black uppercase text-[#314767]">Quick Actions</h2><span className="text-[11px] font-semibold text-[#7A8799]">One tap services</span></div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
          {actions.map(({ label, href, icon: Icon }, index) => <Link key={label} href={{ pathname: href, query: accountQuery }} className={`flex min-h-[78px] items-center gap-3 rounded-xl p-3 text-[11px] font-bold text-[#112A52] transition hover:brightness-[.97] ${["bg-[#EDF6FF]","bg-[#ECFAF4]","bg-[#F4F0FF]","bg-[#FFF5E8]","bg-[#FFF0F2]"][index]}`}><span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${["bg-[#DCEBFF] text-[#1755AB]","bg-[#DDF7E9] text-[#08955E]","bg-[#E8E0FF] text-[#6245D8]","bg-[#FFEDD3] text-[#DB8211]","bg-[#FFE0E5] text-[#D52B37]"][index]}`}><Icon className="h-6 w-6"/></span><span className="flex-1">{label}</span><span className="grid h-6 w-6 place-items-center rounded-full bg-white/80 text-[#245DAD]"><ArrowRight className="h-3.5 w-3.5"/></span></Link>)}
        </div>
      </section>
      <section className="overflow-hidden rounded-[22px] border border-[#D9E3F0] bg-white shadow-[0_4px_18px_rgba(21,47,81,0.06)]">
        <div className="relative overflow-hidden bg-gradient-to-r from-[#0B234D] via-[#123B72] to-[#0B4684] p-4 text-white">
          <div className="pointer-events-none absolute -bottom-16 -left-12 h-32 w-[55%] rounded-[50%] bg-[#1870BA]/20"/><div className="pointer-events-none absolute -bottom-20 right-0 h-36 w-[55%] rounded-[50%] bg-[#287CC4]/20"/>
          <div className="relative flex items-center justify-between"><div className="flex items-center gap-3"><h2 className="text-xl font-black">Claims</h2><span className="hidden text-[11px] text-[#B9CDE8] sm:inline">Track and manage your claims easily.</span></div><Link href={{ pathname: "/customer/claims", query: accountQuery }} className="flex items-center gap-2 text-xs font-bold text-[#E4EDFA] hover:text-white">View all <span className="grid h-6 w-6 place-items-center rounded-full bg-[#225D9F]"><ArrowRight className="h-4 w-4"/></span></Link></div>
          <div className="relative mt-3 grid grid-cols-3 divide-x divide-white/15">
            {[{label:"Total",value:claims.length,icon:ClipboardList,color:"text-[#D6E7FF]"},{label:"Open",value:open,icon:CalendarClock,color:"text-[#FFC45C]"},{label:"Settled",value:settled,icon:CheckCircle2,color:"text-white"}].map(({label,value,icon:Icon,color}) => <div key={label} className="flex items-center justify-center gap-3 px-2"><span className="hidden h-10 w-10 shrink-0 place-items-center rounded-full bg-[#235A9E] sm:grid"><Icon className="h-5 w-5"/></span><div><p className={`text-2xl font-black ${color}`}>{value}</p><p className="text-[11px] font-bold">{label}</p></div></div>)}
          </div>
        </div>
        <Link href={{ pathname: "/customer/claims", query: accountQuery }} className="flex items-center justify-between gap-2 px-4 py-3 text-[12px] font-bold text-[#183256] hover:bg-[#F7FAFE]"><span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-emerald-600" />{claims.length ? `${open} claim${open === 1 ? "" : "s"} in progress` : "No claims yet"}</span><ArrowRight className="h-4 w-4"/></Link>
      </section>

      <section className="rounded-[22px] border border-[#E2EAF4] bg-[#F0F7FF] p-3">
        <h2 className="text-[16px] font-black text-[#10213D]">Insureit Support <span className="ml-1 text-[11px] font-semibold text-[#72829B]">| we are here when it matters</span></h2>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {[
            { label: "Call", icon: PhoneCall, color: "bg-[#079C79]" },
            { label: "WhatsApp", icon: MessageCircle, color: "bg-[#079C79]" },
            { label: "Ticket", icon: Headphones, color: "bg-[#205AAE]" },
          ].map(({ label, icon: Icon, color }) => <Link key={label} href={{ pathname: "/customer/support", query: accountQuery }} title={`Open Support for ${label.toLowerCase()} assistance`} className="flex flex-col items-center gap-2 rounded-xl px-2 py-1 text-xs font-black text-[#12284A] hover:bg-white"><span className={`grid h-9 w-9 place-items-center rounded-xl text-white ${color}`}><Icon className="h-6 w-6" /></span>{label}</Link>)}
        </div>
      </section>
    </div>
  );
}
