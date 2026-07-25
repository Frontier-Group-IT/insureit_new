import Link from "next/link";
import {
  ArrowUpRight,
  BellRing,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CarFront,
  CheckCircle2,
  CircleAlert,
  Clock3,
  FileCheck2,
  FileWarning,
  Landmark,
  Plus,
  ShieldCheck,
  Store,
  UserRound,
  UsersRound,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getOperationsDashboardData, type OperationsDashboardData } from "@/lib/operations-dashboard";
import { canManageMasterData } from "@/lib/roles";

type Metric = {
  label: string;
  value: number;
  supporting: string;
  href: string;
  icon: LucideIcon;
  gradient: string;
  glow: string;
};

type FocusItem = {
  label: string;
  value: number;
  detail: string;
  href: string;
  icon: LucideIcon;
  tone: string;
};

const partnerIcons: Record<string, LucideIcon> = {
  group: UsersRound,
  corporate: Building2,
  dealership: Store,
  individual: UserRound,
  posp: BriefcaseBusiness,
  misp: Landmark,
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  const dashboard = await getOperationsDashboardData(supabase);
  const displayName = firstName(profile?.full_name) || "Operations Team";
  const canCreateRecords = canManageMasterData(profile?.role);

  const metrics: Metric[] = [
    {
      label: "Customer portfolio",
      value: dashboard.totals.customers,
      supporting: `${dashboard.totals.activeCustomers} active · ${dashboard.totals.newCustomers} new in 30 days`,
      href: "/customers",
      icon: UsersRound,
      gradient: "from-[#6759ff] via-[#7568ff] to-[#988cff]",
      glow: "bg-[#6759ff]/20",
    },
    {
      label: "Fleet under management",
      value: dashboard.totals.vehicles,
      supporting: `${dashboard.totals.policies} policies · ${dashboard.totals.activePolicies} currently valid`,
      href: "/vehicles",
      icon: CarFront,
      gradient: "from-[#0e9fa8] via-[#17bfc5] to-[#5edbd2]",
      glow: "bg-[#17c7c9]/20",
    },
    {
      label: "Renewal exposure",
      value: dashboard.totals.expiringPolicies + dashboard.totals.expiredPolicies,
      supporting: `${dashboard.totals.expiringPolicies} due soon · ${dashboard.totals.expiredPolicies} expired`,
      href: "/policies",
      icon: CalendarDays,
      gradient: "from-[#df8d28] via-[#f1b94a] to-[#ffd477]",
      glow: "bg-[#f1b94a]/20",
    },
    {
      label: "Open claims",
      value: dashboard.totals.openClaims,
      supporting: `${dashboard.totals.recentClaims} reported in 30 days · ${dashboard.totals.claims} total`,
      href: "/claims",
      icon: ShieldCheck,
      gradient: "from-[#ec5c51] via-[#ff6f61] to-[#ff9b74]",
      glow: "bg-[#ff6f61]/20",
    },
  ];

  const focusItems: FocusItem[] = [
    { label: "KYC applications", value: dashboard.attention.onboarding, detail: `${dashboard.attention.submittedOnboarding} submitted · ${dashboard.attention.changesRequested} corrections`, href: "/customers/applications", icon: FileCheck2, tone: "bg-[#eeeaff] text-[#5b4ce5]" },
    { label: "Expired policies", value: dashboard.totals.expiredPolicies, detail: "Immediate coverage review", href: "/policies", icon: FileWarning, tone: "bg-[#fff0ed] text-[#d94e44]" },
    { label: "Overdue tasks", value: dashboard.attention.overdueTasks, detail: `${dashboard.attention.openTasks} open follow-ups`, href: "/tasks", icon: Clock3, tone: "bg-[#fff7e5] text-[#bc7d12]" },
    { label: "Documents to review", value: dashboard.attention.documents, detail: "Pending or returned files", href: "/documents", icon: BellRing, tone: "bg-[#e7fbfa] text-[#078f93]" },
  ];

  return (
    <ClaimManagerShell title="Operations Dashboard" activeNav="dashboard">
      <div className="mx-auto max-w-[1540px] space-y-5 pb-8">
        <section className="relative overflow-hidden rounded-[28px] bg-[#111a35] px-5 py-5 text-white shadow-[0_28px_80px_rgba(17,26,53,.24)] sm:px-7 sm:py-6 lg:px-8">
          <div className="portal-grid pointer-events-none absolute inset-0 opacity-30" />
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#6759ff]/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-[38%] h-72 w-72 rounded-full bg-[#17c7c9]/20 blur-3xl" />
          <div className="relative flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <h1 className="portal-display text-[31px] font-semibold leading-[1.05] sm:text-[38px] lg:text-[44px]">
              Good {dayPeriod()}, <span className="bg-gradient-to-r from-white via-[#dcd8ff] to-[#77e1dc] bg-clip-text text-transparent">{displayName}</span>
            </h1>
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/12 bg-white/8 px-3.5 text-[10.5px] font-semibold text-white/78 backdrop-blur"><CalendarDays className="h-4 w-4 text-[#75e5dd]" />{dashboardDateLabel()}</div>
              {canCreateRecords ? <>
                <Link href="/customers?choose_partner=1" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/15 bg-white px-3.5 text-[10.5px] font-bold text-[#17213e] shadow-lg hover:-translate-y-0.5"><Plus className="h-4 w-4" />New customer</Link>
                <Link href="/customers/applications" className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-[#6759ff] to-[#17bfc5] px-3.5 text-[10.5px] font-bold text-white shadow-[0_12px_30px_rgba(103,89,255,.35)] hover:-translate-y-0.5"><CheckCircle2 className="h-4 w-4" />Review KYC</Link>
              </> : null}
            </div>
          </div>
        </section>

        {dashboard.errors.length ? <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-[10.5px] text-amber-900 shadow-sm"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="font-bold">Some figures are temporarily unavailable.</p><p className="mt-0.5 text-amber-800">{dashboard.errors.join(" ")}</p></div></section> : null}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Business summary">
          {metrics.map((metric, index) => <MetricCard key={metric.label} metric={metric} delay={index * 70} />)}
        </section>

        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,.8fr)]">
          <div className="portal-card p-4 sm:p-5">
            <SectionTitle eyebrow="Priority radar" title="Needs your attention" href="/notifications" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {focusItems.map((item) => <FocusCard key={item.label} item={item} />)}
            </div>
            {dashboard.attention.highPriorityActivity > 0 ? <Link href="/notifications" className="mt-4 flex items-center justify-between rounded-2xl border border-[#ffd6d0] bg-gradient-to-r from-[#fff6f4] to-[#fffaf8] px-4 py-3 text-[10.5px] font-bold text-[#bd4139]"><span>{dashboard.attention.highPriorityActivity} high-priority customer updates require attention</span><ArrowUpRight className="h-4 w-4" /></Link> : null}
          </div>

          <div className="portal-card p-4 sm:p-5">
            <SectionTitle eyebrow="Portfolio shape" title="Account mix" href="/customers" />
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {dashboard.portfolio.map((item) => <PortfolioCard key={item.key} item={item} />)}
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <ActivityList title="Recent applications" eyebrow="Onboarding" href="/customers/applications" rows={dashboard.recentApplications.map((row) => ({ id: row.id, href: `/customers/applications/${row.id}`, title: applicationName(row), subtitle: `${partnerLabel(row.partner_type)} · ${row.applicant_phone ?? row.applicant_email ?? "Contact not recorded"}`, status: row.status, updatedAt: row.updated_at }))} />
          <ActivityList title="Latest claim movement" eyebrow="Claims" href="/claims" rows={dashboard.latestClaims.map((row) => ({ id: row.id, href: `/claims/${row.id}`, title: row.vehicles?.vehicle_no ?? row.claim_no, subtitle: `${row.customers?.company_name ?? row.customers?.contact_name ?? "Customer unavailable"} · ${row.claim_no}`, status: row.current_status, updatedAt: row.updated_at }))} />
        </section>
      </div>
    </ClaimManagerShell>
  );
}

function MetricCard({ metric, delay }: { metric: Metric; delay: number }) {
  const Icon = metric.icon;
  return <Link href={metric.href} style={{ animationDelay: `${delay}ms` }} className="portal-card portal-card-hover group animate-portal-enter p-4 sm:p-5">
    <div className={`pointer-events-none absolute -right-12 -top-14 h-36 w-36 rounded-full ${metric.glow} blur-3xl`} />
    <div className="relative flex items-start justify-between gap-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#7a879a]">{metric.label}</p><p className="portal-display mt-3 text-[32px] font-semibold leading-none text-[#13203b]">{metric.value.toLocaleString("en-IN")}</p></div><span className={`grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br ${metric.gradient} text-white shadow-[0_14px_28px_rgba(37,48,78,.18)] transition group-hover:-rotate-3 group-hover:scale-105`}><Icon className="h-5 w-5" /></span></div>
    <div className="relative mt-5 flex items-end justify-between gap-3 border-t border-[#edf0f5] pt-3"><p className="text-[9.8px] leading-4 text-[#718096]">{metric.supporting}</p><ArrowUpRight className="h-4 w-4 shrink-0 text-[#9aa5b6] group-hover:text-[#6759ff]" /></div>
  </Link>;
}

function FocusCard({ item }: { item: FocusItem }) {
  const Icon = item.icon;
  return <Link href={item.href} className="group flex items-center gap-3 rounded-2xl border border-[#e5e9f0] bg-[#fafbfe] p-3.5 hover:-translate-y-0.5 hover:border-[#d4cffb] hover:bg-white hover:shadow-[0_14px_32px_rgba(29,40,70,.08)]"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${item.tone}`}><Icon className="h-[18px] w-[18px]" /></span><div className="min-w-0 flex-1"><div className="flex items-baseline justify-between gap-2"><p className="truncate text-[10.5px] font-bold text-[#1b2943]">{item.label}</p><p className="portal-display text-[22px] font-semibold text-[#14213c]">{item.value}</p></div><p className="mt-0.5 truncate text-[9.5px] text-[#7b879a]">{item.detail}</p></div></Link>;
}

function PortfolioCard({ item }: { item: OperationsDashboardData["portfolio"][number] }) {
  const Icon = partnerIcons[item.key] ?? Building2;
  return <div className="group rounded-2xl border border-[#e5e9f0] bg-[#fafbfe] p-3 hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_12px_28px_rgba(29,40,70,.07)]"><div className="flex items-center justify-between"><span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-[#eeeaff] to-[#e5fbfa] text-[#6759ff]"><Icon className="h-4 w-4" /></span><p className="portal-display text-[21px] font-semibold text-[#14213c]">{item.value}</p></div><p className="mt-3 truncate text-[9.5px] font-semibold text-[#718096]">{item.label}</p></div>;
}

function ActivityList({ title, eyebrow, href, rows }: { title: string; eyebrow: string; href: string; rows: Array<{ id: string; href: string; title: string; subtitle: string; status: string; updatedAt: string }> }) {
  return <section className="portal-card overflow-hidden"><div className="p-4 sm:p-5"><SectionTitle eyebrow={eyebrow} title={title} href={href} /></div><div className="divide-y divide-[#edf0f5] border-t border-[#edf0f5]">{rows.length ? rows.map((row) => <Link key={row.id} href={row.href} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3.5 hover:bg-[#fafbff] sm:px-5"><div className="min-w-0"><p className="truncate text-[11px] font-bold text-[#1b2943]">{row.title}</p><p className="mt-0.5 truncate text-[9.5px] text-[#7b879a]">{row.subtitle}</p></div><div className="text-right"><StatusPill status={row.status} /><p className="mt-1 text-[8.8px] font-medium text-[#9aa5b6]">{relativeTime(row.updatedAt)}</p></div></Link>) : <div className="px-5 py-12 text-center text-[10.5px] text-[#7b879a]">No records available.</div>}</div></section>;
}

function SectionTitle({ eyebrow, title, href }: { eyebrow: string; title: string; href: string }) {
  return <div className="flex items-start justify-between gap-4"><div><p className="text-[8.5px] font-black uppercase tracking-[0.16em] text-[#6759ff]">{eyebrow}</p><h2 className="mt-1 text-[16px] font-semibold text-[#14213c]">{title}</h2></div><Link href={href} className="inline-flex items-center gap-1 rounded-xl border border-[#e1e5ed] bg-white px-2.5 py-1.5 text-[9px] font-bold text-[#5f6d82] hover:border-[#cfc8ff] hover:text-[#6759ff]">Open<ArrowUpRight className="h-3.5 w-3.5" /></Link></div>;
}

function StatusPill({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const className = normalized.includes("approved") || normalized.includes("complete") || normalized.includes("settled") ? "border-emerald-200 bg-emerald-50 text-emerald-700" : normalized.includes("reject") || normalized.includes("changes") || normalized.includes("expired") ? "border-rose-200 bg-rose-50 text-rose-700" : normalized.includes("progress") || normalized.includes("submitted") || normalized.includes("intimat") ? "border-blue-200 bg-blue-50 text-blue-700" : "border-amber-200 bg-amber-50 text-amber-700";
  return <span className={`inline-flex max-w-[170px] truncate rounded-full border px-2 py-0.5 text-[8.5px] font-bold capitalize ${className}`}>{status.replaceAll("_", " ")}</span>;
}

function applicationName(row: OperationsDashboardData["recentApplications"][number]) { return row.display_name ?? row.applicant_phone ?? row.applicant_email ?? "Unnamed application"; }
function partnerLabel(value: string | null) { const labels: Record<string, string> = { group: "Group", corporate: "Corporate", dealership: "Dealership", individual_proprietor: "Individual / Proprietor", posp: "POSP", misp: "MISP" }; return value ? labels[value] ?? value : "Partner type pending"; }
function dashboardDateLabel() { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", weekday: "short", timeZone: "Asia/Kolkata" }).format(new Date()); }
function dayPeriod() { const hour = Number(new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date())); if (hour < 12) return "morning"; if (hour < 17) return "afternoon"; return "evening"; }
function firstName(name?: string | null) { return name?.trim().split(/\s+/)[0] ?? ""; }
function relativeTime(value: string) { const diffMs = Date.now() - Date.parse(value); if (!Number.isFinite(diffMs)) return "-"; const minutes = Math.max(0, Math.floor(diffMs / 60000)); if (minutes < 1) return "Just now"; if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); return days === 1 ? "1d ago" : `${days}d ago`; }
