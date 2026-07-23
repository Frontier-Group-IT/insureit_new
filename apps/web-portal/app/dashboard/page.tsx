import Link from "next/link";
import {
  ArrowRight,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CarFront,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  Clock3,
  FileCheck2,
  FileWarning,
  Landmark,
  Plus,
  ReceiptText,
  ShieldCheck,
  Siren,
  Store,
  UserRound,
  UsersRound
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getOperationsDashboardData, type OperationsDashboardData } from "@/lib/operations-dashboard";
import { canManageMasterData } from "@/lib/roles";

type SummaryCard = {
  label: string;
  value: number;
  meta: string;
  href: string;
  icon: LucideIcon;
  tone: "navy" | "teal" | "amber" | "rose";
};

type AttentionItem = {
  label: string;
  value: number;
  detail: string;
  href: string;
  icon: LucideIcon;
  tone: "amber" | "rose" | "blue" | "violet";
};

const partnerIcons: Record<string, LucideIcon> = {
  group: UsersRound,
  corporate: Building2,
  dealership: Store,
  individual: UserRound,
  posp: BriefcaseBusiness,
  misp: Landmark
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  const dashboard = await getOperationsDashboardData(supabase);
  const displayName = firstName(profile?.full_name) || "Operations Team";
  const canCreateRecords = canManageMasterData(profile?.role);

  const summaryCards: SummaryCard[] = [
    {
      label: "Customer portfolio",
      value: dashboard.totals.customers,
      meta: `${dashboard.totals.activeCustomers} active · ${dashboard.totals.newCustomers} added in 30 days`,
      href: "/customers",
      icon: UsersRound,
      tone: "navy"
    },
    {
      label: "Fleet under management",
      value: dashboard.totals.vehicles,
      meta: `${dashboard.totals.policies} policy records · ${dashboard.totals.activePolicies} currently valid`,
      href: "/vehicles",
      icon: CarFront,
      tone: "teal"
    },
    {
      label: "Renewal exposure",
      value: dashboard.totals.expiringPolicies + dashboard.totals.expiredPolicies,
      meta: `${dashboard.totals.expiringPolicies} due in 45 days · ${dashboard.totals.expiredPolicies} expired`,
      href: "/policies",
      icon: CalendarDays,
      tone: "amber"
    },
    {
      label: "Open claims",
      value: dashboard.totals.openClaims,
      meta: `${dashboard.totals.recentClaims} reported in 30 days · ${dashboard.totals.claims} total`,
      href: "/claims",
      icon: ShieldCheck,
      tone: "rose"
    }
  ];

  const attentionItems: AttentionItem[] = [
    {
      label: "KYC applications",
      value: dashboard.attention.onboarding,
      detail: `${dashboard.attention.submittedOnboarding} submitted · ${dashboard.attention.changesRequested} need changes`,
      href: "/customers/applications",
      icon: ClipboardCheck,
      tone: "blue"
    },
    {
      label: "Expired policies",
      value: dashboard.totals.expiredPolicies,
      detail: "Cover requires immediate review",
      href: "/policies",
      icon: FileWarning,
      tone: "rose"
    },
    {
      label: "Overdue tasks",
      value: dashboard.attention.overdueTasks,
      detail: `${dashboard.attention.openTasks} open follow-ups`,
      href: "/tasks",
      icon: Clock3,
      tone: "amber"
    },
    {
      label: "Documents to review",
      value: dashboard.attention.documents,
      detail: "Pending or returned documents",
      href: "/documents",
      icon: FileCheck2,
      tone: "violet"
    }
  ];

  return (
    <ClaimManagerShell title="Operations Dashboard" activeNav="dashboard">
      <div className="mx-auto max-w-[1500px] space-y-4 pb-8">
        <section className="flex flex-col gap-4 border-b border-[#D7E6F5] pb-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#175CD3]">Business overview</p>
            <h1 className="mt-1 text-[24px] font-semibold leading-8 text-[#0F172A]">Good {dayPeriod()}, {displayName}</h1>
            <p className="mt-1 text-[12px] text-[#64748B]">Portfolio health, pending work and recent operational movement.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-9 items-center gap-2 rounded-md border border-[#D7E6F5] bg-white px-3 text-[11px] font-medium text-[#475467]">
              <CalendarDays className="h-4 w-4 text-[#175CD3]" />
              {dashboardDateLabel()}
            </div>
            {canCreateRecords ? (
              <>
                <Link href="/customers?choose_partner=1" className="inline-flex h-9 items-center gap-2 rounded-md border border-[#B8CBE4] bg-white px-3 text-[11px] font-semibold text-[#0B3975] transition hover:border-[#175CD3] hover:bg-[#F3F8FF]">
                  <Plus className="h-4 w-4" /> New customer
                </Link>
                <Link href="/customers/applications" className="inline-flex h-9 items-center gap-2 rounded-md bg-[#071D49] px-3 text-[11px] font-semibold text-white transition hover:bg-[#0B3975]">
                  Review KYC <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            ) : null}
          </div>
        </section>

        {dashboard.errors.length ? (
          <section className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[11px] text-amber-900">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div><p className="font-semibold">Some dashboard figures are temporarily unavailable.</p><p className="mt-0.5 text-amber-800">{dashboard.errors.join(" ")}</p></div>
          </section>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Business summary">
          {summaryCards.map((card) => <SummaryCardView key={card.label} card={card} />)}
        </section>

        <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.8fr)]">
          <div className="overflow-hidden rounded-lg border border-[#D7E6F5] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
            <SectionHeading eyebrow="Action queue" title="Needs attention" description="Work that can affect onboarding, cover or customer service." href="/notifications" linkLabel="Open action inbox" />
            <div className="grid divide-y divide-[#E6EEF7] md:grid-cols-2 md:divide-x md:divide-y-0">
              {attentionItems.map((item, index) => <AttentionItemView key={item.label} item={item} divided={index > 1} />)}
            </div>
            {dashboard.attention.highPriorityActivity > 0 ? (
              <Link href="/notifications" className="flex items-center justify-between border-t border-[#F0D8D8] bg-[#FFF7F7] px-4 py-2.5 text-[11px] text-[#9B1C1C] transition hover:bg-[#FFF0F0]">
                <span className="inline-flex items-center gap-2 font-semibold"><Siren className="h-4 w-4" />{dashboard.attention.highPriorityActivity} high-priority customer updates require attention</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-lg border border-[#D7E6F5] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
            <SectionHeading eyebrow="Portfolio" title="Account mix" description="Customers visible within your current access scope." href="/customers" linkLabel="View customers" />
            <div className="grid grid-cols-2 border-t border-[#E6EEF7]">
              {dashboard.portfolio.map((item) => <PortfolioItem key={item.key} item={item} />)}
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <RecentApplications rows={dashboard.recentApplications} />
          <LatestClaims rows={dashboard.latestClaims} />
        </section>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Quick navigation">
          <QuickLink href="/customers/posp-misp" label="POSP / MISP workspace" description="Onboarding and import review" icon={BriefcaseBusiness} />
          <QuickLink href="/policies" label="Policy register" description="Cover and renewal records" icon={ReceiptText} />
          <QuickLink href="/documents" label="Document verification" description="Claim and KYC review queues" icon={FileCheck2} />
          <QuickLink href="/tasks" label="Follow-up tasks" description="Assignments, due dates and ownership" icon={CheckCircle2} />
        </section>
      </div>
    </ClaimManagerShell>
  );
}

function SummaryCardView({ card }: { card: SummaryCard }) {
  const Icon = card.icon;
  const tone = summaryTone(card.tone);
  return (
    <Link href={card.href} className="group overflow-hidden rounded-lg border border-[#D7E6F5] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:border-[#B8CBE4] hover:shadow-[0_8px_20px_rgba(15,23,42,0.08)]">
      <div className={`h-1 ${tone.bar}`} />
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-[11px] font-medium text-[#667085]">{card.label}</p><p className="mt-1 text-[27px] font-semibold leading-none text-[#101828]">{card.value.toLocaleString("en-IN")}</p></div>
          <span className={`grid h-10 w-10 place-items-center rounded-md ${tone.icon}`}><Icon className="h-5 w-5" /></span>
        </div>
        <div className="mt-4 flex items-end justify-between gap-3 border-t border-[#EEF2F6] pt-3">
          <p className="text-[10.5px] leading-4 text-[#667085]">{card.meta}</p>
          <ArrowRight className="h-4 w-4 shrink-0 text-[#98A2B3] transition group-hover:translate-x-0.5 group-hover:text-[#175CD3]" />
        </div>
      </div>
    </Link>
  );
}

function AttentionItemView({ item, divided }: { item: AttentionItem; divided: boolean }) {
  const Icon = item.icon;
  const tone = attentionTone(item.tone);
  return (
    <Link href={item.href} className={`group flex items-center gap-3 px-4 py-3.5 transition hover:bg-[#F8FBFF] ${divided ? "md:border-t md:border-[#E6EEF7]" : ""}`}>
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md ${tone}`}><Icon className="h-5 w-5" /></span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-3"><span className="text-[12px] font-semibold text-[#101828]">{item.label}</span><span className="text-[20px] font-semibold text-[#101828]">{item.value}</span></span>
        <span className="mt-0.5 block text-[10.5px] text-[#667085]">{item.detail}</span>
      </span>
      <ArrowRight className="h-4 w-4 shrink-0 text-[#98A2B3] transition group-hover:translate-x-0.5 group-hover:text-[#175CD3]" />
    </Link>
  );
}

function PortfolioItem({ item }: { item: OperationsDashboardData["portfolio"][number] }) {
  const Icon = partnerIcons[item.key] ?? Building2;
  return (
    <div className="flex items-center gap-3 border-b border-r border-[#E6EEF7] px-4 py-3 last:border-b-0">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-[#EEF5FC] text-[#175CD3]"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0"><p className="truncate text-[10.5px] text-[#667085]">{item.label}</p><p className="text-[17px] font-semibold text-[#101828]">{item.value}</p></div>
    </div>
  );
}

function RecentApplications({ rows }: { rows: OperationsDashboardData["recentApplications"] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#D7E6F5] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <SectionHeading eyebrow="Onboarding" title="Recent applications" description="Latest activity across all partner types." href="/customers/applications" linkLabel="View queue" />
      <div className="divide-y divide-[#E6EEF7] border-t border-[#E6EEF7]">
        {rows.length ? rows.map((row) => (
          <Link key={row.id} href={`/customers/applications/${row.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-[#F8FBFF]">
            <div className="min-w-0">
              <p className="truncate text-[12px] font-semibold text-[#101828]">{applicationName(row)}</p>
              <p className="mt-0.5 truncate text-[10.5px] text-[#667085]">{partnerLabel(row.partner_type)} · {row.applicant_phone ?? row.applicant_email ?? "Contact not recorded"}</p>
            </div>
            <div className="text-right"><StatusPill status={row.status} /><p className="mt-1 text-[9.5px] text-[#98A2B3]">{relativeTime(row.updated_at)}</p></div>
          </Link>
        )) : <EmptyRow label="No onboarding applications available." />}
      </div>
    </section>
  );
}

function LatestClaims({ rows }: { rows: OperationsDashboardData["latestClaims"] }) {
  return (
    <section className="overflow-hidden rounded-lg border border-[#D7E6F5] bg-white shadow-[0_2px_8px_rgba(15,23,42,0.04)]">
      <SectionHeading eyebrow="Claims" title="Latest claim movement" description="Most recently updated claim records." href="/claims" linkLabel="Open claims" />
      <div className="divide-y divide-[#E6EEF7] border-t border-[#E6EEF7]">
        {rows.length ? rows.map((row) => (
          <Link key={row.id} href={`/claims/${row.id}`} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-[#F8FBFF]">
            <div className="min-w-0">
              <p className="text-[12px] font-semibold text-[#101828]">{row.vehicles?.vehicle_no ?? row.claim_no}</p>
              <p className="mt-0.5 truncate text-[10.5px] text-[#667085]">{row.customers?.company_name ?? row.customers?.contact_name ?? "Customer unavailable"} · {row.claim_no}</p>
            </div>
            <div className="text-right"><StatusPill status={row.current_status} /><p className="mt-1 text-[9.5px] text-[#98A2B3]">{relativeTime(row.updated_at)}</p></div>
          </Link>
        )) : <EmptyRow label="No claim records available." />}
      </div>
    </section>
  );
}

function SectionHeading({ eyebrow, title, description, href, linkLabel }: { eyebrow: string; title: string; description: string; href: string; linkLabel: string }) {
  return (
    <div className="flex items-start justify-between gap-4 px-4 py-3">
      <div><p className="text-[9.5px] font-semibold uppercase tracking-[0.08em] text-[#175CD3]">{eyebrow}</p><h2 className="mt-0.5 text-[14px] font-semibold text-[#101828]">{title}</h2><p className="mt-0.5 text-[10.5px] text-[#667085]">{description}</p></div>
      <Link href={href} className="mt-1 inline-flex shrink-0 items-center gap-1 text-[10.5px] font-semibold text-[#175CD3] hover:underline">{linkLabel}<ArrowRight className="h-3.5 w-3.5" /></Link>
    </div>
  );
}

function QuickLink({ href, label, description, icon: Icon }: { href: string; label: string; description: string; icon: LucideIcon }) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-lg border border-[#D7E6F5] bg-white px-4 py-3 transition hover:border-[#B8CBE4] hover:bg-[#F8FBFF]">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[#EEF5FC] text-[#175CD3]"><Icon className="h-[18px] w-[18px]" /></span>
      <span className="min-w-0 flex-1"><span className="block text-[11.5px] font-semibold text-[#101828]">{label}</span><span className="mt-0.5 block truncate text-[10px] text-[#667085]">{description}</span></span>
      <ArrowRight className="h-4 w-4 text-[#98A2B3] transition group-hover:translate-x-0.5 group-hover:text-[#175CD3]" />
    </Link>
  );
}

function EmptyRow({ label }: { label: string }) {
  return <div className="px-4 py-10 text-center text-[11px] text-[#667085]">{label}</div>;
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className = normalized.includes("approved") || normalized.includes("complete") || normalized.includes("settled")
    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
    : normalized.includes("reject") || normalized.includes("changes") || normalized.includes("expired")
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : normalized.includes("progress") || normalized.includes("submitted") || normalized.includes("intimat")
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex max-w-[180px] truncate rounded-full border px-2 py-0.5 text-[9.5px] font-semibold ${className}`}>{status.replaceAll("_", " ")}</span>;
}

function applicationName(row: OperationsDashboardData["recentApplications"][number]) {
  return row.display_name
    ?? row.applicant_phone
    ?? row.applicant_email
    ?? "Unnamed application";
}

function partnerLabel(value: string | null) {
  const labels: Record<string, string> = {
    group: "Group",
    corporate: "Corporate",
    dealership: "Dealership",
    individual_proprietor: "Individual / Proprietor",
    posp: "POSP",
    misp: "MISP"
  };
  return value ? labels[value] ?? value : "Partner type pending";
}

function summaryTone(tone: SummaryCard["tone"]) {
  return {
    navy: { bar: "bg-[#071D49]", icon: "bg-[#EAF2FB] text-[#0B3975]" },
    teal: { bar: "bg-[#087E8B]", icon: "bg-[#E8F7F8] text-[#087E8B]" },
    amber: { bar: "bg-[#D18B00]", icon: "bg-[#FFF6DF] text-[#A15C00]" },
    rose: { bar: "bg-[#C53B4C]", icon: "bg-[#FFF0F2] text-[#B4233A]" }
  }[tone];
}

function attentionTone(tone: AttentionItem["tone"]) {
  return {
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
    blue: "bg-blue-50 text-blue-700",
    violet: "bg-violet-50 text-violet-700"
  }[tone];
}

function dashboardDateLabel() {
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", weekday: "short", timeZone: "Asia/Kolkata" }).format(new Date());
}

function dayPeriod() {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date()));
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}

function firstName(name?: string | null) {
  return name?.trim().split(/\s+/)[0] ?? "";
}

function relativeTime(value: string) {
  const diffMs = Date.now() - Date.parse(value);
  if (!Number.isFinite(diffMs)) return "-";
  const minutes = Math.max(0, Math.floor(diffMs / 60000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "1d ago" : `${days}d ago`;
}
