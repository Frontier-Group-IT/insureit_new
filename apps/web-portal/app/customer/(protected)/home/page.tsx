import Link from "next/link";
import { AlertCircle, ArrowRight, BadgeIndianRupee, BellRing, CalendarClock, CarFront, CheckCircle2, ClipboardList, FilePlus2, Headphones, MessageCircle, PhoneCall, ReceiptText, RefreshCcw, ShieldCheck, Truck } from "lucide-react";
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
    { label: "Fleet covered", value: `${coverage}%`, icon: CheckCircle2, info: `${covered} of ${vehicles.length} vehicles` },
    { label: "Uncovered vehicles", value: uncovered, icon: AlertCircle, info: "Without active cover" },
  ];

  const actions = [
    { label: "Renewal", href: "/customer/renewals", icon: CalendarClock },
    { label: "Start claim", href: "/customer/claims", icon: FilePlus2 },
    { label: "Exchange", href: "/customer/exchange", icon: RefreshCcw },
    { label: "Get quote", href: "/customer/insurance-quote", icon: BadgeIndianRupee },
    { label: "Pay challan", href: "/customer/e-challan", icon: ReceiptText },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[24px] font-black tracking-tight text-[#10213D]">Welcome, {account.contact_name?.split(" ")[0] || "Customer"}</h1>
        <p className="mt-1 flex items-center gap-2 text-[11px] font-bold text-[#66768F]"><BellRing className="h-3.5 w-3.5 text-[#D49A32]" /> {uncovered + due} fleet items need attention</p>
      </div>
      <CustomerAccountTabs accounts={accounts} selectedId={account.id} pathname="/customer/home" />

      <section className="overflow-hidden rounded-[22px] border border-[#D9E3F0] bg-white shadow-[0_4px_18px_rgba(21,47,81,0.07)]">
        <div className="p-5">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#61728B]">Your Fleet Summary</p>
          <div className="mt-3 grid grid-cols-[1fr_1.25fr_1fr] items-center gap-2 sm:grid-cols-[1fr_1.6fr_1fr]">
            <div className="text-center"><p className="text-4xl font-black text-[#112A52] sm:text-5xl">{vehicles.length}</p><p className="mt-1 text-[10px] font-black uppercase text-[#758198]">Vehicles</p></div>
            <div aria-label="Car, commercial truck and fleet" className="relative flex h-32 items-end justify-center gap-0 overflow-hidden rounded-2xl bg-gradient-to-t from-[#EEF5FD] via-[#F6FAFF] to-white text-[#2364B0]">
              <CarFront className="mb-4 h-12 w-12 shrink-0 -rotate-6 drop-shadow-md sm:h-16 sm:w-16" />
              <Truck className="mb-3 h-20 w-20 shrink-0 drop-shadow-md sm:h-24 sm:w-24" strokeWidth={1.3} />
              <CarFront className="mb-4 h-10 w-10 shrink-0 rotate-6 drop-shadow-md sm:h-14 sm:w-14" />
            </div>
            <div className="flex justify-center">
              <div className="grid h-[90px] w-[90px] place-items-center rounded-full p-2 sm:h-28 sm:w-28" style={{ background: `conic-gradient(#1754A5 ${coverage}%, #E7EEF8 ${coverage}% 100%)` }}>
                <div className="grid h-full w-full place-content-center rounded-full bg-white text-center">
                  <p className="text-xl font-black text-[#112A52] sm:text-2xl">{coverage}%</p>
                  <p className="text-[10px] font-bold text-[#66758D]">Covered</p>
                </div>
              </div>
            </div>
          </div>
        </div>
        <Link href={{ pathname: "/customer/vehicles", query: accountQuery }} className="flex items-center justify-between gap-3 border-t border-[#E3EAF3] px-5 py-3 text-[12px] font-bold text-[#173A66] hover:bg-[#F7FAFE]">
          <span className="flex items-center gap-2"><AlertCircle className={`h-5 w-5 ${uncovered ? "text-red-500" : "text-emerald-600"}`} /> {uncovered ? `${uncovered} vehicle${uncovered === 1 ? "" : "s"} without active policy` : "All linked vehicles have active cover"}</span>
          <ArrowRight className="h-4 w-4 shrink-0" />
        </Link>
      </section>

      <section aria-label="Fleet key metrics" className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {kpis.map(({ label, value, icon: Icon, info }) => (
          <div key={label} className="rounded-2xl border border-[#DCE5F0] bg-white p-4 shadow-[0_3px_12px_rgba(21,47,81,0.04)]">
            <div className="flex items-center justify-between gap-2"><p className="text-[10px] font-black uppercase tracking-wide text-[#75839B]">{label}</p><Icon className="h-4 w-4 text-[#245DAD]" /></div>
            <p className="mt-2 text-3xl font-black text-[#112A52]">{value}</p><p className="mt-1 text-[10px] font-medium text-[#7B879A]">{info}</p>
          </div>
        ))}
      </section>

      <section className="rounded-[22px] border border-[#D9E3F0] bg-white p-4 shadow-[0_4px_18px_rgba(21,47,81,0.06)]">
        <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black uppercase text-[#61728B]">Quick Actions</h2><span className="text-[11px] font-semibold text-[#7A8799]">One tap services</span></div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {actions.map(({ label, href, icon: Icon }) => <Link key={label} href={{ pathname: href, query: accountQuery }} className="flex min-h-24 flex-col items-center justify-center gap-2 rounded-2xl border border-[#E0E8F2] bg-[#F9FBFE] p-2 text-center text-[11px] font-bold text-[#112A52] transition hover:bg-[#EFF5FF]"><span className="grid h-11 w-11 place-items-center rounded-xl bg-[#EAF2FF] text-[#1958AC]"><Icon className="h-5 w-5" /></span>{label}</Link>)}
        </div>
      </section>

      <section className="overflow-hidden rounded-[22px] border border-[#D9E3F0] bg-white shadow-[0_4px_18px_rgba(21,47,81,0.06)]">
        <div className="bg-[#071E49] p-5 text-white">
          <div className="flex items-center justify-between"><h2 className="text-xl font-black">Claims</h2><Link href={{ pathname: "/customer/claims", query: accountQuery }} className="flex items-center gap-1 text-xs font-bold text-[#D4E1F8] hover:text-white">View all <ArrowRight className="h-4 w-4" /></Link></div>
          <div className="mt-6 grid grid-cols-3 divide-x divide-white/15 text-center">
            <div><p className="text-3xl font-black text-[#A7C8FF]">{claims.length}</p><p className="mt-1 text-[11px] font-bold">Total</p></div>
            <div><p className="text-3xl font-black text-[#F3C365]">{open}</p><p className="mt-1 text-[11px] font-bold">Open</p></div>
            <div><p className="text-3xl font-black text-[#62D9B5]">{settled}</p><p className="mt-1 text-[11px] font-bold">Settled</p></div>
          </div>
        </div>
        <Link href={{ pathname: "/customer/claims", query: accountQuery }} className="flex items-center justify-between gap-2 px-5 py-4 text-[12px] font-bold text-[#183256] hover:bg-[#F7FAFE]"><span className="flex items-center gap-2"><ClipboardList className="h-4 w-4 text-emerald-600" />{claims.length ? `${open} claim${open === 1 ? "" : "s"} in progress` : "No claims yet"}</span><ArrowRight className="h-4 w-4" /></Link>
      </section>

      <section className="rounded-[22px] border border-[#E2EAF4] bg-[#F0F7FF] p-5">
        <h2 className="text-[16px] font-black text-[#10213D]">Insureit Support <span className="ml-1 text-[11px] font-semibold text-[#72829B]">| we are here when it matters</span></h2>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { label: "Call", icon: PhoneCall, color: "bg-[#079C79]" },
            { label: "WhatsApp", icon: MessageCircle, color: "bg-[#079C79]" },
            { label: "Ticket", icon: Headphones, color: "bg-[#205AAE]" },
          ].map(({ label, icon: Icon, color }) => <Link key={label} href={{ pathname: "/customer/support", query: accountQuery }} title={`Open Support for ${label.toLowerCase()} assistance`} className="flex flex-col items-center gap-2 rounded-xl px-2 py-3 text-xs font-black text-[#12284A] hover:bg-white"><span className={`grid h-12 w-12 place-items-center rounded-xl text-white ${color}`}><Icon className="h-6 w-6" /></span>{label}</Link>)}
        </div>
      </section>
    </div>
  );
}
