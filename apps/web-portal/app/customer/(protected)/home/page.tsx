import "./customer-home-modern.css";
import Link from "next/link";
import { AlertTriangle, CarFront, ClipboardList, ShieldPlus, ShieldCheck, FileText, ArrowLeftRight, Truck, CalendarDays, ClipboardPlus, ShieldX, Headset } from "lucide-react";
import { CustomerAccountTabs } from "@/components/customer-portal/customer-phase1";
import { CustomerHomeScrollMotion } from "./customer-home-scroll-motion";
import { CustomerHomeCount } from "./customer-home-count";
import { ManufacturerMark } from "../vehicles/customer-vehicles-register";
import { customerPolicyTone, loadCustomerWebPolicies, loadCustomerWebVehicles, resolveCustomerWebScope } from "@/lib/customer-web-data";
import { isCompletedCustomerClaim, loadCustomerClaimListContext } from "@/lib/customer-web-phase2-data";

function customerHomeInsurerName(name: string | null): string {
  if (!name) return "—";
  return name.trim()
    .replace(/\s+(?:(?:Private|Pvt\.?)\s+)?(?:Limited|Ltd\.?)$/i, "")
    .replace(/\s+(?:(?:General|Life|Health)\s+)?Insurance(?:\s+Company)?$/i, "")
    .trim();
}

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
  const duePolicies = policies.filter((policy) => customerPolicyTone(policy.end_date).tone === "due");
  const openClaims = claims.filter((claim) => !isCompletedCustomerClaim(claim, milestones_by_claim.get(claim.id) ?? []) && claim.current_status !== "Rejected");
  const attentionCount = uncoveredVehicles.length + duePolicies.length;
  const accountQuery = { account: account.id };
  const latestPolicies = policies.slice(0, 4);
  const latestClaims = claims.slice(0, 4);
  return (
    <div data-customer-home className="customer-home-modern space-y-4 pb-6">
      <style>{`
        @keyframes customerHomeEnter { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes customerCardEnter { from { opacity: 0; transform: translateY(9px); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes customerHomeBreathe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.035); } }
        .customer-home-enter { animation: customerHomeEnter 360ms cubic-bezier(.22,.72,.25,1) both; }
        .customer-home-breathe { position: relative; transform-origin: center; animation: customerCardEnter 360ms cubic-bezier(.22,.72,.25,1) backwards; transition: transform 300ms ease, box-shadow 300ms ease; }
        .customer-home-breathe:nth-child(1) { animation-delay: 70ms; }
        .customer-home-breathe:nth-child(2) { animation-delay: 120ms; }
        .customer-home-breathe:nth-child(3) { animation-delay: 170ms; }
        .customer-home-breathe:nth-child(4) { animation-delay: 220ms; }
        .customer-home-breathe .customer-home-icon-breathe { transition: transform 220ms ease; transform-origin: center; }
        @media (hover: hover) { .customer-home-breathe:hover { z-index: 3; transform: translateY(-3px); box-shadow: 0 12px 26px rgba(20,58,100,.13); } }
        .customer-home-breathe:focus-visible { z-index: 3; transform: scale(1.08); outline: 2px solid #1769DC; outline-offset: -2px; }
        @keyframes customerHeroZoom { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.025); } }
        .customer-home-hero-image { animation: customerHeroZoom 12s ease-in-out 1 both; transform-origin: 75% center; }
        .customer-home-quick-action { position: relative; transform-origin: center; transition: transform 300ms ease, box-shadow 300ms ease, background-color 300ms ease; animation: customerCardEnter 360ms cubic-bezier(.22,.72,.25,1) backwards; }
        .customer-home-quick-action:nth-child(1) { animation-delay: 90ms; }
        .customer-home-quick-action:nth-child(2) { animation-delay: 140ms; }
        .customer-home-quick-action:nth-child(3) { animation-delay: 190ms; }
        .customer-home-quick-action:nth-child(4) { animation-delay: 240ms; }
        .customer-home-quick-action:nth-child(5) { animation-delay: 290ms; }
        .customer-home-quick-action:nth-child(6) { animation-delay: 340ms; }
        @media (hover: hover) { .customer-home-quick-action:hover { z-index: 2; transform: translateY(-3px); box-shadow: 0 12px 26px rgba(20,58,100,.14); } }
        .customer-home-quick-action:focus-visible { z-index: 2; transform: translateY(-3px); box-shadow: 0 12px 26px rgba(20,58,100,.14); outline: 2px solid #1769DC; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .customer-home-enter, .customer-home-breathe, .customer-home-breathe .customer-home-icon-breathe, .customer-home-hero-image, .customer-home-quick-action { animation: none !important; }
          .customer-home-breathe, .customer-home-breathe:hover, .customer-home-breathe:focus-visible, .customer-home-quick-action, .customer-home-quick-action:focus-visible, .customer-home-quick-action:hover { transition: none; transform: none; }
        }
        .customer-home-motion-ready [data-home-reveal] { transition: opacity 400ms cubic-bezier(.22,.72,.25,1), transform 400ms cubic-bezier(.22,.72,.25,1), box-shadow 300ms ease, border-color 300ms ease; }
        .customer-home-motion-ready [data-home-reveal]:not(.customer-home-visible) { opacity: 0; transform: translateY(12px); }
        .customer-home-motion-ready [data-home-reveal].customer-home-visible { opacity: 1; transform: translateY(0); }
        .customer-home-motion-ready .customer-home-explore-card:nth-child(2) { transition-delay: 100ms; }
        .customer-home-motion-ready .customer-home-explore-card:nth-child(3) { transition-delay: 200ms; }
        .customer-home-motion-ready .customer-home-explore-card:nth-child(4) { transition-delay: 300ms; }
        @media (hover: hover) { .customer-home-explore-card.customer-home-visible:hover { position: relative; z-index: 2; transform: translateY(-3px); box-shadow: 0 12px 26px rgba(20,58,100,.14); transition-delay: 0ms; } }
        .customer-home-explore-card:focus-visible { position: relative; z-index: 2; transform: translateY(-3px) !important; box-shadow: 0 12px 26px rgba(20,58,100,.14); outline: 2px solid #1769DC; outline-offset: 2px; transition-delay: 0ms; }
        @media (prefers-reduced-motion: reduce) { .customer-home-motion-ready [data-home-reveal], .customer-home-explore-card, .customer-home-explore-card:focus-visible { transition: none !important; opacity: 1 !important; transform: none !important; } }
      `}</style>
      <CustomerHomeScrollMotion />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/home" />
      <section className="customer-modern-hero customer-home-enter relative isolate overflow-hidden rounded-[28px] border border-[#DCD3FF] p-5 text-[#102B54] shadow-[0_14px_36px_rgba(63,42,145,.12)] sm:p-7 lg:p-9">
        <div className="customer-home-hero-image pointer-events-none absolute inset-0 bg-[url('/assets/home.jpeg')] bg-cover bg-[center_55%] opacity-90" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[#F3F0FF] via-[#F1EEFF]/95 via-50% to-[#E8F5FF]/25" />
        <div className="customer-modern-hero-orb pointer-events-none absolute -left-20 -top-28 h-60 w-60 rounded-full bg-[#A18BFF]/25 blur-3xl" />
        <div className="relative flex min-h-[230px] max-w-[650px] flex-col justify-center gap-3 py-3 sm:min-h-[260px] sm:gap-4">
          <div className="space-y-2">
            <h1 className="max-w-[530px] text-[clamp(26px,3.1vw,43px)] font-black leading-[1.12] tracking-[-.035em] text-[#182E60]">Good morning, <span className="customer-modern-gradient-text">{account.contact_name?.split(" ")[0] || "Customer"}!</span></h1>
            <p className="max-w-[390px] text-[12px] font-medium leading-relaxed text-[#526481] sm:text-[14px]">Every vehicle. Every policy. Every journey — confidently protected with INSUREIT.</p>
          </div>

        </div>
      </section>
      <section aria-label="Account overview" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Vehicles", count: vehicles.length, href: "/customer/vehicles", icon: CarFront },
          { label: "Policies", count: policies.length, href: "/customer/policies", icon: ShieldCheck },
          { label: "Open claims", count: openClaims.length, href: "/customer/claims", icon: ClipboardList },
          { label: "Needs attention", count: attentionCount, href: "/customer/renewals", icon: AlertTriangle },
        ].map(({ label, count, href, icon: Icon }, index) => (
          <Link key={label} href={{ pathname: href, query: accountQuery }} className={`customer-home-breathe customer-modern-kpi customer-modern-kpi-${index + 1} group flex min-w-0 items-center gap-3 rounded-2xl border border-[#E2E8F4] bg-white px-3 py-4 shadow-[0_5px_16px_rgba(50,39,112,.07)] focus-visible:outline-offset-2 sm:px-4 sm:py-5`} style={{ animationDelay: `${index * 55}ms` }}>
            <span className="customer-home-icon-breathe customer-modern-kpi-icon grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#F0EBFF] text-[#6650BE] transition-transform group-hover:scale-110"><Icon className="h-5 w-5" /></span>
            <span className="min-w-0"><span className="block text-[22px] font-black leading-7 tracking-tight text-[#19345F] sm:text-[26px]"><CustomerHomeCount value={count} /></span><span className="block truncate text-[11px] font-bold text-[#657794]">{label}</span></span>
          </Link>
        ))}
      </section>
      <section aria-label="Quick actions" className="rounded-2xl border border-[#E0E8F3] bg-white px-3 py-3 shadow-[0_3px_12px_rgba(20,58,100,.04)] sm:px-4">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-[14px] font-black text-[#10284A]">Quick actions</h2>
          <span className="text-[10px] font-semibold text-[#7186A0]">One tap services</span>
        </div>
        <nav aria-label="Customer quick actions" className="grid grid-cols-3 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {[
            {title:"Renew policies",href:"/customer/renewals",art:"/assets/Custom-Icons/optimized-128/renewal.png"},
            {title:"Start New Claim",href:"/customer/start-claim",art:"/assets/Custom-Icons/optimized-128/claims.png"},
            {title:"Get a quote",href:"/customer/insurance-quote",art:"/assets/Custom-Icons/optimized-128/documents.png"},
            {title:"My vehicles",href:"/customer/vehicles",art:null},
            {title:"Vehicle exchange",href:"/customer/exchange",art:"/assets/Custom-Icons/optimized-128/distribution-network.png"},
            {title:"Support",href:"/customer/support",art:"/assets/Custom-Icons/optimized-128/customers.png"},
          ].map(({title,href,art})=><Link key={href} href={href === "/customer/start-claim" ? { pathname: "/customer/start-claim", query: accountQuery } : { pathname: href, query: accountQuery }} className="customer-home-quick-action group flex min-w-0 flex-col items-center justify-center gap-1.5 rounded-xl px-1.5 py-2.5 text-center transition hover:bg-[#F3F8FE] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1769DC]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#EFF7F5] shadow-[0_2px_7px_rgba(18,37,68,.08)] transition-transform group-hover:scale-105">{art ? <img src={art} alt="" aria-hidden="true" className="h-9 w-9 object-contain" /> : <CarFront aria-hidden="true" className="h-9 w-9 text-[#1557A8]" strokeWidth={1.8} />}</span><span className="text-[11px] font-bold leading-4 text-[#244771]">{title}</span></Link>)}
        </nav>
      </section>
      <div className="grid gap-3 lg:grid-cols-2">
        <section data-home-reveal className="min-w-0 overflow-hidden rounded-2xl border border-[#E0E8F3] bg-white">
          <div className="flex items-center justify-between gap-2 border-b border-[#E6EDF6] px-3 py-1.5"><h2 className="flex items-center gap-2 text-[14px] font-black text-[#10284A]"><AlertTriangle className="h-4 w-4 text-red-500"/>Needs your attention</h2><Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="text-[12px] font-semibold text-[#1769DC]">View all</Link></div>
          {attentionCount === 0?<p className="m-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">No urgent insurance actions.</p>:<div className="overflow-x-auto">
            <table className="w-full min-w-[440px] text-center">
              <thead className="bg-[#F7FAFE] text-center text-[10px] font-semibold uppercase tracking-wide text-[#7186A0]"><tr><th className="px-3 py-1.5">Vehicle / Policy</th><th className="px-3 py-1.5">Issue</th><th className="px-3 py-1.5">Status</th></tr></thead>
              <tbody className="divide-y divide-[#EDF2F7]">
                {uncoveredVehicles.slice(0, 3).map(vehicle=>{ const href={pathname:`/customer/vehicles/${vehicle.id}`,query:accountQuery}; return <tr key={vehicle.id} className="cursor-pointer transition hover:bg-[#FFF9F7]">
                  <td className="p-0"><Link href={href} className="block px-3 py-1.5 text-center font-medium text-[11px] text-[#526782]">{vehicle.vehicle_no || (vehicle.chassis_no ? `New-${vehicle.chassis_no}` : "Unregistered vehicle")}</Link></td>
                  <td className="p-0"><Link href={href} className="block px-3 py-1.5 text-center text-[11px] text-[#9A765F]">No active insurance cover</Link></td>
                  <td className="p-0"><Link href={href} className="block px-3 py-1.5 text-center"><span className="inline-flex rounded-full bg-red-50 px-2 py-1 text-[10px] font-semibold text-red-600">Uninsured</span></Link></td>
                </tr>;})}
                {duePolicies.slice(0, 2).map(policy=>{ const href={pathname:`/customer/policies/${policy.id}`,query:{...accountQuery,source:policy.source}}; return <tr key={policy.id} className="cursor-pointer transition hover:bg-[#FFFCF6]">
                  <td className="p-0"><Link href={href} className="block px-3 py-1.5 text-center font-medium text-[11px] text-[#526782]">{policy.policy_no || "Renewal due"}</Link></td>
                  <td className="p-0"><Link href={href} className="block px-3 py-1.5 text-center text-[11px] text-[#9A765F]">Policy renewal due</Link></td>
                  <td className="p-0"><Link href={href} className="block px-3 py-1.5 text-center"><span className="inline-flex rounded-full bg-amber-50 px-2 py-1 text-[10px] font-semibold text-amber-700">Due</span></Link></td>
                </tr>;})}
              </tbody>
            </table>
          </div>}
        </section>

        <section data-home-reveal className="min-w-0 overflow-hidden rounded-2xl border border-[#E0E8F3] bg-white">
          <div className="flex items-center justify-between border-b border-[#E6EDF6] px-3 py-1.5"><h2 className="flex items-center gap-2 text-[14px] font-black text-[#10284A]"><CarFront className="h-4 w-4 text-[#1672DC]"/>My Vehicles</h2><Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="text-[12px] font-semibold text-[#1769DC]">View all</Link></div>
          {vehicles.length===0?<p className="p-4 text-xs text-[#7186A0]">No vehicles found.</p>:<div className="overflow-x-auto">
            <table className="w-full min-w-[470px] text-center">
              <thead className="bg-[#F7FAFE] text-center text-[10px] font-semibold uppercase tracking-wide text-[#7186A0]"><tr><th className="px-3 py-1.5">Vehicle</th><th className="px-3 py-1.5">Make / Model</th><th className="px-3 py-1.5">Insurance status</th></tr></thead>
              <tbody className="divide-y divide-[#EDF2F7]">
                {vehicles.slice(0,3).map(vehicle=>{
                  const insured=coveredIds.has(vehicle.id);
                  const href={pathname:`/customer/vehicles/${vehicle.id}`,query:accountQuery};
                  return <tr key={vehicle.id} className="cursor-pointer transition hover:bg-[#F8FBFF]">
                    <td className="p-0"><Link href={href} className="block px-3 py-1.5 text-center font-medium text-[11px] text-[#526782]">{vehicle.vehicle_no || (vehicle.chassis_no?`New-${vehicle.chassis_no}`:"Unregistered")}</Link></td>
                    <td className="p-0"><Link href={href} className="flex px-3 py-1.5 items-center justify-center gap-2"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#F5F9FE]"><ManufacturerMark make={vehicle.make??""}/></span><span className="min-w-0"><span className="block truncate text-[10px] text-[#7186A0]">{vehicle.model || "—"}</span></span></Link></td>
                    <td className="p-0"><Link href={href} className="block px-3 py-1.5 text-center"><span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${insured?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-600"}`}>{insured?"Insured":"Not insured"}</span></Link></td>
                  </tr>;
                })}
              </tbody>
            </table>
          </div>}
        </section>
      </div>
      <div className="grid gap-3 lg:grid-cols-2">
        <section data-home-reveal className="min-w-0 rounded-xl border border-[#E0E8F3] bg-white p-3">
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[14px] font-black text-[#10284A]"><ShieldCheck className="h-4 w-4 text-[#1672DC]"/>My Policies</h2><Link href={{pathname:"/customer/policies",query:accountQuery}} className="text-[10px] font-bold text-[#176CD4]">View all</Link></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[410px] text-center text-[10px] text-[#526782]"><thead className="bg-[#F1F6FC] text-center text-[#637B9A]"><tr><th className="px-2 py-1.5">Policy Number</th><th className="px-2 py-1.5">Vehicle</th><th className="px-2 py-1.5">Insurer</th><th className="px-2 py-1.5">Status</th></tr></thead><tbody>{latestPolicies.map(policy=><tr key={policy.id} className="border-b border-[#EEF2F8]"><td className="px-2 py-1.5 font-medium text-[#526782]"><Link href={{pathname:`/customer/policies/${policy.id}`,query:{...accountQuery,source:policy.source}}}>{policy.policy_no||"—"}</Link></td><td className="px-2 py-1.5 text-[#526782]">{policy.vehicle_no||"—"}</td><td className="px-2 py-1.5 text-[#526782]">{customerHomeInsurerName(policy.insurer_name)}</td><td className="px-2 py-1.5 text-[#526782]"><span className={`rounded-full px-2 py-1 ${customerPolicyTone(policy.end_date).tone === "expired" ? "bg-[#FEE2E2] text-[#B91C1C]" : "bg-[#EEF5FF] text-[#526782]"}`}>{customerPolicyTone(policy.end_date).tone}</span></td></tr>)}</tbody></table>{latestPolicies.length===0?<p className="p-3 text-xs text-[#7186A0]">No policies found.</p>:null}</div>
        </section>
        <section data-home-reveal className="min-w-0 rounded-xl border border-[#E0E8F3] bg-white p-3">
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[14px] font-black text-[#10284A]"><ClipboardList className="h-4 w-4 text-[#1672DC]"/>My Claims</h2><Link href={{pathname:"/customer/claims",query:accountQuery}} className="text-[10px] font-bold text-[#176CD4]">View all</Link></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[480px] text-center text-[10px] text-[#526782]"><thead className="bg-[#F1F6FC] text-center text-[#637B9A]"><tr><th className="px-2 py-1.5">Claim Number</th><th className="px-2 py-1.5">Vehicle Number</th><th className="px-2 py-1.5">Incident Date</th><th className="px-2 py-1.5">Status</th></tr></thead><tbody>{latestClaims.map(claim=>{ const href={pathname:`/customer/claims/${claim.id}`,query:accountQuery}; return <tr key={claim.id} className="cursor-pointer border-b border-[#EEF2F8] transition hover:bg-[#F8FBFF]">{[claim.claim_no||claim.id.slice(0,8),claim.vehicle_no||"—",claim.accident_at?new Date(claim.accident_at).toLocaleDateString("en-IN",{day:"2-digit",month:"2-digit",year:"numeric"}):"—",claim.current_status||"Submitted"].map((value,index)=><td key={index} className="p-0"><Link href={href} className="block px-2 py-1.5 text-center text-[#526782]">{value}</Link></td>)}</tr>;})}</tbody></table>{latestClaims.length===0?<p className="p-3 text-xs text-[#7186A0]">No claims found.</p>:null}</div>
        </section>
      </div>
    </div>
  );
}
