import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CarFront, ClipboardCheck, ClipboardList, FilePlus2, Headphones, ShieldPlus, ShieldCheck, FileText, RefreshCcw, ChevronRight } from "lucide-react";
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
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/home" />
      <section className="relative isolate overflow-hidden rounded-[22px] bg-[linear-gradient(112deg,#071B3B_0%,#103B73_65%,#2584CF_100%)] p-5 text-white shadow-[0_14px_36px_rgba(17,54,104,.16)] sm:p-7">
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#76C8FF]/20 blur-3xl"/>
        <div className="relative space-y-4">
          <h1 className="text-[clamp(27px,3vw,39px)] font-extrabold tracking-tight">Welcome back, {account.contact_name?.split(" ")[0] || "Customer"}!</h1>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="group inline-flex flex-col gap-0.5 hover:opacity-85">
              <strong className="text-2xl font-extrabold leading-tight">{covered} / {vehicles.length}</strong>
              <span className="text-[11px] text-[#D9EAFD]">Vehicles covered</span>
            </Link>
            <div aria-hidden="true" className="h-9 w-px bg-white/30"/>
            <Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="group inline-flex flex-col gap-0.5 hover:opacity-85">
              <strong className="text-2xl font-extrabold leading-tight">{coverage}%</strong>
              <span className="text-[11px] text-[#D9EAFD]">Fleet protection</span>
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={{pathname:"/customer/insurance-quote",query:accountQuery}} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-bold text-[#104B88] shadow-sm transition hover:bg-[#E8F4FF]">Get insurance quote <ArrowRight className="h-4 w-4"/></Link>
            <Link href={{pathname:"/customer/renewals",query:accountQuery}} className="inline-flex items-center gap-2 rounded-xl border border-white/35 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20">Renew a policy <RefreshCcw className="h-4 w-4"/></Link>
          </div>
        </div>
      </section>
      <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          {title:"Insure a Vehicle",desc:"Get an insurance quote",href:"/customer/insurance-quote",icon:ShieldPlus,background:"bg-[#EAF3FF]",color:"text-[#176CD4]"},
          {title:"Start New Claim",desc:"Report an incident",href:"/customer/start-claim",icon:FilePlus2,background:"bg-[#E9F9F1]",color:"text-[#07865F]"},
          {title:"Track Existing Claims",desc:`${openClaims.length} claim${openClaims.length===1?"":"s"} in progress`,href:"/customer/claims",icon:ClipboardCheck,background:"bg-[#FFF4E8]",color:"text-[#C46A13]"},
          {title:"View My Vehicles",desc:"Manage your fleet",href:"/customer/vehicles",icon:CarFront,background:"bg-[#F2EDFF]",color:"text-[#7444CE]"},
        ].map(({title,desc,href,icon:Icon,background,color})=><Link key={href} href={href === "/customer/start-claim" ? { pathname: "/customer/start-claim", query: accountQuery } : href === "/customer/claims" ? { pathname: "/customer/claims", query: accountQuery } : { pathname: href, query: accountQuery }} className="flex min-w-0 items-center gap-2 rounded-xl border border-[#E3EAF3] bg-white p-3 shadow-sm transition hover:border-[#BBD2EC] hover:shadow-md"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${background} ${color}`}><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-[#10284A]">{title}</strong><small className="block truncate text-[10px] text-[#7186A0]">{desc}</small></span><ArrowRight className={`h-4 w-4 shrink-0 ${color}`}/></Link>)}
      </nav>
      <div className="grid gap-4 lg:grid-cols-[.8fr_1.2fr]">
        <section className="rounded-2xl border border-[#E0E8F3] bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-[14px] font-black text-[#10284A]"><AlertTriangle className="h-4 w-4 text-red-500"/>Needs your attention</h2><Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="text-[10px] font-bold text-[#176CD4]">View all →</Link></div>
          <div className="space-y-2">
            {uncoveredVehicles.slice(0, 3).map(vehicle=><Link key={vehicle.id} href={{pathname:`/customer/vehicles/${vehicle.id}`,query:accountQuery}} className="flex items-center gap-3 rounded-xl border border-[#F3D8D8] bg-white p-3 hover:bg-[#FFF9F7]"><AlertTriangle className="h-5 w-5 shrink-0 text-red-500"/><span className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-[#142C4D]">{vehicle.vehicle_no || (vehicle.chassis_no ? `New-${vehicle.chassis_no}` : "Unregistered vehicle")}</strong><small className="text-[10px] font-medium text-[#C65A28]">No active insurance cover</small></span><ArrowRight className="h-4 w-4 text-red-500"/></Link>)}
            {duePolicies.slice(0, 2).map(policy=><Link key={policy.id} href={{pathname:`/customer/policies/${policy.id}`,query:{...accountQuery,source:policy.source}}} className="flex items-center gap-3 rounded-xl border border-[#F2DFBF] bg-white p-3 hover:bg-[#FFFCF6]"><CalendarClock className="h-5 w-5 text-amber-600"/><span className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{policy.policy_no || "Renewal due"}</strong><small className="text-[10px] text-amber-700">Renewal due</small></span><ArrowRight className="h-4 w-4"/></Link>)}
            {attentionCount === 0?<p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">No urgent insurance actions.</p>:null}
          </div>
        </section>
        <section className="min-w-0 rounded-2xl border border-[#E0E8F3] bg-white p-4">
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[14px] font-black text-[#10284A]"><CarFront className="h-4 w-4 text-[#1672DC]"/>My Vehicles</h2><Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="text-[10px] font-bold text-[#176CD4]">View all →</Link></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {vehicles.slice(0,3).map(vehicle=>{
              const insured=coveredIds.has(vehicle.id);
              return <Link key={vehicle.id} href={{pathname:`/customer/vehicles/${vehicle.id}`,query:accountQuery}} className="min-w-0 overflow-hidden rounded-xl border border-[#E2EAF4] bg-white p-2 hover:border-[#9CC5EF]">
                <div className="flex min-h-[60px] items-center gap-2.5">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F5F9FE]"><ManufacturerMark make={vehicle.make??""}/></span>
                  <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5"><strong className="min-w-0 truncate text-[11px] text-[#15345E]">{vehicle.vehicle_no || (vehicle.chassis_no?`New-${vehicle.chassis_no}`:"Unregistered")}</strong><span className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-bold ${insured?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-600"}`}>{insured?"Insured":"Not insured"}</span></span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#90A4BC]"/>
                </div>
              </Link>;
            })}
            {vehicles.length===0?<p className="text-xs text-[#7186A0]">No vehicles found.</p>:null}
          </div>
        </section>
      </div>
      <section className="grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-[#E0E8F3] bg-white p-4">
          <h2 className="mb-2 text-sm font-bold text-[#10284A]">Your next steps</h2>
          <div className="flex flex-wrap gap-2">
            <Link href={{pathname:"/customer/insurance-quote",query:accountQuery}} className="rounded-lg bg-[#EDF5FF] px-3 py-2 text-xs font-semibold text-[#155B9F]">Get a quote</Link>
            <Link href={{pathname:"/customer/renewals",query:accountQuery}} className="rounded-lg bg-[#EDF5FF] px-3 py-2 text-xs font-semibold text-[#155B9F]">Renew policies</Link>
          </div>
        </div>
        <div className="rounded-2xl border border-[#E0E8F3] bg-white p-4">
          <h2 className="mb-2 text-sm font-bold text-[#10284A]">Everyday services</h2>
          <div className="flex flex-wrap gap-2">
            <Link href={{pathname:"/customer/exchange",query:accountQuery}} className="rounded-lg bg-[#F1F6FC] px-3 py-2 text-xs font-semibold text-[#155B9F]">Vehicle exchange</Link>
            <Link href={{pathname:"/customer/support",query:accountQuery}} className="rounded-lg bg-[#F1F6FC] px-3 py-2 text-xs font-semibold text-[#155B9F]">Get support</Link>
          </div>
        </div>
        <div className="rounded-2xl border border-[#E0E8F3] bg-white p-4">
          <h2 className="mb-2 text-sm font-bold text-[#10284A]">Claims progress</h2>
          <Link href={{pathname:"/customer/claims",query:accountQuery}} className="flex items-center justify-between text-xs text-[#155B9F]"><span>{openClaims.length} open claim{openClaims.length===1?"":"s"} · {claims.length} total</span><ArrowRight className="h-4 w-4"/></Link>
        </div>
      </section>
      <section className="rounded-2xl border border-[#E1EAF5] bg-white p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div><h2 className="text-[16px] font-extrabold text-[#10284A]">Explore insurance & services</h2><p className="mt-1 text-[11px] text-[#7186A0]">Everything you need to stay protected, in one place.</p></div>
          <Link href={{pathname:"/customer/support",query:accountQuery}} className="inline-flex items-center gap-1 text-[11px] font-bold text-[#176CD4]">Need help? <ArrowRight className="h-3.5 w-3.5"/></Link>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            {title:"Motor insurance",description:"Request a new quote",href:"/customer/insurance-quote",icon:CarFront,color:"text-[#1B70D0]",background:"bg-[#EAF3FF]"},
            {title:"Policy renewal",description:"Review upcoming renewals",href:"/customer/renewals",icon:RefreshCcw,color:"text-[#16856B]",background:"bg-[#E7F8F1]"},
            {title:"My policy documents",description:"Access your policies",href:"/customer/policies",icon:FileText,color:"text-[#8C5BD7]",background:"bg-[#F3EDFF]"},
            {title:"Vehicle services",description:"Exchange and other services",href:"/customer/exchange",icon:CarFront,color:"text-[#C77823]",background:"bg-[#FFF3E5]"},
          ].map(({title,description,href,icon:Icon,color,background})=><Link key={href} href={{pathname:href,query:accountQuery}} className="group flex min-w-0 flex-col gap-3 rounded-xl border border-[#E6EDF6] bg-[#FCFDFF] p-3.5 transition hover:-translate-y-0.5 hover:border-[#AAC9EF] hover:bg-white hover:shadow-md"><span className={`grid h-11 w-11 place-items-center rounded-xl ${background} ${color}`}><Icon className="h-5 w-5"/></span><span className="min-w-0"><strong className="block text-xs text-[#142C4D]">{title}</strong><small className="mt-1 block text-[10px] text-[#7186A0]">{description}</small></span><ChevronRight className={`ml-auto h-4 w-4 ${color} transition group-hover:translate-x-0.5`}/></Link>)}
        </div>
      </section>
      <div className="grid gap-3 lg:grid-cols-2">
        <section className="min-w-0 rounded-xl border border-[#E0E8F3] bg-white p-3">
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[14px] font-black text-[#10284A]"><ShieldCheck className="h-4 w-4 text-[#1672DC]"/>My Policies</h2><Link href={{pathname:"/customer/policies",query:accountQuery}} className="text-[10px] font-bold text-[#176CD4]">View all →</Link></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[410px] text-left text-[10px]"><thead className="bg-[#F1F6FC] text-[#637B9A]"><tr><th className="p-2">Policy Number</th><th className="p-2">Vehicle</th><th className="p-2">Insurer</th><th className="p-2">Status</th></tr></thead><tbody>{latestPolicies.map(policy=><tr key={policy.id} className="border-b border-[#EEF2F8]"><td className="p-2 font-bold"><Link href={{pathname:`/customer/policies/${policy.id}`,query:{...accountQuery,source:policy.source}}}>{policy.policy_no||"—"}</Link></td><td className="p-2">{policy.vehicle_no||"—"}</td><td className="p-2">{policy.insurer_name||"—"}</td><td className="p-2"><span className="rounded-full bg-[#EEF5FF] px-2 py-1">{customerPolicyTone(policy.end_date).tone}</span></td></tr>)}</tbody></table>{latestPolicies.length===0?<p className="p-3 text-xs text-[#7186A0]">No policies found.</p>:null}</div>
        </section>
        <section className="min-w-0 rounded-xl border border-[#E0E8F3] bg-white p-3">
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[14px] font-black text-[#10284A]"><ClipboardList className="h-4 w-4 text-[#1672DC]"/>My Claims</h2><Link href={{pathname:"/customer/claims",query:accountQuery}} className="text-[10px] font-bold text-[#176CD4]">View all →</Link></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[340px] text-left text-[10px]"><thead className="bg-[#F1F6FC] text-[#637B9A]"><tr><th className="p-2">Claim Number</th><th className="p-2">Status</th><th className="p-2">Action</th></tr></thead><tbody>{latestClaims.map(claim=><tr key={claim.id} className="border-b border-[#EEF2F8]"><td className="p-2 font-bold">{claim.claim_no||claim.id.slice(0,8)}</td><td className="p-2">{claim.current_status||"Submitted"}</td><td className="p-2"><Link href={{pathname:"/customer/claims",query:accountQuery}} className="font-bold text-[#176CD4]">View →</Link></td></tr>)}</tbody></table>{latestClaims.length===0?<p className="p-3 text-xs text-[#7186A0]">No claims found.</p>:null}</div>
        </section>
      </div>
    </div>
  );
}
