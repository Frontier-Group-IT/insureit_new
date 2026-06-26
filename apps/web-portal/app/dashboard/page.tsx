import Link from "next/link";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getManagerDashboardData, type DashboardActivityRow } from "@/lib/manager-dashboard";
import { ActivityHandledButton, ActivitySeenButton, ActivityWorkButton } from "./activity-status-buttons";

type BroadTaskCard = {
  key: string;
  label: string;
  value: number;
  href: string;
  icon: string;
  tone: "blue" | "amber" | "purple" | "green" | "rose" | "orange";
  hint: string;
};

type WorkflowGroup = {
  key: string;
  label: string;
  count: number;
  oldestLabel: string;
  href: string;
};

type TaskSummary = {
  total: number;
  completed: number;
  inProgress: number;
  pending: number;
  overdue: number;
};

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  const dashboard = await getManagerDashboardData(supabase);

  const displayName = firstName(profile?.full_name) || "Operations Team";
  const broadTasks = buildBroadTaskCards(dashboard);
  const workflowGroups = buildWorkflowGroups(dashboard);
  const taskSummary = buildTaskSummary(dashboard, broadTasks, workflowGroups);
  const recentTasks = dashboard.actionRows.slice(0, 5);
  const alerts = buildAlerts(dashboard, workflowGroups);
  const overdueItems = buildOverdueItems(workflowGroups);

  return (
    <ClaimManagerShell title="Operations Dashboard" activeNav="dashboard">
      <div className="space-y-4 pb-8">
        <section className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[24px] font-semibold leading-8 tracking-[-0.02em] text-[#0f172a]">Welcome back, {displayName}! 👋</h1>
            <p className="mt-1 text-[13px] text-[#64748b]">Here&apos;s your snapshot of today&apos;s operations and key updates.</p>
          </div>
          <div className="flex h-10 items-center gap-2 rounded-xl border border-[#e2e8f0] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm">
            <span className="text-[15px]">▦</span>
            <span>{dashboardDateLabel()}</span>
            <span className="text-[#94a3b8]">⌄</span>
          </div>
        </section>

        {dashboard.errors.length ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] leading-5 text-amber-800">
            {dashboard.errors.map((error) => <p key={error}>{error}</p>)}
          </div>
        ) : null}

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:col-span-9 xl:grid-cols-4">
            {broadTasks.slice(0, 4).map((card) => <BroadTaskCard key={card.key} card={card} />)}
            {broadTasks.slice(4).map((card) => <BroadTaskCard key={card.key} card={card} wide />)}
          </div>
          <TodaySummary summary={taskSummary} />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <ClaimsTrendPanel workflowGroups={workflowGroups} />
          <RecentTasksPanel rows={recentTasks} />
          <AlertsPanel alerts={alerts} />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <PendingSummaryPanel workflowGroups={workflowGroups} />
          <AmountByCategoryPanel workflowGroups={workflowGroups} />
          <OverdueItemsPanel items={overdueItems} />
        </section>
      </div>
    </ClaimManagerShell>
  );
}

function BroadTaskCard({ card, wide = false }: { card: BroadTaskCard; wide?: boolean }) {
  return (
    <Link href={card.href} className={`group rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${wide ? "xl:col-span-2" : ""}`}>
      <div className="flex items-center gap-4">
        <div className={`grid h-14 w-14 shrink-0 place-items-center rounded-full text-[25px] ${iconTone(card.tone)}`}>{card.icon}</div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="line-clamp-2 text-[12px] font-semibold leading-4 text-[#334155]">{card.label}</p>
              <p className="mt-1 text-[27px] font-semibold leading-none tracking-[-0.02em] text-[#0f172a]">{card.value}</p>
            </div>
            <span className="mt-5 text-[22px] text-[#94a3b8] transition group-hover:translate-x-0.5 group-hover:text-[#0f172a]">›</span>
          </div>
          <p className="mt-3 text-[11px] font-medium text-emerald-600">{card.hint}</p>
        </div>
      </div>
    </Link>
  );
}

