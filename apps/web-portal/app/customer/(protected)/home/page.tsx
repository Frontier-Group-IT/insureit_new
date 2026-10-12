import Link from "next/link";
import { AlertTriangle, ArrowRight, BadgeIndianRupee, CalendarClock, CarFront, CheckCircle2, ClipboardList, FilePlus2, Headphones, Plus, ReceiptText, RefreshCcw, ShieldCheck, Sparkles } from "lucide-react";
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
  const currentPolicies = policies.filter((policy) => customerPolicyTone(policy.end_date).tone !== "expired");
  const coveredIds = new Set(currentPolicies.map((policy) => policy.vehicle_id).filter(Boolean));
  const uncoveredVehicles = vehicles.filter((vehicle) => !coveredIds.has(vehicle.id));
  const covered = vehicles.length - uncoveredVehicles.length;
  const coverage = vehicles.length ? Math.round((covered / vehicles.length) * 100) : 0;
  const duePolicies = policies.filter((policy) => customerPolicyTone(policy.end_date).tone === "due");
  const openClaims = claims.filter((claim) => !isCompletedCustomerClaim(claim, milestones_by_claim.get(claim.id) ?? []) && claim.current_status !== "Rejected");
  const attentionCount = uncoveredVehicles.length + duePolicies.length;
  const accountQuery = { account: account.id };
  const vehicleArtwork = (make: string, model: string, type: string) => {
    const identity = `${make} ${model} ${type}`.toLowerCase();
    if (/jcb|backhoe|excavator|loader|3dx/.test(identity)) return "/customer-quote-backhoe.svg";
    if (/truck|tata|lpt|tipper|goods|commercial|ashok leyland|bharatbenz/.test(identity)) return "/customer-quote-truck.svg";
    if (/bike|scooter|two.wheel|motorcycle|access|weGo|tvs|honda activa|hero/.test(identity)) return null;
    return "/customer-quote-suv.svg";
  };
  const latestPolicies = policies.slice(0, 4);
  const latestClaims = claims.slice(0, 4);
  return (
    <div className="space-y-3 pb-6">
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/home" />
      <section className="relative isolate overflow-hidden rounded-2xl bg-[linear-gradient(110deg,#071C3E_0%,#103E78_58%,#3288D6_100%)] p-4 text-white shadow-[0_12px_32px_rgba(18,46,86,.12)] sm:p-5">
        <div className="pointer-events-none absolute inset-y-0 right-0 w-[55%] bg-[radial-gradient(ellipse_at_75%_35%,rgba(150,214,255,.52),transparent_70%)]" />
        <div className="relative grid items-center gap-4 md:grid-cols-[1fr_0.95fr]">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.2em] text-[#B2D7FC]"><Sparkles className="h-4 w-4" /> My protection hub</p>
            <h1 className="mt-1 text-[clamp(25px,3vw,37px)] font-black tracking-tight">Welcome back, {account.contact_name?.split(" ")[0] || "Customer"}!</h1>
            <p className="mt-1 text-[12px] text-[#D9E8FA]">Keep your vehicles, policies and claims organized in one place.</p>
            <div className="mt-4 grid max-w-[420px] grid-cols-2 gap-2">
              <Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-3 hover:bg-white/20"><CarFront className="h-7 w-7 text-[#8BC9FF]"/><span><strong className="block text-lg">{covered} / {vehicles.length}</strong><small className="text-[10px] text-[#D6E6F9]">Vehicles covered</small></span><ArrowRight className="ml-auto h-3.5 w-3.5"/></Link>
              <Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="flex items-center gap-3 rounded-xl border border-white/15 bg-white/10 p-3 hover:bg-white/20"><ShieldCheck className="h-7 w-7 text-[#8CE6C2]"/><span><strong className="block text-lg">{coverage}%</strong><small className="text-[10px] text-[#D6E6F9]">Fleet protection</small></span><ArrowRight className="ml-auto h-3.5 w-3.5"/></Link>
            </div>
          </div>
          <div className="relative flex min-h-[155px] flex-col items-center justify-center">
            <img src="/customer-fleet-banner.svg" alt="Illustrated fleet of vehicles" className="h-[145px] w-full object-contain drop-shadow-lg" />
            <Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="mt-1 inline-flex items-center gap-2 rounded-full bg-[#1663AF] px-4 py-2 text-[11px] font-bold hover:bg-[#0F5092]">View My Fleet <ArrowRight className="h-4 w-4"/></Link>
          </div>
        </div>
      </section>
      <nav aria-label="Quick actions" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {[
          {title:"Insure a Vehicle",desc:"Get an insurance quote",href:"/customer/insurance-quote",icon:ShieldCheck,background:"bg-[#EAF3FF]",color:"text-[#176CD4]"},
          {title:"Start New Claim",desc:"Report an incident",href:"/customer/start-claim",icon:FilePlus2,background:"bg-[#E9F9F1]",color:"text-[#07865F]"},
          {title:"Track Existing Claims",desc:`${openClaims.length} claim${openClaims.length===1?"":"s"} in progress`,href:"/customer/claims",icon:ClipboardList,background:"bg-[#FFF4E8]",color:"text-[#C46A13]"},
          {title:"View My Vehicles",desc:"Manage your fleet",href:"/customer/vehicles",icon:CarFront,background:"bg-[#F2EDFF]",color:"text-[#7444CE]"},
        ].map(({title,desc,href,icon:Icon,background,color})=><Link key={href} href={{pathname:href,query:accountQuery}} className="flex min-w-0 items-center gap-2 rounded-xl border border-[#E3EAF3] bg-white p-3 shadow-sm transition hover:border-[#BBD2EC] hover:shadow-md"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${background} ${color}`}><Icon className="h-5 w-5"/></span><span className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-[#10284A]">{title}</strong><small className="block truncate text-[10px] text-[#7186A0]">{desc}</small></span><ArrowRight className={`h-4 w-4 shrink-0 ${color}`}/></Link>)}
      </nav>
      <div className="grid gap-3 lg:grid-cols-[.95fr_1.15fr]">
        <section className="rounded-xl border border-[#E0E8F3] bg-white p-3">
          <div className="mb-3 flex items-center justify-between gap-2"><h2 className="flex items-center gap-2 text-[14px] font-black text-[#10284A]"><AlertTriangle className="h-4 w-4 text-red-500"/>Needs your attention</h2><Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="text-[10px] font-bold text-[#176CD4]">View all →</Link></div>
          <div className="space-y-2">
            {uncoveredVehicles.slice(0,2).map(vehicle=><Link key={vehicle.id} href={{pathname:`/customer/vehicles/${vehicle.id}`,query:accountQuery}} className="flex items-center gap-3 rounded-xl border border-[#FFE0E0] bg-[#FFF3F3] p-3 hover:bg-[#FFEAEA]"><AlertTriangle className="h-5 w-5 shrink-0 text-red-500"/><span className="min-w-0 flex-1"><strong className="block truncate text-[11px] text-[#142C4D]">{vehicle.vehicle_no || (vehicle.chassis_no ? `New-${vehicle.chassis_no}` : "Unregistered vehicle")}</strong><small className="text-[10px] text-red-500">No active insurance cover</small></span><ArrowRight className="h-4 w-4 text-red-500"/></Link>)}
            {duePolicies.slice(0,2).map(policy=><Link key={policy.id} href={{pathname:`/customer/policies/${policy.id}`,query:{...accountQuery,source:policy.source}}} className="flex items-center gap-3 rounded-xl bg-amber-50 p-3"><CalendarClock className="h-5 w-5 text-amber-600"/><span className="min-w-0 flex-1"><strong className="block truncate text-[11px]">{policy.policy_no || "Renewal due"}</strong><small className="text-[10px] text-amber-700">Renewal due</small></span><ArrowRight className="h-4 w-4"/></Link>)}
            {attentionCount===0?<p className="rounded-lg bg-emerald-50 p-3 text-xs text-emerald-700">No urgent insurance actions.</p>:null}
          </div>
        </section>
        <section className="min-w-0 rounded-xl border border-[#E0E8F3] bg-white p-3">
          <div className="mb-3 flex items-center justify-between"><h2 className="flex items-center gap-2 text-[14px] font-black text-[#10284A]"><CarFront className="h-4 w-4 text-[#1672DC]"/>My Vehicles</h2><Link href={{pathname:"/customer/vehicles",query:accountQuery}} className="text-[10px] font-bold text-[#176CD4]">View all →</Link></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {vehicles.slice(0,3).map(vehicle=>{
              const art=vehicleArtwork(vehicle.make??"",vehicle.model??"",vehicle.vehicle_type??"");
              const insured=coveredIds.has(vehicle.id);
              return <Link key={vehicle.id} href={{pathname:`/customer/vehicles/${vehicle.id}`,query:accountQuery}} className="min-w-0 overflow-hidden rounded-xl border border-[#E2EAF4] bg-white p-2 hover:border-[#9CC5EF]">
                <div className="flex h-[78px] items-center justify-center rounded-lg bg-[#F5F9FE]">{art?<img src={art} alt={`${vehicle.make??""} ${vehicle.model??""} vehicle illustration`} className="h-full w-full object-contain"/>:<CarFront className="h-10 w-10 text-[#9CB5D0]" aria-label="Vehicle illustration unavailable"/>}</div>
                <strong className="mt-2 block truncate text-[11px] text-[#15345E]">{vehicle.vehicle_no || (vehicle.chassis_no?`New-${vehicle.chassis_no}`:"Unregistered")}</strong>
                <p className="truncate text-[10px] text-[#69809B]">{[vehicle.make,vehicle.model].filter(Boolean).join(" ")||"Vehicle"}</p>
                <span className={`mt-2 inline-block rounded-full px-2 py-1 text-[9px] font-bold ${insured?"bg-emerald-50 text-emerald-700":"bg-red-50 text-red-600"}`}>{insured?"Insured":"Not insured"}</span>
              </Link>;
            })}
            {vehicles.length===0?<p className="text-xs text-[#7186A0]">No vehicles found.</p>:null}
          </div>
        </section>
      </div>
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
