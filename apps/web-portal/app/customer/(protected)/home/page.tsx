import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CarFront, ClipboardCheck, ClipboardList, FilePlus2, Headphones, ShieldPlus, ShieldCheck, FileText, RefreshCcw, ArrowLeftRight, Truck, CalendarDays, ClipboardPlus, ShieldX, Headset, Wrench } from "lucide-react";
import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";
import { ManufacturerMark } from "../vehicles/customer-vehicles-register";
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
  const currentPolicies = policies.filter((policy) => customerPolicyTone(policy.end_date).tone !== "expired");
  const coveredIds = new Set(currentPolicies.map((policy) => policy.vehicle_id).filter(Boolean));
  const uncoveredVehicles = vehicles.filter((vehicle) => !coveredIds.has(vehicle.id));
  const covered = vehicles.length - uncoveredVehicles.length;
  const coverage = vehicles.length ? Math.round((covered / vehicles.length) * 100) : 0;
  const duePolicies = policies.filter((policy) => customerPolicyTone(policy.end_date).tone === "due");
  const openClaims = claims.filter((claim) => !isCompletedCustomerClaim(claim, milestones_by_claim.get(claim.id) ?? []) && claim.current_status !== "Rejected");
  const attentionCount = uncoveredVehicles.length + duePolicies.length;
  const accountQuery = { account: account.id };
  const latestPolicies = policies.slice(0, 4);
  const latestClaims = claims.slice(0, 4);
  return (
    <div className="space-y-4 pb-6">
      <style>{`
        @keyframes customerHomeBreathe {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.018); }
        }
        .customer-home-breathe { animation: customerHomeBreathe 4.8s ease-in-out infinite; transform-origin: center; }
        @media (prefers-reduced-motion: reduce) { .customer-home-breathe { animation: none; } }
      `}</style>
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/home" />
      <section className="relative isolate overflow-hidden rounded-[22px] border border-[#D6E7FA] bg-[#DDEEFF] p-5 text-[#102B54] shadow-[0_6px_24px_rgba(20,58,100,.06)] sm:p-7">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[75%] bg-[url('/assets/customerhome.jpeg')] bg-cover bg-center opacity-80"/>
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#EAF5FF] via-[#EAF5FF]/95 via-40% to-[#EAF5FF]/10"/>
        <div className="relative flex min-h-[155px] max-w-[560px] items-center py-2 sm:min-h-[185px] sm:py-4">
          <h1 className="text-[clamp(27px,3vw,38px)] font-bold tracking-tight">Good morning, {account.contact_name?.split(" ")[0] || "Customer"}!</h1>
        </div>
      </section>
      <section aria-label="Fleet overview" className="overflow-hidden rounded-2xl border border-[#E1EAF5] bg-white">
        <div className="grid grid-cols-2 lg:grid-cols-4">
          {[
            {label:"Total vehicles",value:vehicles.length,detail:"In your register",icon:CarFront,color:"text-[#1769DC]",background:"bg-[#EAF3FF]",href:"/customer/vehicles"},
            {label:"Insured vehicles",value:covered,detail:"With active cover",icon:ShieldCheck,color:"text-[#087A57]",background:"bg-[#E5F7EE]",href:"/customer/vehicles"},
            {label:"Uninsured vehicles",value:uncoveredVehicles.length,detail:"Need protection",icon:ShieldX,color:"text-[#C2414D]",background:"bg-[#FFF0F1]",href:"/customer/vehicles"},
            {label:"Fleet coverage",value:`${coverage}%`,detail:"Vehicles protected",icon:ShieldPlus,color:"text-[#1769DC]",background:"bg-[#EAF3FF]",href:"/customer/vehicles"},
          ].map(({label,value,detail,icon:Icon,color,background,href},index)=><Link key={label} href={{pathname:href,query:accountQuery}} className={`customer-home-breathe flex min-w-0 items-center gap-3 p-4 transition duration-200 hover:bg-[#F8FBFF] sm:p-5 ${index===0?"hover:z-10 hover:shadow-[0_8px_22px_rgba(20,58,100,.10)]":""} ${index%2===0?"":"border-l border-[#E6EDF6]"} ${index>=2?"border-t border-[#E6EDF6] lg:border-t-0":""} ${index>0?"lg:border-l lg:border-[#E6EDF6]":""}`}>
            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${background} ${color}`}><Icon className="h-5 w-5"/></span>
            <span className="min-w-0"><span className="block text-[12px] font-medium text-[#60799B]">{label}</span><strong className="block text-[28px] font-bold leading-tight tabular-nums text-[#102B54]">{value}</strong><small className="block text-[12px] text-[#7890AD]">{detail}</small></span>
          </Link>)}
        </div>
      </section>
      <section className="rounded-2xl border border-[#E1EAF5] bg-white p-4 sm:p-5">
        <h2 className="mb-3 text-[17px] font-bold text-[#102B54]">Quick actions</h2>
        <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {[
            {title:"Renew policies",href:"/customer/renewals",icon:CalendarDays,background:"bg-[#EAF3FF]",color:"text-[#1769DC]"},
            {title:"Start New Claim",href:"/customer/start-claim",icon:ClipboardPlus,background:"bg-[#E7F8EF]",color:"text-[#087A57]"},
            {title:"Get a quote",href:"/customer/insurance-quote",icon:FileText,background:"bg-[#EAF3FF]",color:"text-[#1769DC]"},
            {title:"My vehicles",href:"/customer/vehicles",icon:Truck,background:"bg-[#E7F8EF]",color:"text-[#087A57]"},
            {title:"Vehicle exchange",href:"/customer/exchange",icon:ArrowLeftRight,background:"bg-[#F1ECFF]",color:"text-[#7546CE]"},
            {title:"Support",href:"/customer/support",icon:Headset,background:"bg-[#EAF3FF]",color:"text-[#1769DC]"},
          ].map(({title,href,icon:Icon,background,color})=><Link key={href} href={href === "/customer/start-claim" ? { pathname: "/customer/start-claim", query: accountQuery } : { pathname: href, query: accountQuery }} className="customer-home-breathe group flex min-w-0 flex-col items-center gap-2 rounded-xl px-2 py-3 text-center transition hover:bg-[#F3F8FE]"><span className={`grid h-11 w-11 place-items-center rounded-xl ${background} ${color}`}><Icon className="h-[22px] w-[22px] stroke-[2]"/></span><span className="text-[12px] font-semibold text-[#244771]">{title}</span></Link>)}
        </nav>
        <Link href={{ pathname: "/customer/claims", query: accountQuery }} className="mt-3 inline-flex items-center gap-1 text-[12px] font-semibold text-[#1769DC]">Track Existing Claims <ArrowRight className="h-4 w-4"/></Link>
      </section>
      <div className="grid gap-4 lg:grid-cols-[.9fr_1.1fr]">
        <section className="overflow-hidden rounded-2xl border border-[#E0E8F3] bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-[#E6EDF6] px-4 py-3"><h2 className="flex items-center gap-2 text-[17px] font-bold text-[#102B54]"><AlertTriangle className="h-4 w-4 text-red-500"/>Needs your attention</h2><Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="text-[12px] font-semibold text-[#1769DC]">View all</Link></div>
          {attentionCount === 0?<p className="m-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">No urgent insurance actions.</p>:<div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="bg-[#F7FAFE] text-center text-[11px] font-semibold uppercase tracking-wide text-[#7186A0]"><tr><th className="px-4 py-2.5">Vehicle / Policy</th><th className="px-4 py-2.5">Issue</th><th className="px-4 py-2.5">Status</th></tr></thead>
              <tbody className="divide-y divide-[#EDF2F7]">
                {uncoveredVehicles.slice(0, 3).map(vehicle=>{ const href={pathname:`/customer/vehicles/${vehicle.id}`,query:accountQuery}; return <tr key={vehicle.id} className="cursor-pointer transition hover:bg-[#FFF9F7]">
                  <td className="p-0"><Link href={href} className="block px-4 py-3 font-semibold text-[13px] text-[#15345E]">{vehicle.vehicle_no || (vehicle.chassis_no ? `New-${vehicle.chassis_no}` : "Unregistered vehicle")}</Link></td>
                  <td className="p-0"><Link href={href} className="block px-4 py-3 text-[12px] text-[#C65A28]">No active insurance cover</Link></td>
                  <td className="p-0"><Link href={href} className="block px-4 py-3"><span className="inline-flex rounded-full bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-600">Uninsured</span></Link></td>
                </tr>;})}
                {duePolicies.slice(0, 2).map(policy=>{ const href={pathname:`/customer/policies/${policy.id}`,query:{...accountQuery,source:policy.source}}; return <tr key={policy.id} className="cursor-pointer transition hover:bg-[#FFFCF6]">
                  <td className="p-0"><Link href={href} className="block px-4 py-3 font-semibold text-[13px] text-[#15345E]">{policy.policy_no || "Renewal due"}</Link></td>
                  <td className="p-0"><Link href={href} className="block px-4 py-3 text-[12px] text-amber-700">Policy renewal due</Link></td>
                  <td className="p-0"><Link href={href} className="block px-4 py-3"><span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700">Due</span></Link></td>
                </tr>;})}
              </tbody>
            </table>
          </div>}
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-[#E0E8F3] bg-white">
          <div className="flex items-center justify-between border-b border-[#E6EDF6] px-4 py-3"><h2 className="flex items-center gap-2 text-[17px] font-bold text-[#102B54]"><CarFront className="h-4 w-4 text-[#1672DC]"/>My Vehicles</h2><Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="text-[12px] font-semibold text-[#1769DC]">View all</Link></div>
          {vehicles.length===0?<p className="p-4 text-xs text-[#7186A0]">No vehicles found.</p>:<div className="overflow-x-auto">
            <table className="w-full min-w-[620px] text-left">
              <thead className="bg-[#F7FAFE] text-center text-[11px] font-semibold uppercase tracking-wide text-[#7186A0]"><tr><th className="px-4 py-2.5">Vehicle</th><th className="px-4 py-2.5">Make / Model</th><th className="px-4 py-2.5">Insurance status</th></tr></thead>
              <tbody className="divide-y divide-[#EDF2F7]">
                {vehicles.slice(0,3).map(vehicle=>{
                  const insured=coveredIds.has(vehicle.id);
                  const href={pathname:`/customer/vehicles/${vehicle.id}`,query:accountQuery};
                  return <tr key={vehicle.id} className="cursor-pointer transition hover:bg-[#F8FBFF]">
                    <td className="p-0"><Link href={href} className="block px-4 py-3 font-semibold text-[13px] text-[#15345E]">{vehicle.vehicle_no || (vehicle.chassis_no?`New-${vehicle.chassis_no}`:"Unregistered")}</Link></td>
                    <td className="p-0"><Link href={href} className="flex px-4 py-3 items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#F5F9FE]"><ManufacturerMark make={vehicle.make??""}/></span><span className="min-w-0"><strong className="block truncate text-[12px] text-[#2B4668]">{vehicle.make || "—"}</strong><span className="block truncate text-[11px] text-[#7186A0]">{vehicle.model || "—"}</span></span></Link></td>
                    <td className="p-0"><Link href={href} className="block px-4 py-3"><span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${insured?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-600"}`}>{insured?"Insured":"Not insured"}</span></Link></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>}
        </section>
      </div>
      <section className="rounded-2xl border border-[#E1EAF5] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-[17px] font-bold text-[#102B54]">Explore insurance & services</h2><p className="mt-1 text-[11px] text-[#7186A0]">Everything you need to stay protected, in one place.</p></div>
          <Link href={{pathname:"/customer/support",query:accountQuery}} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#176CD4]">Need help? <ArrowRight className="h-3.5 w-3.5"/></Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {title:"Motor insurance",description:"Request a new quote",href:"/customer/insurance-quote",icon:Truck,color:"text-[#1B70D0]",background:"bg-[#EAF3FF]"},
            {title:"Policy renewal",description:"Review upcoming renewals",href:"/customer/renewals",icon:RefreshCcw,color:"text-[#16856B]",background:"bg-[#E7F8F1]"},
            {title:"My policy documents",description:"Access your policies",href:"/customer/policies",icon:FileText,color:"text-[#8C5BD7]",background:"bg-[#F3EDFF]"},
            {title:"Vehicle services",description:"Exchange and other services",href:"/customer/exchange",icon:Wrench,color:"text-[#C77823]",background:"bg-[#FFF3E5]"},
          ].map(({title,description,href,icon:Icon,color,background})=><Link key={href} href={{pathname:href,query:accountQuery}} className="group flex min-w-0 flex-col gap-3 rounded-xl border border-[#E6EDF6] bg-[#FCFDFF] p-3.5 transition hover:-translate-y-0.5 hover:border-[#AAC9EF] hover:bg-white hover:shadow-md"><span className={`grid h-11 w-11 place-items-center rounded-xl ${background} ${color}`}><Icon className="h-5 w-5"/></span><span className="min-w-0"><strong className="block text-xs text-[#142C4D]">{title}</strong><small className="mt-1 block text-[12px] text-[#7186A0]">{description}</small></span></Link>)}
        </div>
      </section>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-[#E0E8F3] bg-white p-3">
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[14px] font-black text-[#10284A]"><ShieldCheck className="h-4 w-4 text-[#1672DC]"/>My Policies</h2><Link href={{pathname:"/customer/policies",query:accountQuery}} className="text-[10px] font-bold text-[#176CD4]">View all</Link></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[410px] text-left text-[10px]"><thead className="bg-[#F1F6FC] text-center text-[#637B9A]"><tr><th className="p-2">Policy Number</th><th className="p-2">Vehicle</th><th className="p-2">Insurer</th><th className="p-2">Status</th></tr></thead><tbody>{latestPolicies.map(policy=><tr key={policy.id} className="border-b border-[#EEF2F8]"><td className="p-2 font-bold"><Link href={{pathname:`/customer/policies/${policy.id}`,query:{...accountQuery,source:policy.source}}}>{policy.policy_no||"—"}</Link></td><td className="p-2">{policy.vehicle_no||"—"}</td><td className="p-2">{policy.insurer_name||"—"}</td><td className="p-2"><span className="rounded-full bg-[#EEF5FF] px-2 py-1">{customerPolicyTone(policy.end_date).tone}</span></td></tr>)}</tbody></table>{latestPolicies.length===0?<p className="p-3 text-xs text-[#7186A0]">No policies found.</p>:null}</div>
        </section>
        <section className="min-w-0 rounded-xl border border-[#E0E8F3] bg-white p-3">
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[14px] font-black text-[#10284A]"><ClipboardList className="h-4 w-4 text-[#1672DC]"/>My Claims</h2><Link href={{pathname:"/customer/claims",query:accountQuery}} className="text-[10px] font-bold text-[#176CD4]">View all</Link></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[340px] text-left text-[10px]"><thead className="bg-[#F1F6FC] text-center text-[#637B9A]"><tr><th className="p-2">Claim Number</th><th className="p-2">Status</th></tr></thead><tbody>{latestClaims.map(claim=>{ const href={pathname:"/customer/claims",query:accountQuery}; return <tr key={claim.id} className="cursor-pointer border-b border-[#EEF2F8] transition hover:bg-[#F8FBFF]"><td className="p-0 font-bold"><Link href={href} className="block p-2">{claim.claim_no||claim.id.slice(0,8)}</Link></td><td className="p-0"><Link href={href} className="block p-2">{claim.current_status||"Submitted"}</Link></td></tr>;})}</tbody></table>{latestClaims.length===0?<p className="p-3 text-xs text-[#7186A0]">No claims found.</p>:null}</div>
        </section>
      </div>
    </div>
  );
}
