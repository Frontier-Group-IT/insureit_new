import Link from "next/link";
import { AlertCircle, ArrowRight, BriefcaseBusiness, ClipboardList, FileInput, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebHome, getPartnerWebSession } from "@/lib/partner-web";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function formatIndianCurrency(value: number | string) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function metricHref(kind: "business" | "policies" | "customers" | "renewals") {
  if (kind === "business") return "/partner/business";
  if (kind === "policies") return "/partner/policies";
  if (kind === "customers") return "/partner/customers";
  return "/partner/renewals";
}

function todayHref(kind: "intake_attention" | "renewal" | "claim") {
  if (kind === "intake_attention") return "/partner/policy-intakes";
  if (kind === "renewal") return "/partner/renewals";
  return "/partner/claims";
}

export default async function PartnerHomePage() {
  const [{ identity }, home] = await Promise.all([getPartnerWebSession(), getPartnerWebHome()]);
  const name = identity.display_name?.trim() || "Partner";

  const metrics = [
    { key: "business" as const, label: "Gross Premium", value: formatIndianCurrency(home.business.premium_this_month), hint: "This month", icon: BriefcaseBusiness },
    { key: "policies" as const, label: "Policies", value: String(home.business.policies_this_month), hint: `${home.business.active_policies} active`, icon: ShieldCheck },
    { key: "customers" as const, label: "Customers", value: String(home.business.total_customers), hint: `${home.business.customers_this_month} added this month`, icon: UsersRound },
    { key: "renewals" as const, label: "Renewals", value: String(home.business.renewals_30_days), hint: "Due in 30 days", icon: RefreshCw },
  ];

  return (
    <PartnerPortalShell title="Home">
      <div className="space-y-4">
        <section className="overflow-hidden rounded-[26px] border border-[#D7E0EC] bg-white shadow-[0_16px_45px_rgba(34,56,89,.08)]">
          <div className="flex flex-col gap-2 border-b border-[#E6ECF3] px-5 py-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">Partner Overview</p>
              <h2 className="mt-1 text-[23px] font-extrabold tracking-[-0.025em] text-[#142541]">Welcome, {name}</h2>
              <p className="mt-1 text-[11px] font-medium text-[#687A96]">Your current business, renewals and service activity in one workspace.</p>
            </div>
            <Link href="/partner/business" prefetch={false} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#111A35] px-4 text-[11px] font-bold text-white transition hover:bg-[#1B2A50]">
              View My Business <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map((metric, index) => {
              const Icon = metric.icon;
              return (
                <Link
                  key={metric.key}
                  href={metricHref(metric.key)}
                  prefetch={false}
                  className={`group flex min-h-[118px] items-center gap-4 px-5 py-5 transition hover:bg-[#F8FAFD] sm:px-6 ${
                    index < metrics.length - 1 ? "border-b border-[#E6ECF3] sm:border-r xl:border-b-0" : ""
                  }`}
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#EEF4FF] text-[#3156B8] transition group-hover:bg-[#E4ECFF]">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[9px] font-black uppercase tracking-[0.12em] text-[#71819A]">{metric.label}</span>
                    <span className="mt-1 block truncate text-[22px] font-extrabold tracking-[-0.025em] text-[#152746]">{metric.value}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold text-[#71819A]">{metric.hint}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[1.18fr_.82fr]">
          <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">Needs Your Attention</p>
                <h2 className="mt-1 text-[18px] font-extrabold text-[#152746]">Priority work</h2>
              </div>
              <AlertCircle className="h-5 w-5 text-[#D97706]" />
            </div>

            <div className="mt-4 divide-y divide-[#E8EDF4]">
              {home.today.length ? home.today.slice(0, 6).map((item, index) => (
                <Link key={`${item.kind}-${index}`} href={todayHref(item.kind)} prefetch={false} className="group flex items-center gap-4 py-4 first:pt-1 last:pb-1">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-[#F3F6FA] text-[#3156B8]">
                    {item.kind === "intake_attention" ? <FileInput className="h-4.5 w-4.5" /> : item.kind === "renewal" ? <RefreshCw className="h-4.5 w-4.5" /> : <ClipboardList className="h-4.5 w-4.5" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-bold text-[#182947]">{item.title}</span>
                    <span className="mt-0.5 block truncate text-[10.5px] font-medium text-[#72809A]">{item.subtitle}</span>
                  </span>
                  <span className="rounded-xl bg-[#EEF3F8] px-2.5 py-1.5 text-[11px] font-extrabold text-[#23395D]">{item.count}</span>
                  <ArrowRight className="h-4 w-4 text-[#8190A7] transition group-hover:translate-x-0.5" />
                </Link>
              )) : (
                <div className="py-8 text-center">
                  <p className="text-[12px] font-bold text-[#23395D]">No priority actions right now</p>
                  <p className="mt-1 text-[10.5px] text-[#7A899F]">New renewal, claim and intake actions will appear here.</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[26px] border border-[#D7E0EC] bg-white p-5 shadow-[0_16px_45px_rgba(34,56,89,.07)] sm:p-6">
            <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[#687A96]">Service Snapshot</p>
            <h2 className="mt-1 text-[18px] font-extrabold text-[#152746]">Current workload</h2>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <Snapshot label="Active Claims" value={home.service.active_claims} href="/partner/claims" />
              <Snapshot label="Claims Attention" value={home.service.claims_need_attention} href="/partner/claims" />
              <Snapshot label="Intakes Attention" value={home.service.intakes_need_attention} href="/partner/policy-intakes" />
              <Snapshot label="Overdue Policies" value={home.business.overdue_policies} href="/partner/renewals" />
            </div>
          </section>
        </div>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <QuickAction href="/partner/policy-intakes" title="Policy Intake" subtitle="Create or track policy intake" icon={FileInput} />
          <QuickAction href="/partner/customers" title="Customers" subtitle="Search your customer book" icon={UsersRound} />
          <QuickAction href="/partner/policies" title="Policies" subtitle="Open your policy register" icon={ShieldCheck} />
          <QuickAction href="/partner/claims" title="Claims" subtitle="Track active claim work" icon={ClipboardList} />
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function Snapshot({ label, value, href }: { label: string; value: number; href: string }) {
  return (
    <Link href={href} prefetch={false} className="rounded-2xl border border-[#E1E7F0] bg-[#F8FAFD] p-4 transition hover:border-[#C8D4E4] hover:bg-white">
      <p className="text-[9px] font-black uppercase tracking-[0.1em] text-[#75849A]">{label}</p>
      <p className="mt-2 text-[24px] font-extrabold tracking-[-0.03em] text-[#162746]">{value}</p>
    </Link>
  );
}

function QuickAction({ href, title, subtitle, icon: Icon }: { href: string; title: string; subtitle: string; icon: typeof ShieldCheck }) {
  return (
    <Link href={href} prefetch={false} className="group flex min-h-[92px] items-center gap-4 rounded-[22px] border border-[#D7E0EC] bg-white px-4 py-4 shadow-[0_12px_35px_rgba(34,56,89,.06)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_38px_rgba(34,56,89,.10)]">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#111A35] text-white"><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12px] font-extrabold text-[#172846]">{title}</span>
        <span className="mt-0.5 block text-[10px] font-medium text-[#74839A]">{subtitle}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-[#8090A8] transition group-hover:translate-x-0.5" />
    </Link>
  );
}
