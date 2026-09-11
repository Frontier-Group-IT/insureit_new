import Image from "next/image";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  Ellipsis,
} from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { createServerSupabaseClient } from "@/lib/auth-server";
import { getPartnerWebHome, getPartnerWebSession } from "@/lib/partner-web";
import { getPartnerExternalRenewalSummary } from "@/lib/partner-external-renewals";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const ICON_BASE = "/assets/Custom-Icons/optimized-128";

const homeIcons = {
  premium: `${ICON_BASE}/accounts-finance.png`,
  policies: `${ICON_BASE}/policy.png`,
  customers: `${ICON_BASE}/customers.png`,
  renewals: `${ICON_BASE}/renewal.png`,
  priority: `${ICON_BASE}/tasks-work-queue.png`,
  claims: `${ICON_BASE}/claims.png`,
  claimsAttention: `${ICON_BASE}/claim-overdue.png`,
  intakeAttention: `${ICON_BASE}/policy-intake-review.png`,
  overduePolicies: `${ICON_BASE}/expired-policy.png`,
  workload: `${ICON_BASE}/reports-analytics.png`,
} as const;

function formatIndianCurrency(value: number | string) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatUpdatedTime(value: Date) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  })
    .format(value)
    .toLowerCase();
}

function todayHref(kind: "intake_attention" | "renewal" | "claim") {
  if (kind === "intake_attention") return "/partner/policy-intakes";
  if (kind === "renewal") return "/partner/renewals";
  return "/partner/claims";
}

function todayIcon(kind: "intake_attention" | "renewal" | "claim") {
  if (kind === "intake_attention") return homeIcons.intakeAttention;
  if (kind === "renewal") return homeIcons.renewals;
  return homeIcons.claims;
}

function ProfessionalIcon({ src, alt = "", size = 24 }: { src: string; alt?: string; size?: number }) {
  return <Image src={src} alt={alt} width={size} height={size} className="h-auto w-auto object-contain" />;
}

async function getPartnerWebNetPremiumThisMonth() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase.rpc("partner_web_net_premium_this_month");
  if (error || data === null) throw new Error(error?.message ?? "Partner net premium is unavailable.");
  return data as number | string;
}