function TodaySummary({ summary }: { summary: TaskSummary }) {
  return (
    <aside className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm xl:col-span-3">
      <h2 className="text-[14px] font-semibold text-[#0f172a]">Today&apos;s Summary</h2>
      <div className="mt-4 space-y-3 text-[12px]">
        <SummaryLine label="Total Tasks" value={summary.total} tone="slate" />
        <SummaryLine label="Completed" value={summary.completed} tone="green" />
        <SummaryLine label="In Progress" value={summary.inProgress} tone="blue" />
        <SummaryLine label="Overdue" value={summary.overdue} tone="red" />
      </div>
      <div className="mt-4 border-t border-[#e2e8f0] pt-4">
        <h3 className="text-[12px] font-semibold text-[#0f172a]">Tasks by Status</h3>
        <div className="mt-3 flex items-center gap-4">
          <div className="relative grid h-24 w-24 place-items-center rounded-full bg-[conic-gradient(#22c55e_0_37%,#2563eb_37%_80%,#f97316_80%_100%)]">
            <div className="grid h-14 w-14 place-items-center rounded-full bg-white text-center shadow-inner">
              <span className="text-[16px] font-semibold leading-none text-[#0f172a]">{summary.total}</span>
              <span className="text-[10px] text-[#64748b]">Total</span>
            </div>
          </div>
          <div className="space-y-2 text-[11px] text-[#475569]">
            <LegendDot label={`Completed ${summary.completed}`} color="bg-emerald-500" />
            <LegendDot label={`In Progress ${summary.inProgress}`} color="bg-blue-600" />
            <LegendDot label={`Pending ${summary.pending}`} color="bg-orange-500" />
          </div>
        </div>
      </div>
    </aside>
  );
}

function ClaimsTrendPanel({ workflowGroups }: { workflowGroups: WorkflowGroup[] }) {
  const total = workflowGroups.reduce((sum, group) => sum + group.count, 0);
  const completed = workflowGroups.find((group) => group.key === "closed")?.count ?? 0;
  const pending = Math.max(total - completed, 0);

  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm xl:col-span-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-semibold text-[#0f172a]">Claims Trend <span className="text-[11px] font-medium text-[#64748b]">(Current Snapshot)</span></h2>
        <span className="rounded-lg border border-[#e2e8f0] px-2 py-1 text-[11px] font-medium text-[#475569]">Today</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <TrendMetric label="Total" value={total} tone="blue" />
        <TrendMetric label="Completed" value={completed} tone="green" />
        <TrendMetric label="Pending" value={pending} tone="orange" />
      </div>
      <div className="mt-4 h-28 rounded-xl border border-[#e2e8f0] bg-gradient-to-b from-[#f8fafc] to-white p-3">
        <svg viewBox="0 0 360 100" className="h-full w-full" role="img" aria-label="Claims trend chart placeholder">
          <path d="M0 80 L360 80" stroke="#e2e8f0" strokeWidth="1" />
          <path d="M0 55 L360 55" stroke="#e2e8f0" strokeWidth="1" />
          <path d="M0 30 L360 30" stroke="#e2e8f0" strokeWidth="1" />
          <polyline points="5,78 65,58 125,38 185,62 245,35 305,48 355,30" fill="none" stroke="#2563eb" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <polyline points="5,88 65,75 125,70 185,78 245,60 305,66 355,54" fill="none" stroke="#22c55e" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <Link href="/claims" className="mt-3 inline-flex text-[12px] font-semibold text-[#0b4db3] hover:underline">View Full Report →</Link>
    </section>
  );
}

