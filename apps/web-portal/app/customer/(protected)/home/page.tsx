import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarClock, CarFront, ClipboardCheck, ClipboardList, FilePlus2, Headphones, ShieldPlus, ShieldCheck, FileText, RefreshCcw, ChevronRight, HeartPulse, Umbrella, Bike, Plane, Truck, HardHat, Boxes, Sparkles } from "lucide-react";
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
      <section className="relative isolate overflow-hidden rounded-2xl border border-[#DDEBFA] bg-[linear-gradient(100deg,#F1F8FF_0%,#E8F4FF_55%,#D3EBFF_100%)] px-4 pb-4 pt-4 sm:px-6 sm:pt-5">
        <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[57%] bg-[url('/customer-fleet-banner.svg')] bg-contain bg-right-bottom bg-no-repeat opacity-95 md:block"/>
        <div className="relative z-10 max-w-[750px]">
          <p className="text-[9px] font-extrabold uppercase tracking-[.26em] text-[#236EE6]">MY PROTECTION HUB</p>
          <h1 className="mt-1 text-[clamp(26px,3.2vw,42px)] font-black leading-tight tracking-tight text-[#0A1C3D]">Drive with complete <span className="text-[#1266E9]">peace of mind</span></h1>
          <p className="mt-1 text-[11px] text-[#45617E]">Insure your commercial vehicles, manage policies, track claims and get instant support — all in one place.</p>
          <div className="mt-4 grid max-w-[365px] grid-cols-2 gap-2">
            <Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="flex items-center gap-2 rounded-xl border border-white bg-white/90 p-2.5 shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#DFEDFF]"><CarFront className="h-5 w-5 text-[#1368E8]"/></span><span><strong className="block text-base font-black text-[#10244D]">{covered} / {vehicles.length}</strong><small className="block text-[9px] text-[#58708B]">Vehicles covered</small></span><ArrowRight className="ml-auto h-4 w-4 text-[#2264CF]"/></Link>
            <Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="flex items-center gap-2 rounded-xl border border-white bg-white/90 p-2.5 shadow-sm"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#DDF9ED]"><ShieldCheck className="h-5 w-5 text-[#079765]"/></span><span><strong className="block text-base font-black text-[#10244D]">{coverage}%</strong><small className="block text-[9px] text-[#58708B]">Fleet protection</small></span><ArrowRight className="ml-auto h-4 w-4 text-[#2264CF]"/></Link>
          </div>
        </div>
      </section>
      <nav aria-label="Insurance categories" className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[
          {title:"Vehicle Insurance",description:"Get the best coverage for your car, bike or fleet.",tag:"Get a quote",href:"/customer/insurance-quote",icon:CarFront,accent:"text-[#1268E9]",tint:"bg-[#EAF3FF]",art:"🚙"},
          {title:"Health Insurance",description:"Explore protection for you and your family.",tag:"Explore plans",href:"/customer/support",icon:HeartPulse,accent:"text-[#F14478]",tint:"bg-[#FFF0F5]",art:"👨‍👩‍👧"},
          {title:"Term Life Insurance",description:"Help secure your family's future.",tag:"Enquire now",href:"/customer/support",icon:Umbrella,accent:"text-[#089F72]",tint:"bg-[#E8FAF1]",art:"👨‍👩‍👦"},
          {title:"Two Wheeler Insurance",description:"Quick coverage enquiries for your bike.",tag:"Get a quote",href:"/customer/insurance-quote",icon:Bike,accent:"text-[#7A3EF0]",tint:"bg-[#F2ECFF]",art:"🏍️"},
          {title:"Travel Insurance",description:"Ask about cover for your next journey.",tag:"Enquire now",href:"/customer/support",icon:Plane,accent:"text-[#F27B25]",tint:"bg-[#FFF0E5]",art:"✈️"},
          {title:"Commercial Vehicle",description:"Insurance solutions for your business fleet.",tag:"Customized plans",href:"/customer/insurance-quote",icon:Truck,accent:"text-[#136DE8]",tint:"bg-[#E8F3FF]",art:"🚚"},
          {title:"Earthmoving & Machinery",description:"Specialized cover for heavy equipment.",tag:"Tailored coverage",href:"/customer/support",icon:HardHat,accent:"text-[#E99412]",tint:"bg-[#FFF5DF]",art:"🚜"},
          {title:"Other Insurance",description:"Explore more insurance solutions.",tag:"View options",href:"/customer/support",icon:Boxes,accent:"text-[#7546EA]",tint:"bg-[#F2ECFF]",art:"🛡️"},
        ].map(({title,description,tag,href,icon:Icon,accent,tint,art})=><Link key={title} href={{pathname:href,query:accountQuery}} className="group relative flex min-h-[148px] flex-col overflow-hidden rounded-xl border border-[#E3EAF5] bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-[#B8D2F5] hover:shadow-md sm:min-h-[165px]">
          <span className={`absolute -bottom-12 -right-12 h-36 w-36 rounded-full ${tint}`}/>
          <span aria-hidden="true" className="pointer-events-none absolute bottom-1 right-2 text-[54px] leading-none opacity-90 drop-shadow-sm sm:text-[68px]">{art}</span>
          <span className="relative z-10 flex items-start gap-2"><span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${tint} ${accent}`}><Icon className="h-5 w-5"/></span><span className="min-w-0"><strong className="block text-[11px] font-extrabold leading-snug text-[#132548]">{title}</strong><small className="mt-0.5 block max-w-[155px] text-[9px] leading-snug text-[#667D99]">{description}</small></span></span>
          <span className={`relative z-10 mt-3 w-fit rounded-full ${tint} px-2 py-1 text-[9px] font-semibold ${accent}`}>{tag}</span>
          <span className="relative z-10 mt-auto grid h-7 w-7 place-items-center rounded-full border border-[#DCE6F4] bg-white text-[#2158B2]"><ArrowRight className="h-3.5 w-3.5"/></span>
        </Link>)}
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
      <nav aria-label="Additional customer actions" className="sr-only">
        <Link href={{pathname:"/customer/start-claim",query:accountQuery}}>Start New Claim</Link>
        <Link href={{pathname:"/customer/claims",query:accountQuery}}>Track Existing Claims</Link>
      </nav>
    </div>
  );
}