export default async function PartnerHomePage() {
  const [{ identity }, home, externalRenewals, netPremiumThisMonth] = await Promise.all([
    getPartnerWebSession(),
    getPartnerWebHome(),
    getPartnerExternalRenewalSummary(),
    getPartnerWebNetPremiumThisMonth(),
  ]);
  const name = identity.display_name?.trim() || "Partner";
  const updatedTime = formatUpdatedTime(new Date());

  return (
    <PartnerPortalShell title="Home">
      <div className="space-y-2 pb-3">
        <section
          data-partner-home-reference-hero="true"
          className="flex items-center justify-between gap-5 border-b border-[#D7DEE8] px-1 py-1 sm:px-0"
        >
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-medium leading-none tracking-[-0.035em] text-[#142746] sm:text-[26px]">Welcome, {name}</h1>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <span className="whitespace-nowrap text-[10px] font-medium text-[#7A899E]">Updated {updatedTime}</span>
            <Link
              href="/partner/business"
              prefetch={false}
              data-partner-home-reference-cta="true"
              className="inline-flex h-9 shrink-0 items-center justify-center gap-1.5 bg-[#163968] px-4 text-[11px] font-semibold text-white shadow-none transition hover:bg-[#102F59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163968]/30"
            >
              <span>View My Business</span>
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          </div>
        </section>

        <section className="grid overflow-hidden rounded-xl border border-[#E2E8F0] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.05)] sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Net Premium"
            value={formatIndianCurrency(netPremiumThisMonth)}
            meta="This month"
            iconSrc={homeIcons.premium}
          />
          <MetricCard
            label="Policies"
            value={home.business.policies_this_month}
            meta={`${home.business.active_policies} active`}
            iconSrc={homeIcons.policies}
          />
          <MetricCard
            label="Customers"
            value={home.business.total_customers}
            meta={`${home.business.customers_this_month} added this month`}
            iconSrc={homeIcons.customers}
          />
          <MetricCard
            label="Renewals"
            value={home.business.renewals_30_days}
            meta="Due in 30 days"
            iconSrc={homeIcons.renewals}
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_.95fr]">
          <DashboardPanel
            iconSrc={homeIcons.priority}
            title="Priority work"
          >
            <div className="space-y-2 px-4 pb-4">
              {home.today.length ? (
                home.today.slice(0, 6).map((item, index) => (
                  <Link
                    key={`${item.kind}-${index}`}
                    href={todayHref(item.kind)}
                    prefetch={false}
                    className="group flex min-h-[62px] items-center gap-3 rounded-lg border border-[#E3EAF4] bg-white px-3.5 py-2.5 shadow-[0_3px_10px_rgba(25,50,90,0.04)] transition hover:border-[#D2DDED] hover:shadow-[0_5px_14px_rgba(25,50,90,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center">
                      <ProfessionalIcon src={todayIcon(item.kind)} size={24} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-extrabold leading-4 text-[#183057]">{item.title}</span>
                      <span className="mt-0.5 block text-[9.5px] font-medium leading-4 text-[#74849C]">{item.subtitle}</span>
                    </span>
                    <span className="grid min-w-6 place-items-center rounded-full bg-[#FFF0F5] px-2 py-1 text-[9px] font-black text-[#E34578]">{item.count}</span>
                    <ArrowRight className="h-4 w-4 text-[#3471E9] transition group-hover:translate-x-0.5" />
                  </Link>
                ))
              ) : (
                <div className="flex min-h-[62px] items-center gap-3 rounded-lg border border-[#E3EAF4] bg-white px-4 text-[#62738D]">
                  <AlertCircle className="h-4 w-4" />
                  <p className="text-[10.5px] font-semibold">No priority actions right now.</p>
                </div>
              )}

              <Link
                href="/partner/renewals/external"
                prefetch={false}
                className="group flex min-h-[62px] items-center gap-3 rounded-lg border border-[#E3EAF4] bg-white px-3.5 py-2.5 shadow-[0_3px_10px_rgba(25,50,90,0.04)] transition hover:border-[#D2DDED] hover:shadow-[0_5px_14px_rgba(25,50,90,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
              >
                <span className="grid h-9 w-9 shrink-0 place-items-center">
                  <ProfessionalIcon src={homeIcons.renewals} size={24} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[11px] font-extrabold leading-4 text-[#183057]">External Renewal Opportunities</span>
                  <span className="mt-0.5 block text-[9.5px] font-medium leading-4 text-[#74849C]">External policies expiring within 30 days</span>
                </span>
                <span className="text-[18px] font-black tracking-[-0.03em] text-[#102A59]">{externalRenewals.due_30_count}</span>
                <ArrowRight className="h-4 w-4 text-[#3471E9] transition group-hover:translate-x-0.5" />
              </Link>
            </div>
          </DashboardPanel>

          <DashboardPanel
            iconSrc={homeIcons.workload}
            eyebrow="Service Snapshot"
            title="Current workload"
          >
            <div className="grid grid-cols-2 gap-2 px-4 pb-4">
              <SnapshotCard label="Active Claims" value={home.service.active_claims} href="/partner/claims" iconSrc={homeIcons.claims} />
              <SnapshotCard label="Claims Attention" value={home.service.claims_need_attention} href="/partner/claims" iconSrc={homeIcons.claimsAttention} />
              <SnapshotCard label="Intakes Attention" value={home.service.intakes_need_attention} href="/partner/policy-intakes" iconSrc={homeIcons.intakeAttention} />
              <SnapshotCard label="Overdue Policies" value={home.business.overdue_policies} href="/partner/renewals" iconSrc={homeIcons.overduePolicies} />
            </div>
          </DashboardPanel>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function MetricCard({ label, value, meta, iconSrc }: { label: string; value: number | string; meta: string; iconSrc: string }) {
  return (
    <div className="relative flex min-h-[84px] items-center gap-3 border-b border-[#E8EDF3] px-4 py-3 sm:[&:nth-child(odd)]:border-r sm:[&:nth-child(n+3)]:border-b-0 xl:border-b-0 xl:border-r xl:last:border-r-0">
      <span className="grid h-9 w-9 shrink-0 place-items-center">
        <ProfessionalIcon src={iconSrc} size={25} />
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

function DashboardPanel({ iconSrc, eyebrow, title, children }: { iconSrc: string; eyebrow?: string; title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-[#DCE5F1] bg-[#F8FAFD] shadow-[0_4px_14px_rgba(25,50,90,0.05)]">
      <div className="flex items-start gap-2.5 px-4 pb-3 pt-3.5">
        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center">
          <ProfessionalIcon src={iconSrc} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          {eyebrow ? <p className="text-[8px] font-black uppercase tracking-[0.09em] text-[#6685B4]">{eyebrow}</p> : null}
          <h2 className={`${eyebrow ? "mt-0.5" : ""} text-[15px] font-extrabold tracking-[-0.02em] text-[#142B50]`}>{title}</h2>
        </div>
        <Ellipsis className="h-4 w-4 text-[#2F70E5]" aria-hidden="true" />
      </div>
      {children}
    </div>
  );
}

function SnapshotCard({ label, value, href, iconSrc }: { label: string; value: number; href: string; iconSrc: string }) {
  return (
    <Link
      href={href}
      prefetch={false}
      className="flex min-h-[66px] items-center gap-3 rounded-lg border border-[#E3EAF4] bg-white px-3 py-2.5 shadow-[0_3px_10px_rgba(25,50,90,0.04)] transition hover:border-[#D2DDED] hover:shadow-[0_5px_14px_rgba(25,50,90,0.07)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center">
        <ProfessionalIcon src={iconSrc} size={24} />
      </span>
      <span className="min-w-0">
        <span className="block text-[8px] font-black uppercase tracking-[0.06em] text-[#77869C]">{label}</span>
        <span className="mt-1 block text-[18px] font-black leading-none text-[#142A50]">{value}</span>
      </span>
    </Link>
  );
}