function RecentTasksPanel({ rows }: { rows: DashboardActivityRow[] }) {
  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm xl:col-span-5">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
        <h2 className="text-[14px] font-semibold text-[#0f172a]">Recent Tasks</h2>
        <Link href="/dashboard#recent-tasks" className="text-[11px] font-semibold text-[#0b4db3] hover:underline">View All</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[620px] border-collapse text-left">
          <thead className="bg-[#f8fafc] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
            <tr>
              <th className="px-4 py-2.5">Task</th>
              <th className="px-4 py-2.5">Reference ID</th>
              <th className="px-4 py-2.5">Priority</th>
              <th className="px-4 py-2.5">Due</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {rows.length ? rows.map((row) => (
              <tr key={row.id} className="hover:bg-[#f8fafc]">
                <td className="px-4 py-2.5 text-[12px] font-medium text-[#0f172a]">{taskTitle(row)}</td>
                <td className="px-4 py-2.5 font-mono text-[11px] text-[#64748b]">{claimNumber(row)}</td>
                <td className="px-4 py-2.5"><PriorityBadge priority={row.priority} /></td>
                <td className="px-4 py-2.5 text-[11px] text-[#64748b]">{relativeTime(row.created_at)}</td>
                <td className="px-4 py-2.5"><StatusPill status={row.status} /></td>
                <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1"><Link href={actionHref(row)} className="rounded border border-[#e2e8f0] px-2 py-1 text-[11px] font-medium text-[#0f172a] hover:bg-[#f1f5f9]">Open</Link>{row.status === "new" ? <ActivitySeenButton activityId={row.id} /> : null}<ActivityWorkButton activityId={row.id} /><ActivityHandledButton activityId={row.id} /></div></td>
              </tr>
            )) : <tr><td colSpan={6} className="px-4 py-8 text-center text-[12px] text-[#64748b]">No recent tasks pending.</td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AlertsPanel({ alerts }: { alerts: ReturnType<typeof buildAlerts> }) {
  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm xl:col-span-3">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3">
        <h2 className="text-[14px] font-semibold text-[#0f172a]">Alerts & Updates</h2>
        <Link href="/dashboard#alerts" className="text-[11px] font-semibold text-[#0b4db3] hover:underline">View All</Link>
      </div>
      <div className="divide-y divide-[#e2e8f0]">
        {alerts.map((alert) => (
          <Link key={alert.key} href={alert.href} className="flex items-center gap-3 px-4 py-3 transition hover:bg-[#f8fafc]">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[17px] ${alertTone(alert.tone)}`}>{alert.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="line-clamp-2 text-[12px] font-medium leading-5 text-[#334155]">{alert.title}</span>
              <span className="mt-0.5 block text-[11px] font-semibold text-[#0b4db3]">{alert.action}</span>
            </span>
            <span className="text-[#94a3b8]">›</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function PendingSummaryPanel({ workflowGroups }: { workflowGroups: WorkflowGroup[] }) {
  const rows = workflowGroups.filter((group) => group.key !== "closed").slice(0, 4);
  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm xl:col-span-6">
      <div className="border-b border-[#e2e8f0] px-4 py-3"><h2 className="text-[14px] font-semibold text-[#0f172a]">Pending Task Summary</h2></div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead className="bg-[#f8fafc] text-[10px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
            <tr><th className="px-4 py-2.5">Category</th><th className="px-4 py-2.5 text-right">Count</th><th className="px-4 py-2.5 text-right">0-7 Days</th><th className="px-4 py-2.5 text-right">8-15 Days</th><th className="px-4 py-2.5 text-right">16-30 Days</th><th className="px-4 py-2.5 text-right">&gt; 30 Days</th></tr>
          </thead>
          <tbody className="divide-y divide-[#e2e8f0]">
            {rows.map((row) => <PendingSummaryRow key={row.key} row={row} />)}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function AmountByCategoryPanel({ workflowGroups }: { workflowGroups: WorkflowGroup[] }) {
  const total = workflowGroups.filter((group) => group.key !== "closed").reduce((sum, group) => sum + group.count, 0);
  const approval = workflowGroups.find((group) => group.key === "approval")?.count ?? 0;
  const delivery = workflowGroups.find((group) => group.key === "delivery-order")?.count ?? 0;
  const payment = workflowGroups.find((group) => group.key === "payment")?.count ?? 0;
  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white p-4 shadow-sm xl:col-span-3">
      <div className="mb-4 flex items-center justify-between"><h2 className="text-[14px] font-semibold text-[#0f172a]">Tasks by Category</h2><Link href="/claims" className="text-[11px] font-semibold text-[#0b4db3] hover:underline">View Report</Link></div>
      <div className="flex items-center gap-4">
        <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full bg-[conic-gradient(#7c3aed_0_30%,#f97316_30%_55%,#22c55e_55%_100%)]">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-white text-center shadow-inner"><span className="text-[16px] font-semibold leading-none text-[#0f172a]">{total}</span><span className="text-[10px] text-[#64748b]">Total</span></div>
        </div>
        <div className="space-y-2 text-[11px] text-[#475569]">
          <LegendDot label={`Approval ${approval}`} color="bg-violet-600" />
          <LegendDot label={`Delivery Order ${delivery}`} color="bg-orange-500" />
          <LegendDot label={`Payment ${payment}`} color="bg-emerald-500" />
        </div>
      </div>
    </section>
  );
}

function OverdueItemsPanel({ items }: { items: ReturnType<typeof buildOverdueItems> }) {
  return (
    <section className="rounded-2xl border border-[#e2e8f0] bg-white shadow-sm xl:col-span-3">
      <div className="flex items-center justify-between border-b border-[#e2e8f0] px-4 py-3"><h2 className="text-[14px] font-semibold text-[#0f172a]">Top Overdue Items</h2><Link href="/claims" className="text-[11px] font-semibold text-[#0b4db3] hover:underline">View All</Link></div>
      <div className="divide-y divide-[#e2e8f0]">
        {items.length ? items.map((item) => (
          <Link key={item.key} href={item.href} className="grid grid-cols-[1fr_auto] gap-2 px-4 py-2.5 transition hover:bg-[#f8fafc]">
            <div><p className="text-[12px] font-medium text-[#0f172a]">{item.label}</p><p className="font-mono text-[11px] text-[#64748b]">{item.reference}</p></div>
            <div className="text-right"><p className="text-[11px] font-semibold text-rose-600">{item.days} Days</p><p className="text-[11px] text-[#64748b]">{item.count} cases</p></div>
          </Link>
        )) : <div className="px-4 py-8 text-center text-[12px] text-[#64748b]">No overdue items found.</div>}
      </div>
    </section>
  );
}

function buildBroadTaskCards(dashboard: Awaited<ReturnType<typeof getManagerDashboardData>>): BroadTaskCard[] {
  const count = journeyCounter(dashboard);
  const closed = count("journey-complete");
  const allWorkflowClaims = dashboard.journeyKpis.reduce((total, item) => total + item.count, 0);
  const openClaims = Math.max(allWorkflowClaims - closed, 0);

  return [
    { key: "vehicle-intimated", label: "Vehicle Claims Intimated", value: openClaims, href: "/claims", icon: "🚚", tone: "blue", hint: "+ from current workflow" },
    { key: "spot-deputation", label: "Spot Deputation Pending", value: count("loss-report", "spot-intimation", "spot-surveyor-assigned", "spot-survey-completed"), href: "/claims?journey=spot-intimation", icon: "👷", tone: "amber", hint: "survey assignment" },
    { key: "claim-intimation", label: "Claim Intimation Pending", value: count("final-documents", "claim-intimation"), href: "/claims?journey=claim-intimation", icon: "📋", tone: "purple", hint: "insurer process" },
    { key: "work-approval", label: "Work Approval Pending", value: count("work-approval"), href: "/claims?journey=work-approval", icon: "✅", tone: "green", hint: "approval follow-up" },
    { key: "reinspection", label: "Re-Inspection Pending", value: count("final-surveyor", "ri-stage"), href: "/claims?journey=final-surveyor", icon: "🔍", tone: "blue", hint: "survey follow-up" },
    { key: "delivery-order", label: "Delivery Order Pending", value: count("do-stage", "vehicle-release"), href: "/claims?journey=do-stage", icon: "📄", tone: "orange", hint: "release stage" },
    { key: "payment", label: "Payment Pending", value: count("payment-advice-received"), href: "/claims?journey=payment-advice-received", icon: "💼", tone: "rose", hint: "settlement stage" }
  ];
}

function buildWorkflowGroups(dashboard: Awaited<ReturnType<typeof getManagerDashboardData>>): WorkflowGroup[] {
  const stage = (key: string) => dashboard.journeyKpis.find((item) => item.key === key);
  const count = (...keys: string[]) => keys.reduce((total, key) => total + (stage(key)?.count ?? 0), 0);
  const oldest = (...keys: string[]) => oldestLabel(keys.map((key) => stage(key)?.oldestAgeLabel).filter(Boolean) as string[]);
  return [
    { key: "initial-docs", label: "Initial Documents", count: count("loss-report", "spot-intimation"), oldestLabel: oldest("loss-report", "spot-intimation"), href: "/claims?journey=spot-intimation" },
    { key: "survey", label: "Survey / Re-Inspection", count: count("spot-surveyor-assigned", "spot-survey-completed", "final-surveyor", "ri-stage"), oldestLabel: oldest("spot-surveyor-assigned", "spot-survey-completed", "final-surveyor", "ri-stage"), href: "/claims?journey=spot-surveyor-assigned" },
    { key: "claim-intimation", label: "Claim Intimation", count: count("final-documents", "claim-intimation"), oldestLabel: oldest("final-documents", "claim-intimation"), href: "/claims?journey=claim-intimation" },
    { key: "approval", label: "Work Approval", count: count("work-approval"), oldestLabel: oldest("work-approval"), href: "/claims?journey=work-approval" },
    { key: "repair", label: "Repair", count: count("under-repair"), oldestLabel: oldest("under-repair"), href: "/claims?journey=under-repair" },
    { key: "delivery-order", label: "Delivery Order", count: count("do-stage", "vehicle-release"), oldestLabel: oldest("do-stage", "vehicle-release"), href: "/claims?journey=do-stage" },
    { key: "payment", label: "Payment", count: count("payment-advice-received"), oldestLabel: oldest("payment-advice-received"), href: "/claims?journey=payment-advice-received" },
    { key: "closed", label: "Closed", count: count("journey-complete"), oldestLabel: oldest("journey-complete"), href: "/claims?queue=closed" }
  ];
}

function buildTaskSummary(dashboard: Awaited<ReturnType<typeof getManagerDashboardData>>, broadTasks: BroadTaskCard[], workflowGroups: WorkflowGroup[]): TaskSummary {
  const total = broadTasks.reduce((sum, task) => sum + task.value, 0) + dashboard.actionRows.length;
  const overdue = workflowGroups.filter((group) => oldestAgeDays(group.oldestLabel) >= 7).reduce((sum, group) => sum + group.count, 0);
  const inProgress = dashboard.actionRows.filter((row) => row.status === "in_progress").length + broadTasks.filter((task) => task.value > 0).length;
  const completed = workflowGroups.find((group) => group.key === "closed")?.count ?? 0;
  const pending = Math.max(total - inProgress - completed, 0);
  return { total, completed, inProgress, pending, overdue };
}

function buildAlerts(dashboard: Awaited<ReturnType<typeof getManagerDashboardData>>, workflowGroups: WorkflowGroup[]) {
  const delayedCount = workflowGroups.filter((group) => oldestAgeDays(group.oldestLabel) >= 7).reduce((sum, group) => sum + group.count, 0);
  return [
    { key: "delayed", title: `${delayedCount} claims are pending for more than 7 days`, action: "Review now", href: "/claims", tone: "red" as const, icon: "🔔" },
    { key: "actions", title: `${dashboard.actionRows.length} manager actions need attention`, action: "Open action list", href: "/dashboard#recent-tasks", tone: "amber" as const, icon: "⚠" },
    { key: "activity", title: `${dashboard.activityFeed.length} recent customer updates captured`, action: "View activity", href: "/dashboard#activity", tone: "blue" as const, icon: "ⓘ" }
  ];
}

function buildOverdueItems(workflowGroups: WorkflowGroup[]) {
  return workflowGroups
    .filter((group) => oldestAgeDays(group.oldestLabel) > 0)
    .sort((a, b) => oldestAgeDays(b.oldestLabel) - oldestAgeDays(a.oldestLabel))
    .slice(0, 5)
    .map((group, index) => ({ key: group.key, label: group.label, reference: `CLM-QUEUE-${String(index + 1).padStart(3, "0")}`, days: oldestAgeDays(group.oldestLabel), count: group.count, href: group.href }));
}

function PendingSummaryRow({ row }: { row: WorkflowGroup }) {
  const days = oldestAgeDays(row.oldestLabel);
  const bucket0 = days <= 7 ? row.count : 0;
  const bucket8 = days > 7 && days <= 15 ? row.count : 0;
  const bucket16 = days > 15 && days <= 30 ? row.count : 0;
  const bucket30 = days > 30 ? row.count : 0;
  return <tr className="text-[12px] text-[#334155]"><td className="px-4 py-2.5 font-medium text-[#0f172a]">{row.label}</td><td className="px-4 py-2.5 text-right font-semibold">{row.count}</td><td className="px-4 py-2.5 text-right">{bucket0}</td><td className="px-4 py-2.5 text-right">{bucket8}</td><td className="px-4 py-2.5 text-right">{bucket16}</td><td className="px-4 py-2.5 text-right">{bucket30}</td></tr>;
}

function journeyCounter(dashboard: Awaited<ReturnType<typeof getManagerDashboardData>>) { return (...keys: string[]) => keys.reduce((total, key) => total + (dashboard.journeyKpis.find((item) => item.key === key)?.count ?? 0), 0); }
function SummaryLine({ label, value, tone }: { label: string; value: number; tone: "slate" | "green" | "blue" | "red" }) { const colors = { slate: "text-[#0f172a]", green: "text-emerald-600", blue: "text-blue-600", red: "text-rose-600" }; return <div className="flex items-center justify-between"><span className="text-[#475569]">{label}</span><span className={`font-semibold ${colors[tone]}`}>{value}</span></div>; }
function TrendMetric({ label, value, tone }: { label: string; value: number; tone: "blue" | "green" | "orange" }) { const colors = { blue: "bg-blue-50 text-blue-700", green: "bg-emerald-50 text-emerald-700", orange: "bg-orange-50 text-orange-700" }; return <div className={`rounded-lg px-3 py-2 ${colors[tone]}`}><p className="text-[10px] font-semibold uppercase tracking-[0.08em]">{label}</p><p className="mt-1 text-[16px] font-semibold">{value}</p></div>; }
function LegendDot({ label, color }: { label: string; color: string }) { return <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${color}`} /><span>{label}</span></div>; }
function iconTone(tone: BroadTaskCard["tone"]) { const tones = { blue: "bg-blue-50 text-blue-700", amber: "bg-amber-50 text-amber-700", purple: "bg-violet-50 text-violet-700", green: "bg-emerald-50 text-emerald-700", rose: "bg-rose-50 text-rose-700", orange: "bg-orange-50 text-orange-700" }; return tones[tone]; }
function alertTone(tone: "red" | "amber" | "blue") { const tones = { red: "bg-rose-50 text-rose-600", amber: "bg-amber-50 text-amber-600", blue: "bg-blue-50 text-blue-600" }; return tones[tone]; }
function PriorityBadge({ priority }: { priority: DashboardActivityRow["priority"] }) { const className = priority === "critical" ? "bg-rose-50 text-rose-600" : priority === "high" ? "bg-rose-50 text-rose-600" : priority === "medium" ? "bg-amber-50 text-amber-600" : "bg-slate-100 text-slate-600"; return <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold capitalize ${className}`}>{priority}</span>; }
function StatusPill({ status }: { status: DashboardActivityRow["status"] }) { const className = status === "handled" ? "bg-emerald-50 text-emerald-700" : status === "in_progress" ? "bg-blue-50 text-blue-700" : "bg-orange-50 text-orange-700"; return <span className={`inline-flex rounded px-2 py-0.5 text-[10px] font-semibold capitalize ${className}`}>{status.replace("_", " ")}</span>; }
function taskTitle(row: DashboardActivityRow) { if (row.event_type.includes("document")) return "Verify claim documents"; if (row.event_type.includes("support")) return "Review customer reply"; if (row.event_type.includes("kyc")) return "Check KYC update"; return row.title; }
function oldestLabel(labels: string[]) { const days = labels.map((label) => oldestAgeDays(label)).filter((value) => value > 0); if (!labels.length) return "-"; if (!days.length) return labels.some((label) => label === "Updated today") ? "Today" : "-"; const max = Math.max(...days); return max === 1 ? "1 day" : `${max} days`; }
function oldestAgeDays(label: string) { const match = label.match(/(\d+) day/); return match ? Number(match[1]) : 0; }
function claimNumber(row: DashboardActivityRow) { return row.claims?.claim_no ?? metadataText(row, "claim_no") ?? "-"; }
function actionHref(row: DashboardActivityRow) { if (row.claim_id) return `/claims/${row.claim_id}`; if (row.support_ticket_id) return `/support/${row.support_ticket_id}`; if (row.customer_id) return `/customers/${row.customer_id}`; return "/dashboard"; }
function metadataText(row: DashboardActivityRow, key: string) { const value = row.metadata?.[key]; return typeof value === "string" || typeof value === "number" ? String(value) : null; }
function relativeTime(value: string) { const diffMs = Date.now() - Date.parse(value); if (!Number.isFinite(diffMs)) return "-"; const minutes = Math.max(0, Math.floor(diffMs / 60000)); if (minutes < 1) return "Just now"; if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); if (days === 1) return "1d ago"; return `${days}d ago`; }
function dashboardDateLabel() { return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric", weekday: "long", timeZone: "Asia/Kolkata" }).format(new Date()); }
function firstName(name?: string | null) { return name?.trim().split(/\s+/)[0] ?? ""; }