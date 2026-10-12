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
  const services = [
    { label: "Vehicles", description: "Manage your fleet", href: "/customer/vehicles", icon: CarFront, style: "bg-blue-50 text-blue-700" },
    { label: "Policies", description: "Your insurance records", href: "/customer/policies", icon: ShieldCheck, style: "bg-emerald-50 text-emerald-700" },
    { label: "Exchange", description: "Explore vehicles", href: "/customer/exchange", icon: RefreshCcw, style: "bg-violet-50 text-violet-700" },
    { label: "Get quote", description: "Explore insurance", href: "/customer/insurance-quote", icon: BadgeIndianRupee, style: "bg-amber-50 text-amber-700" },
    { label: "Pay challan", description: "View challan services", href: "/customer/e-challan", icon: ReceiptText, style: "bg-rose-50 text-rose-700" },
  ];
  return (
    <div className="relative space-y-5 pb-6">
      <div aria-hidden="true" className="pointer-events-none absolute -inset-x-4 -top-4 -z-10 h-[430px] bg-[radial-gradient(ellipse_at_25%_10%,rgba(116,187,255,0.20),transparent_62%)]" />
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/home" />

      <section className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(115deg,#071D40_0%,#103C70_65%,#155593_100%)] px-5 py-6 text-white shadow-[0_18px_42px_rgba(14,49,96,0.15)] sm:px-8 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-32 h-80 w-80 rounded-full border-[48px] border-white/5" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-48 right-28 h-80 w-80 rounded-full bg-sky-400/10 blur-3xl" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(265px,0.7fr)] lg:items-center">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#8DDFE6]"><Sparkles className="h-4 w-4" /> My protection hub</p>
            <h1 className="mt-3 text-[clamp(1.75rem,3.3vw,2.8rem)] font-extrabold tracking-[-0.045em]">Welcome, {account.contact_name?.split(" ")[0] || "Customer"}</h1>
            <p className="mt-2 max-w-lg text-sm leading-6 text-[#D3E7FA]">Everything you need to keep your vehicles, policies and claims on track.</p>
            <div className="mt-6 grid max-w-[430px] grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"><p className="text-3xl font-black">{covered}<span className="ml-1 text-lg text-[#A6CAE9]">/ {vehicles.length}</span></p><p className="mt-1 text-xs font-semibold text-[#D6E9FC]">Vehicles covered</p></div>
              <div className="rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-sm"><p className="text-3xl font-black">{coverage}%</p><p className="mt-1 text-xs font-semibold text-[#D6E9FC]">Fleet protection</p></div>
            </div>
          </div>
          <div className="flex flex-col items-center justify-center gap-2">
            <img src="/customer-fleet-banner.svg" alt="Commercial truck and passenger vehicles" className="max-h-[180px] w-full object-contain drop-shadow-lg" />
            <Link href={{ pathname: "/customer/vehicles", query: accountQuery }} className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-xs font-bold text-white transition hover:bg-white/25">View my fleet <ArrowRight className="h-4 w-4" /></Link>
          </div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,0.82fr)]">
        <section aria-labelledby="attention-heading" className="rounded-3xl border border-[#E4EAF4] bg-white p-5 shadow-[0_10px_30px_rgba(18,46,86,0.05)]">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div><p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7890AA]">Action center</p><h2 id="attention-heading" className="mt-1 text-lg font-extrabold text-[#152C4F]">Needs your attention</h2></div>
            {attentionCount > 0 ? <span className="rounded-full bg-[#FFF0EE] px-3 py-1 text-xs font-bold text-[#C63636]">{attentionCount} items</span> : <CheckCircle2 className="h-6 w-6 text-emerald-600" />}
          </div>
          {attentionCount === 0 ? <div className="flex items-center gap-3 rounded-2xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800"><CheckCircle2 className="h-5 w-5 shrink-0" /> Your fleet is up to date. No urgent insurance actions.</div> : (
            <div className="space-y-2">
              {uncoveredVehicles.slice(0, 3).map((vehicle) => (
                <Link key={vehicle.id} href={{ pathname: `/customer/vehicles/${vehicle.id}`, query: accountQuery }} className="flex items-center gap-3 rounded-2xl border border-[#FADEDE] bg-[#FFF6F6] px-3 py-3 transition hover:bg-[#FFEEEE]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFE5E5] text-[#D33A3A]"><AlertTriangle className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#233852]">{vehicle.vehicle_no || (vehicle.chassis_no ? `New-${vehicle.chassis_no}` : "Unregistered vehicle")}</span><span className="block text-xs text-[#AB5252]">No active insurance cover</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#C63838]" />
                </Link>
              ))}
              {duePolicies.slice(0, 2).map((policy) => (
                <Link key={policy.id} href={{ pathname: `/customer/policies/${policy.id}`, query: { ...accountQuery, source: policy.source } }} className="flex items-center gap-3 rounded-2xl border border-[#F5E5C6] bg-[#FFF9ED] px-3 py-3 transition hover:bg-[#FFF1D6]">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#FFEDC7] text-[#B77B10]"><CalendarClock className="h-5 w-5" /></span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold text-[#233852]">{policy.vehicle_no || policy.policy_no || "Policy renewal"}</span><span className="block text-xs text-[#986A22]">Insurance renewal due</span></span><ArrowRight className="h-4 w-4 shrink-0 text-[#B77B10]" />
                </Link>
              ))}
              {attentionCount > 5 ? <p className="px-1 pt-1 text-xs text-[#72829A]">Additional items are available in Vehicles and Renewals.</p> : null}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href={{ pathname: "/customer/vehicles", query: accountQuery }} className="rounded-xl border border-[#D8E3F0] px-3 py-2 text-xs font-bold text-[#285482] hover:bg-[#F5F9FD]">View vehicles</Link>
            {duePolicies.length > 0 ? <Link href={{ pathname: "/customer/renewals", query: accountQuery }} className="rounded-xl border border-[#D8E3F0] px-3 py-2 text-xs font-bold text-[#285482] hover:bg-[#F5F9FD]">View renewals</Link> : null}
          </div>
        </section>

        <section aria-labelledby="next-steps-heading" className="rounded-3xl border border-[#E4EAF4] bg-white p-5 shadow-[0_10px_30px_rgba(18,46,86,0.05)]">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[#7890AA]">What would you like to do?</p>
          <h2 id="next-steps-heading" className="mt-1 text-lg font-extrabold text-[#152C4F]">Your next steps</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <Link href={{ pathname: "/customer/insurance-quote", query: accountQuery }} className="flex items-center gap-3 rounded-2xl bg-[#EAF3FF] p-4 transition hover:bg-[#DDEBFC]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#D2E7FF] text-[#165BB7]"><ShieldCheck className="h-6 w-6" /></span><span className="flex-1"><span className="block text-sm font-extrabold text-[#183B67]">Insure a vehicle</span><span className="text-xs text-[#607D9C]">Request an insurance quote</span></span><ArrowRight className="h-4 w-4 text-[#165BB7]" /></Link>
            <Link href={{ pathname: openClaims.length ? "/customer/claims" : "/customer/start-claim", query: accountQuery }} className="flex items-center gap-3 rounded-2xl bg-[#E9F9F2] p-4 transition hover:bg-[#DAF3E8]"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#CFF1DE] text-[#00885F]">{openClaims.length ? <ClipboardList className="h-6 w-6" /> : <FilePlus2 className="h-6 w-6" />}</span><span className="flex-1"><span className="block text-sm font-extrabold text-[#17644B]">{openClaims.length ? "Track your claim" : "Start a claim"}</span><span className="text-xs text-[#658B7C]">{openClaims.length ? `${openClaims.length} claim${openClaims.length === 1 ? "" : "s"} in progress` : "Get help with a new claim"}</span></span><ArrowRight className="h-4 w-4 text-[#00885F]" /></Link>
          </div>
        </section>
      </div>

      <section aria-labelledby="services-heading" className="rounded-3xl border border-[#E4EAF4] bg-white p-5 shadow-[0_10px_30px_rgba(18,46,86,0.05)]">
        <div className="mb-4 flex items-center justify-between"><h2 id="services-heading" className="text-lg font-extrabold text-[#152C4F]">Everyday services</h2><span className="text-xs text-[#71869F]">Your shortcuts</span></div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {services.map(({ label, description, href, icon: Icon, style }) => (
            <Link key={label} href={{ pathname: href, query: accountQuery }} className="group flex flex-col gap-3 rounded-2xl border border-[#E6EDF6] p-4 transition hover:-translate-y-0.5 hover:border-[#C6D9EE] hover:shadow-md">
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${style}`}><Icon className="h-6 w-6" /></span>
              <span><span className="block text-sm font-bold text-[#1C3556]">{label}</span><span className="mt-1 block text-[11px] text-[#73869D]">{description}</span></span>
              <ArrowRight className="h-4 w-4 text-[#7E9ABB] transition group-hover:translate-x-1" />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(260px,0.45fr)]">
        <section className="overflow-hidden rounded-3xl border border-[#DFE8F4] bg-white shadow-[0_10px_30px_rgba(18,46,86,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-5"><div><h2 className="text-lg font-extrabold text-[#152C4F]">Claims progress</h2><p className="mt-1 text-xs text-[#71869F]">Updates on your existing claims</p></div><Link href={{ pathname: "/customer/claims", query: accountQuery }} className="inline-flex items-center gap-2 text-xs font-bold text-[#2768AF]">View all <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="grid grid-cols-2 gap-3 p-5 pt-3"><div className="rounded-2xl bg-[#EEF5FE] p-4"><p className="text-2xl font-black text-[#153D76]">{openClaims.length}</p><p className="text-xs font-semibold text-[#537699]">In progress</p></div><div className="rounded-2xl bg-[#F1F9F5] p-4"><p className="text-2xl font-black text-[#177456]">{claims.filter((claim) => isCompletedCustomerClaim(claim, milestones_by_claim.get(claim.id) ?? [])).length}</p><p className="text-xs font-semibold text-[#648A7D]">Settled</p></div></div>
          {openClaims.length > 0 ? <Link href={{ pathname: "/customer/claims", query: accountQuery }} className="flex items-center justify-between border-t border-[#E8EEF6] px-5 py-3 text-xs font-semibold text-[#1D4E86] hover:bg-[#F8FBFF]">{openClaims.length} open claim{openClaims.length === 1 ? "" : "s"} — review progress <ArrowRight className="h-4 w-4" /></Link> : <p className="border-t border-[#E8EEF6] px-5 py-3 text-xs text-[#71869F]">No claims in progress.</p>}
        </section>
        <section className="flex flex-col justify-between rounded-3xl bg-[linear-gradient(140deg,#E6F5FB,#F0F7FF)] p-5">
          <div><span className="grid h-11 w-11 place-items-center rounded-xl bg-white text-[#175A9B]"><Headphones className="h-6 w-6" /></span><h2 className="mt-3 text-lg font-extrabold text-[#153453]">Need help?</h2><p className="mt-1 text-sm leading-6 text-[#647E96]">Get assistance with your policy, claim or customer account.</p></div>
          <Link href={{ pathname: "/customer/support", query: accountQuery }} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-[#163F71] px-4 py-3 text-xs font-bold text-white transition hover:bg-[#0E2F59]">Open Support <ArrowRight className="h-4 w-4" /></Link>
        </section>
      </div>
    </div>
  );
}
