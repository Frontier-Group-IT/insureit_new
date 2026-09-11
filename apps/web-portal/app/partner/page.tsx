import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarDays,
  Crown,
  Ellipsis,
  FileText,
  Megaphone,
  RefreshCw,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { getPartnerWebHome, getPartnerWebSession } from "@/lib/partner-web";
import { getPartnerExternalRenewalSummary } from "@/lib/partner-external-renewals";

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

function todayHref(kind: "intake_attention" | "renewal" | "claim") {
  if (kind === "intake_attention") return "/partner/policy-intakes";
  if (kind === "renewal") return "/partner/renewals";
  return "/partner/claims";
}

export default async function PartnerHomePage() {
  const [{ identity }, home, externalRenewals] = await Promise.all([
    getPartnerWebSession(),
    getPartnerWebHome(),
    getPartnerExternalRenewalSummary(),
  ]);
  const name = identity.display_name?.trim() || "Partner";

  return (
    <PartnerPortalShell title="Home">
      <div className="space-y-4 pb-3">
        <section
          data-partner-home-reference-hero="true"
          className="relative isolate min-h-[132px] overflow-hidden rounded-xl bg-[linear-gradient(98deg,#08275F_0%,#07489E_35%,#0966C8_58%,#08397F_78%,#07275F_100%)] px-6 py-5 text-white shadow-[0_7px_20px_rgba(20,61,130,0.14)] sm:px-7"
        >
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute inset-y-0 left-0 w-[38%] bg-gradient-to-r from-[#061F51]/38 to-transparent" />
            <div className="absolute inset-y-0 right-0 w-[35%] bg-gradient-to-l from-[#061E51]/38 to-transparent" />
            <div className="absolute -right-10 -top-40 h-[330px] w-[180px] rotate-[25deg] border-l border-cyan-200/25" />
            <div className="absolute right-[9%] -top-40 h-[330px] w-[170px] rotate-[25deg] border-l border-cyan-200/20" />
            <div className="absolute right-[21%] -top-40 h-[330px] w-[155px] rotate-[25deg] border-l border-blue-100/15" />
            <div className="absolute bottom-0 right-[23%] h-[75%] w-[25%] bg-[linear-gradient(120deg,transparent_12%,rgba(55,176,255,0.12)_50%,transparent_74%)]" />
          </div>

          <div className="relative z-20 max-w-[60%] pt-0.5 sm:max-w-[54%]">
            <p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/75">Partner Overview</p>
            <h1 className="mt-1.5 text-[22px] font-extrabold tracking-[-0.03em] text-white sm:text-[25px]">Welcome, {name}</h1>
            <p className="mt-1 text-[10.5px] font-medium text-white/80">Your current business, renewals and service activity in one place.</p>
          </div>

          <Link
            href="/partner/business"
            prefetch={false}
            data-partner-home-reference-cta="true"
            className="absolute right-5 top-1/2 z-20 hidden h-[38px] w-[166px] -translate-y-1/2 items-center justify-center rounded-full border border-white/30 bg-[#072A63]/72 px-4 text-[10px] font-extrabold text-white shadow-[0_4px_12px_rgba(4,22,62,0.15)] backdrop-blur-sm transition hover:border-white/45 hover:bg-[#061F4F] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 sm:inline-flex"
          >
            <span className="leading-none">View My Business</span>
            <ArrowRight className="absolute right-3.5 h-3.5 w-3.5" />
          </Link>
        </section>

        <section className="grid overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.05)] sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Gross Premium"
            value={formatIndianCurrency(home.business.premium_this_month)}
            meta="This month"
            tone="blue"
            icon={Crown}
          />
          <MetricCard
            label="Policies"
            value={home.business.policies_this_month}
            meta={`${home.business.active_policies} active`}
            tone="green"
            icon={FileText}
          />
          <MetricCard
            label="Customers"
            value={home.business.total_customers}
            meta={`${home.business.customers_this_month} added this month`}
            tone="purple"
            icon={UsersRound}
          />
          <MetricCard
            label="Renewals"
            value={home.business.renewals_30_days}
            meta="Due in 30 days"
            tone="orange"
            icon={RefreshCw}
          />
        </section>

        <Link
          href="/partner/renewals/external"
          prefetch={false}
          className="group relative flex min-h-[76px] items-center gap-4 overflow-hidden rounded-xl border border-[#CCDAF6] bg-gradient-to-r from-[#EAF1FF] via-[#EDF3FF] to-[#DCE8FF] px-5 py-3.5 shadow-[0_4px_14px_rgba(50,86,150,0.06)] transition hover:border-[#B9CDF4] hover:shadow-[0_7px_18px_rgba(50,86,150,0.10)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/25"
        >
          <span className="absolute -left-5 -top-9 h-32 w-32 rounded-full border-[12px] border-white/45" aria-hidden="true" />
          <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full bg-[#3571EB] text-white shadow-[0_5px_12px_rgba(53,113,235,0.25)]">
            <CalendarDays className="h-5 w-5" />
          </span>
          <span className="relative min-w-0 flex-1">
            <span className="block text-[12px] font-extrabold text-[#17315C]">External Renewal Opportunities</span>
            <span className="mt-1 block text-[9.5px] font-medium text-[#62789A]">External policies expiring within 30 days</span>
          </span>
          <span className="relative text-[28px] font-black tracking-[-0.04em] text-[#102A59]">{externalRenewals.due_30_count}</span>
          <ArrowRight className="relative h-5 w-5 text-[#2F69DC] transition group-hover:translate-x-0.5" />
        </Link>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <DashboardPanel
            icon={<Megaphone className="h-4 w-4" />}
            eyebrow="Needs Your Attention"
            title="Priority work"
          >
            <div className="px-4 pb-4">
              {home.today.length ? (
                <div className="space-y-2">
                  {home.today.slice(0, 6).map((item, index) => (
                    <Link
                      key={`${item.kind}-${index}`}
                      href={todayHref(item.kind)}
                      prefetch={false}
                      className="group flex min-h-[62px] items-center gap-3 rounded-lg border border-[#E3EAF4] bg-white px-3.5 py-2.5 shadow-[0_3px_10px_rgba(25,50,90,0.04)] transition hover:border-[#D2DDED] hover:shadow-[0_5px_14px_rgba(25,50,90,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
                    >
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#EAF1FF] text-[#3471E9]">
                        {item.kind === "renewal" ? <RefreshCw className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[11px] font-extrabold leading-4 text-[#183057]">{item.title}</span>
                        <span className="mt-0.5 block text-[9.5px] font-medium leading-4 text-[#74849C]">{item.subtitle}</span>
                      </span>
                      <span className="grid min-w-6 place-items-center rounded-full bg-[#FFF0F5] px-2 py-1 text-[9px] font-black text-[#E34578]">{item.count}</span>
                      <ArrowRight className="h-4 w-4 text-[#3471E9] transition group-hover:translate-x-0.5" />
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="flex min-h-[62px] items-center gap-3 rounded-lg border border-[#E3EAF4] bg-white px-4 text-[#62738D]">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-[10.5px] font-semibold">No priority actions right now.</p>
                </div>
              )}
            </div>
          </DashboardPanel>

          <DashboardPanel
            icon={<BarChart3 className="h-4 w-4" />}
            eyebrow="Service Snapshot"
            title="Current workload"
          >
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <SnapshotCard label="Active Claims" value={home.service.active_claims} href="/partner/claims" tone="blue" icon={ShieldCheck} />
              <SnapshotCard label="Claims Attention" value={home.service.claims_need_attention} href="/partner/claims" tone="red" icon={AlertCircle} />
              <SnapshotCard label="Intakes Attention" value={home.service.intakes_need_attention} href="/partner/policy-intakes" tone="green" icon={FileText} />
              <SnapshotCard label="Overdue Policies" value={home.business.overdue_policies} href="/partner/renewals" tone="purple" icon={RefreshCw} />
            </div>
          </DashboardPanel>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

type MetricTone = "blue" | "green" | "purple" | "orange";

type IconType = typeof ShieldCheck;

const metricToneClasses: Record<MetricTone, string> = {
  blue: "bg-[#E9F0FF] text-[#356BE8]",
  green: "bg-[#DCF7EA] text-[#20B879]",
  purple: "bg-[#EEE6FF] text-[#7C4DDC]",
  orange: "bg-[#FFF0D7] text-[#F59A18]",
};

function MetricCard({ label, value, meta, tone, icon: Icon }: { label: string; value: number | string; meta: string; tone: MetricTone; icon: IconType }) {
  return (
    <div className="relative flex min-h-[84px] items-center gap-3 border-b border-[#E8EDF3] px-4 py-3 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(n+3)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${metricToneClasses[tone]}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[16px] font-black leading-none tracking-[-0.025em] text-[#142A50]">{value}</p>
        <p className="mt-1.5 text-[7.5px] font-black uppercase tracking-[0.08em] text-[#50637F]">{label}</p>
        <p className="mt-1 text-[8px] font-medium text-[#7A899E]">{meta}</p>
      </div>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-[#6D7D96]" />
    </div>
  );
}

function DashboardPanel({ icon, eyebrow, title, children }: { icon: React.ReactNode; eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#DCE5F1] bg-[#F8FAFD] shadow-[0_4px_14px_rgba(25,50,90,0.05)]">
      <div className="flex items-start gap-2.5 px-4 pb-3 pt-3.5">
        <span className="mt-0.5 text-[#2F70E5]">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[8px] font-black uppercase tracking-[0.09em] text-[#6685B4]">{eyebrow}</p>
          <h2 className="mt-0.5 text-[15px] font-extrabold tracking-[-0.02em] text-[#142B50]">{title}</h2>
        </div>
        <Ellipsis className="h-4 w-4 text-[#2F70E5]" aria-hidden="true" />
      </div>
      {children}
    </div>
  );
}

type SnapshotTone = "blue" | "red" | "green" | "purple";

const snapshotToneClasses: Record<SnapshotTone, string> = {
  blue: "bg-[#E9F1FF] text-[#3474EB]",
  red: "bg-[#FFE8EE] text-[#ED4E6B]",
  green: "bg-[#E6F8F1] text-[#28B980]",
  purple: "bg-[#F0E9FF] text-[#8252DF]",
};

function SnapshotCard({ label, value, href, tone, icon: Icon }: { label: string; value: number; href: string; tone: SnapshotTone; icon: IconType }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex min-h-[66px] items-center gap-3 rounded-lg border border-[#E3EAF4] bg-white px-3 py-2.5 shadow-[0_3px_10px_rgba(25,50,90,0.04)] transition hover:border-[#D2DDED] hover:shadow-[0_5px_14px_rgba(25,50,90,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
    >
      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${snapshotToneClasses[tone]}`}><Icon className="h-4 w-4" /></span>
      <span className="min-w-0">
        <span className="block text-[8px] font-black uppercase tracking-[0.06em] text-[#77869C]">{label}</span>
        <span className="mt-1 block text-[18px] font-black leading-none text-[#142A50]">{value}</span>
      </span>
    </Link>
  );
}
