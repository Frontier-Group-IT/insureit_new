import Link from "next/link";
import { AlertCircle, ArrowRight, BriefcaseBusiness, CalendarClock, ClipboardList, FileInput, RefreshCw, ShieldCheck, UsersRound } from "lucide-react";
import { PartnerPortalShell } from "@/components/partner-portal/partner-portal-shell";
import { PartnerDivider, PartnerMetricStrip, PartnerPageHeader, PartnerSectionHeading } from "@/components/partner-portal/partner-page-primitives";
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
      <div className="space-y-7">
        <PartnerPageHeader
          eyebrow="Partner Overview"
          title={"Welcome, " + name}
          description="Your current business, renewals and service activity in one workspace."
          action={
            <Link href="/partner/business" prefetch={false} className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-[#111A35] px-4 text-[10.5px] font-bold text-white transition hover:bg-[#1B2A50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/25">
              View My Business <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          }
        />

        <PartnerMetricStrip
          items={[
            { label: "Gross Premium", value: formatIndianCurrency(home.business.premium_this_month), meta: "This month" },
            { label: "Policies", value: home.business.policies_this_month, meta: home.business.active_policies + " active" },
            { label: "Customers", value: home.business.total_customers, meta: home.business.customers_this_month + " added this month" },
            { label: "Renewals", value: home.business.renewals_30_days, meta: "Due in 30 days" },
          ]}
        />

        <Link href="/partner/renewals/external" prefetch={false} className="group flex items-center gap-3 border-y border-[#DCE4ED] py-3.5 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:px-4">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#EEF4FF] text-[#3156B8]"><CalendarClock className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-extrabold text-[#1B2F4E]">External Renewal Opportunities</span>
            <span className="mt-0.5 block text-[9.5px] font-medium leading-4 text-[#74839A]">External policies expiring within 30 days</span>
          </span>
          <span className="text-[20px] font-extrabold tracking-[-0.03em] text-[#162746]">{externalRenewals.due_30_count}</span>
          <ArrowRight className="h-4 w-4 text-[#8794A7] transition group-hover:translate-x-0.5" />
        </Link>

        <section className="grid gap-8 xl:grid-cols-[1.18fr_.82fr]">
          <div>
            <PartnerSectionHeading eyebrow="Needs Your Attention" title="Priority work" />
            <div className="mt-3 divide-y divide-[#E0E7EF] border-y border-[#DCE4ED]">
              {home.today.length ? home.today.slice(0, 6).map((item, index) => (
                <Link key={item.kind + "-" + index} href={todayHref(item.kind)} prefetch={false} className="group flex items-center gap-3 py-3.5 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#EEF3F8] text-[#3156B8]">
                    {item.kind === "intake_attention" ? <FileInput className="h-4 w-4" /> : item.kind === "renewal" ? <RefreshCw className="h-4 w-4" /> : <ClipboardList className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block break-words text-[11px] font-bold leading-4 text-[#182947]">{item.title}</span>
                    <span className="mt-0.5 block break-words text-[9.5px] font-medium leading-4 text-[#7A899F]">{item.subtitle}</span>
                  </span>
                  <span className="text-[11px] font-extrabold text-[#23395D]">{item.count}</span>
                  <ArrowRight className="h-4 w-4 text-[#8794A7] transition group-hover:translate-x-0.5" />
                </Link>
              )) : (
                <div className="py-8">
                  <div className="flex items-center gap-3 text-[#5B6F89]">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-[10.5px] font-semibold">No priority actions right now.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <PartnerSectionHeading eyebrow="Service Snapshot" title="Current workload" />
            <div className="mt-3 grid grid-cols-2 border-y border-[#DCE4ED]">
              <Snapshot label="Active Claims" value={home.service.active_claims} href="/partner/claims" />
              <Snapshot label="Claims Attention" value={home.service.claims_need_attention} href="/partner/claims" right />
              <Snapshot label="Intakes Attention" value={home.service.intakes_need_attention} href="/partner/policy-intakes" top />
              <Snapshot label="Overdue Policies" value={home.business.overdue_policies} href="/partner/renewals" top right />
            </div>
          </div>
        </section>

        <PartnerDivider />

        <section>
          <PartnerSectionHeading eyebrow="Quick Actions" title="Open a workspace" />
          <div className="mt-3 grid divide-y divide-[#E0E7EF] border-y border-[#DCE4ED] sm:grid-cols-2 sm:divide-x sm:divide-y-0 xl:grid-cols-4">
            <QuickAction href="/partner/policy-intakes" title="Policy Intake" subtitle="Create or track policy intake" icon={FileInput} />
            <QuickAction href="/partner/customers" title="Customers" subtitle="Search your customer book" icon={UsersRound} />
            <QuickAction href="/partner/policies" title="Policies" subtitle="Open your policy register" icon={ShieldCheck} />
            <QuickAction href="/partner/claims" title="Claims" subtitle="Track active claim work" icon={ClipboardList} />
          </div>
        </section>
      </div>
    </PartnerPortalShell>
  );
}

function Snapshot({ label, value, href, top = false, right = false }: { label: string; value: number; href: string; top?: boolean; right?: boolean }) {
  return (
    <Link href={href} prefetch={false} className={"min-h-[76px] px-1 py-3.5 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:px-4 " + (top ? "border-t border-[#E0E7EF] " : "") + (right ? "border-l border-[#E0E7EF]" : "")}>
      <p className="text-[8.5px] font-black uppercase tracking-[0.09em] text-[#7A899F]">{label}</p>
      <p className="mt-1.5 text-[22px] font-extrabold tracking-[-0.03em] text-[#162746]">{value}</p>
    </Link>
  );
}

function QuickAction({ href, title, subtitle, icon: Icon }: { href: string; title: string; subtitle: string; icon: typeof ShieldCheck }) {
  return (
    <Link href={href} prefetch={false} className="group flex min-h-[72px] items-center gap-3 px-1 py-3.5 transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#3156B8]/20 sm:px-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#111A35] text-white"><Icon className="h-4 w-4" /></span>
      <span className="min-w-0 flex-1">
        <span className="block break-words text-[11px] font-extrabold leading-4 text-[#172846]">{title}</span>
        <span className="mt-0.5 block break-words text-[9.5px] font-medium leading-4 text-[#7A899F]">{subtitle}</span>
      </span>
      <ArrowRight className="h-4 w-4 text-[#8794A7] transition group-hover:translate-x-0.5" />
    </Link>
  );
}
