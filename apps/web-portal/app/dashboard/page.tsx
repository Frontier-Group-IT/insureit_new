import Link from "next/link";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getManagerDashboardData } from "@/lib/manager-dashboard";

type CommandKpi = {
  key: string;
  label: string;
  value: number;
  hint: string;
  href: string;
  tone: "navy" | "blue" | "amber" | "red" | "green" | "slate";
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  const dashboard = await getManagerDashboardData(supabase);

  const displayName = firstName(profile?.full_name) || "Manager";
  const greeting = greetingForIndiaTime();
  const commandKpis = buildCommandKpis(dashboard);

  return (
    <ClaimManagerShell title="Claim Manager Desk" activeNav="dashboard">
      <div className="space-y-4 pb-8">
        <section className="overflow-hidden rounded-2xl border border-[#DCE7F5] bg-white shadow-[0_10px_28px_rgba(7,29,73,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6EEF7] px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#174EA6]">Claim Manager Operations Desk</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-[#071D49]">{greeting}, {displayName}</h1>
              <p className="mt-0.5 text-[12.5px] text-[#68758A]">Use the workflow menu and notification inbox to manage claim work without overloading the dashboard.</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link href="/claims" className="inline-flex h-9 items-center rounded-lg bg-[#071D49] px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#12356C]">
                Open Claims Queue
              </Link>
            </div>
          </div>

          <div className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6" aria-label="Claim manager operational summary">
            {commandKpis.map((kpi) => <CommandKpiCard key={kpi.key} kpi={kpi} />)}
          </div>
        </section>

        {dashboard.errors.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-5 text-amber-800">
            {dashboard.errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        ) : null}

        <section className="rounded-2xl border border-[#DCE7F5] bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#071D49]">Claim Journey Overview</h2>
              <p className="mt-0.5 text-[11.5px] text-[#68758A]">Compact stage ageing view. Detailed actions now live in the notification inbox.</p>
            </div>
            <Link href="/claims" className="rounded-lg border border-[#D6E0EC] px-3 py-1.5 text-[11px] font-medium text-[#071D49] transition hover:border-[#174EA6] hover:bg-[#F3F7FD]">All claims</Link>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
            {dashboard.journeyKpis.map((card) => (
              <JourneyKpiCard key={card.key} href={`/claims?journey=${card.key}`} index={card.index} title={card.label} value={card.count} updatedCount={card.updatedCount} oldestAgeLabel={card.oldestAgeLabel} />
            ))}
          </div>
        </section>
      </div>
    </ClaimManagerShell>
  );
}

function buildCommandKpis(dashboard: Awaited<ReturnType<typeof getManagerDashboardData>>): CommandKpi[] {
  const journeyCount = (key: string) => dashboard.journeyKpis.find((stage) => stage.key === key)?.count ?? 0;
  const totalClaims = dashboard.journeyKpis.reduce((total, stage) => total + stage.count, 0);
  const closedClaims = journeyCount("journey-complete");
  const ageingRisk = dashboard.journeyKpis.filter((stage) => oldestAgeDays(stage.oldestAgeLabel) >= 7).reduce((total, stage) => total + stage.count, 0);

  return [
    { key: "open-claims", label: "Open Claims", value: Math.max(totalClaims - closedClaims, 0), hint: "All active claim stages", href: "/claims?queue=active", tone: "navy" },
    { key: "initial-docs", label: "Initial Docs", value: journeyCount("spot-intimation"), hint: "Beginning-stage document flow", href: "/claims?journey=spot-intimation", tone: "amber" },
    { key: "final-docs", label: "Final Docs", value: journeyCount("final-documents"), hint: "Later-stage document flow", href: "/claims?journey=final-documents", tone: "blue" },
    { key: "manager-action", label: "Notification Inbox", value: dashboard.actionRows.length, hint: "Grouped in top bar", href: "/dashboard#top", tone: "red" },
    { key: "ageing-risk", label: "Ageing Risk", value: ageingRisk, hint: "Stages pending 7+ days", href: "/claims", tone: "amber" },
    { key: "closed-claims", label: "Closed Claims", value: closedClaims, hint: "Completed journey cases", href: "/claims?queue=closed", tone: "green" }
  ];
}

function CommandKpiCard({ kpi }: { kpi: CommandKpi }) {
  const toneClass = {
    navy: "border-[#C7D6EA] bg-[#F8FBFF] text-[#071D49]",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    slate: "border-slate-200 bg-slate-50 text-slate-700"
  }[kpi.tone];

  return (
    <Link href={kpi.href} className={`group rounded-2xl border bg-white p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgba(7,29,73,0.08)] ${toneClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] opacity-80">{kpi.label}</p>
          <p className="mt-2 text-[28px] font-semibold leading-none tracking-tight">{kpi.value}</p>
        </div>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-white/75 text-[12px] font-bold shadow-[0_0_0_1px_rgba(7,29,73,0.06)]">→</span>
      </div>
      <p className="mt-2 truncate text-[11px] opacity-80 group-hover:opacity-100">{kpi.hint}</p>
    </Link>
  );
}

function JourneyKpiCard({ href, index, title, value, updatedCount, oldestAgeLabel }: { href: string; index: number; title: string; value: number; updatedCount: number; oldestAgeLabel: string }) {
  return (
    <Link href={href} className="group min-h-[96px] rounded-xl border border-[#E1E9F3] bg-[#FBFCFE] p-3 transition hover:-translate-y-0.5 hover:border-[#BFD0E5] hover:bg-white hover:shadow-[0_8px_18px_rgba(7,29,73,0.06)]">
      <div className="flex items-start justify-between gap-2">
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-[#EEF3F9] text-[10px] font-medium text-[#68758A]">{String(index).padStart(2, "0")}</span>
        <span className="text-[24px] font-semibold leading-none tracking-tight text-[#071D49]">{value}</span>
      </div>
      <h3 className="mt-2 line-clamp-2 text-[12.5px] font-medium leading-4 text-[#26364B]">{title}</h3>
      <div className="mt-2 flex items-center justify-between gap-2 text-[10.5px] text-[#7A8797]">
        <span>{oldestAgeLabel}</span>
        {updatedCount ? <span className="rounded-full bg-[#EEF6FF] px-1.5 py-0.5 text-[#174EA6]">{updatedCount} updates</span> : null}
      </div>
    </Link>
  );
}

function oldestAgeDays(label: string) {
  const match = label.match(/(\d+) day/);
  return match ? Number(match[1]) : 0;
}
function firstName(name?: string | null) { return name?.trim().split(/\s+/)[0] ?? ""; }
function greetingForIndiaTime() { const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date())); if (hour < 12) return "Good morning"; if (hour < 17) return "Good afternoon"; return "Good evening"; }
