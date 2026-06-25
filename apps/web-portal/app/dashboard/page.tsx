import Link from "next/link";
import { ClaimManagerShell } from "@/components/claim-manager/claim-manager-shell";
import { createServerSupabaseClient, getAuthenticatedProfile, getServerAccessToken } from "@/lib/auth-server";
import { getManagerDashboardData, type DashboardActivityRow } from "@/lib/manager-dashboard";
import { ActivityHandledButton, ActivitySeenButton, ActivityWorkButton } from "./activity-status-buttons";

type CommandKpi = {
  key: string;
  label: string;
  value: number;
  hint: string;
  href: string;
  tone: "navy" | "blue" | "amber" | "red" | "green" | "slate";
};

type ActionGroup = {
  key: string;
  label: string;
  count: number;
  urgentCount: number;
  oldestAt: string;
  href: string;
};

const previewLimit = 5;

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();
  const accessToken = await getServerAccessToken();
  const { profile } = await getAuthenticatedProfile(accessToken);
  const dashboard = await getManagerDashboardData(supabase);

  const displayName = firstName(profile?.full_name) || "Manager";
  const greeting = greetingForIndiaTime();
  const commandKpis = buildCommandKpis(dashboard);
  const actionGroups = buildActionGroups(dashboard.actionRows);
  const urgentActionRows = dashboard.actionRows.slice(0, previewLimit);
  const hiddenActionCount = Math.max(0, dashboard.actionRows.length - urgentActionRows.length);
  const recentActivities = dashboard.activityFeed.slice(0, previewLimit);
  const hiddenActivityCount = Math.max(0, dashboard.activityFeed.length - recentActivities.length);

  return (
    <ClaimManagerShell title="Claim Manager Desk" activeNav="dashboard">
      <div className="space-y-4 pb-8">
        <section className="overflow-hidden rounded-2xl border border-[#DCE7F5] bg-white shadow-[0_10px_28px_rgba(7,29,73,0.05)]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6EEF7] px-4 py-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#174EA6]">Claim Manager Operations Desk</p>
              <h1 className="mt-1 text-[22px] font-semibold tracking-tight text-[#071D49]">{greeting}, {displayName}</h1>
              <p className="mt-0.5 text-[12.5px] text-[#68758A]">Monitor pending claims, document verification, customer updates and closure flow from one command center.</p>
            </div>
            <Link href="/claims" className="inline-flex h-9 items-center rounded-lg bg-[#071D49] px-4 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#12356C]">
              Open Claims Queue
            </Link>
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

        <section className="rounded-2xl border border-[#DCE7F5] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[#E6EEF7] px-4 py-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#071D49]">Action Inbox Summary</h2>
              <p className="mt-0.5 text-[11.5px] text-[#68758A]">Grouped view of incoming work so the dashboard does not become a long activity dump.</p>
            </div>
            <span className="rounded-full bg-[#FFF4E5] px-2.5 py-1 text-[11px] font-semibold text-[#A85D00]">{dashboard.actionRows.length} pending</span>
          </div>
          <ActionInboxSummary groups={actionGroups} />
        </section>

        <section id="manager-action" className="rounded-2xl border border-[#DCE7F5] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[#E6EEF7] px-4 py-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#071D49]">Top Urgent Actions</h2>
              <p className="mt-0.5 text-[11.5px] text-[#68758A]">Showing the first {previewLimit} highest-priority items only. Use grouped summary to understand the full workload.</p>
            </div>
            <span className="rounded-full bg-[#F2F6FB] px-2.5 py-1 text-[11px] font-semibold text-[#68758A]">{hiddenActionCount ? `+${hiddenActionCount} more` : "Up to date"}</span>
          </div>
          <ManagerActionTable rows={urgentActionRows} totalCount={dashboard.actionRows.length} />
        </section>

        <section className="rounded-2xl border border-[#DCE7F5] bg-white p-3 shadow-sm">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#071D49]">Claim Journey Overview</h2>
              <p className="mt-0.5 text-[11.5px] text-[#68758A]">Operational stage ageing across the customer claim journey.</p>
            </div>
            <Link href="/claims" className="rounded-lg border border-[#D6E0EC] px-3 py-1.5 text-[11px] font-medium text-[#071D49] transition hover:border-[#174EA6] hover:bg-[#F3F7FD]">All claims</Link>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-7">
            {dashboard.journeyKpis.map((card) => (
              <JourneyKpiCard key={card.key} href={`/claims?journey=${card.key}`} index={card.index} title={card.label} value={card.count} updatedCount={card.updatedCount} oldestAgeLabel={card.oldestAgeLabel} />
            ))}
          </div>
        </section>

        <section id="customer-activity" className="rounded-2xl border border-[#DCE7F5] bg-white shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-[#E6EEF7] px-4 py-3">
            <div>
              <h2 className="text-[15px] font-semibold text-[#071D49]">Latest Customer Activity</h2>
              <p className="mt-0.5 text-[11.5px] text-[#68758A]">Showing latest {previewLimit} activities only so the dashboard stays readable.</p>
            </div>
            <span className="rounded-full bg-[#F2F6FB] px-2.5 py-1 text-[11px] font-semibold text-[#68758A]">{hiddenActivityCount ? `+${hiddenActivityCount} more` : "Latest only"}</span>
          </div>
          <ActivityFeed rows={recentActivities} totalCount={dashboard.activityFeed.length} />
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
    { key: "manager-action", label: "Manager Action", value: dashboard.actionRows.length, hint: "Needs manager response", href: "/dashboard#manager-action", tone: "red" },
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

function ActionInboxSummary({ groups }: { groups: ActionGroup[] }) {
  if (!groups.length) return <EmptyState title="No grouped action pending" message="Incoming document, support, KYC and customer updates will appear here as grouped work queues." />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-left text-[12px]">
        <thead className="bg-[#F6F9FD] text-[10.5px] uppercase tracking-[0.08em] text-[#68758A]">
          <tr>
            <th className="px-4 py-2.5 font-semibold">Work Group</th>
            <th className="px-4 py-2.5 font-semibold">Pending</th>
            <th className="px-4 py-2.5 font-semibold">Urgent</th>
            <th className="px-4 py-2.5 font-semibold">Oldest</th>
            <th className="px-4 py-2.5 text-right font-semibold">Action</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E8EEF6]">
          {groups.map((group) => (
            <tr key={group.key} className="hover:bg-[#FAFCFF]">
              <td className="px-4 py-2.5 font-semibold text-[#071D49]">{group.label}</td>
              <td className="px-4 py-2.5 text-[#4B596B]">{group.count}</td>
              <td className="px-4 py-2.5">{group.urgentCount ? <span className="rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10.5px] font-semibold text-red-700">{group.urgentCount} urgent</span> : <span className="text-[#7A8797]">-</span>}</td>
              <td className="px-4 py-2.5 text-[#68758A]">{relativeTime(group.oldestAt)}</td>
              <td className="px-4 py-2.5 text-right"><Link href={group.href} className="rounded-lg border border-[#D6E0EC] px-3 py-1.5 text-[11px] font-semibold text-[#071D49] transition hover:border-[#174EA6] hover:bg-[#F3F7FD]">Review</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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

function ManagerActionTable({ rows, totalCount }: { rows: DashboardActivityRow[]; totalCount: number }) {
  if (!rows.length) return <EmptyState title="No manager action pending" message="New customer uploads, replies, KYC updates and support activity will appear here." />;

  const hiddenCount = Math.max(0, totalCount - rows.length);

  return (
    <>
      <div className="overflow-x-auto">
        <table className="min-w-full border-collapse text-left text-[12px]">
          <thead className="bg-[#F6F9FD] text-[10.5px] uppercase tracking-[0.08em] text-[#68758A]">
            <tr>
              <th className="px-4 py-2.5 font-semibold">Priority</th>
              <th className="px-4 py-2.5 font-semibold">Claim Identity</th>
              <th className="px-4 py-2.5 font-semibold">Customer</th>
              <th className="px-4 py-2.5 font-semibold">Current Stage</th>
              <th className="px-4 py-2.5 font-semibold">Next Action</th>
              <th className="px-4 py-2.5 font-semibold">Age</th>
              <th className="px-4 py-2.5 text-right font-semibold">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E8EEF6]">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-[#FAFCFF]">
                <td className="px-4 py-2.5"><PriorityBadge priority={row.priority} /></td>
                <td className="px-4 py-2.5">
                  <p className="font-semibold tracking-tight text-[#071D49]">{row.vehicles?.vehicle_no ?? metadataText(row, "vehicle_no") ?? "Vehicle not linked"}</p>
                  <p className="mt-0.5 text-[10.5px] text-[#68758A]">Control: {row.claims?.claim_no ?? metadataText(row, "claim_no") ?? "-"}</p>
                  {row.claims?.insurer_claim_no ? <p className="text-[10.5px] text-[#68758A]">Claim: {row.claims.insurer_claim_no}</p> : null}
                </td>
                <td className="px-4 py-2.5 font-medium text-[#071D49]">{customerName(row)}</td>
                <td className="px-4 py-2.5 text-[#4B596B]">{row.claims?.current_status ?? metadataText(row, "current_status") ?? "-"}</td>
                <td className="max-w-[320px] px-4 py-2.5">
                  <p className="font-semibold text-[#26364B]">{row.title}</p>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-[#7A8797]">{row.message ?? eventLabel(row.event_type)}</p>
                  {row.status === "in_progress" ? <span className="mt-1 inline-flex rounded-full bg-[#EEF6FF] px-2 py-0.5 text-[10px] font-medium text-[#174EA6]">In progress</span> : null}
                </td>
                <td className="px-4 py-2.5 text-[#68758A]">{relativeTime(row.created_at)}</td>
                <td className="px-4 py-2.5 text-right"><div className="flex items-center justify-end gap-1.5"><Link href={actionHref(row)} className="rounded-lg bg-[#071D49] px-3 py-1.5 text-[11px] font-medium text-white transition hover:bg-[#12356C]">Open</Link><ActivityWorkButton activityId={row.id} /><ActivityHandledButton activityId={row.id} /></div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {hiddenCount ? <div className="border-t border-[#E8EEF6] px-4 py-2.5 text-center text-[11.5px] font-medium text-[#68758A]">{hiddenCount} more action{hiddenCount === 1 ? "" : "s"} hidden from dashboard preview. Use the grouped inbox summary above to decide what to review first.</div> : null}
    </>
  );
}

function ActivityFeed({ rows, totalCount }: { rows: DashboardActivityRow[]; totalCount: number }) {
  if (!rows.length) return <EmptyState title="No customer activity yet" message="After the Supabase migrations are applied, mobile app actions will start appearing here." />;

  const hiddenCount = Math.max(0, totalCount - rows.length);

  return (
    <>
      <div className="divide-y divide-[#E8EEF6]">
        {rows.map((row) => (
          <div key={row.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#FAFCFF]">
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#F2F6FB] text-[12px] font-semibold text-[#68758A]">{activityIcon(row.event_type)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1"><p className="text-[12.5px] font-semibold text-[#071D49]">{row.title}</p><PriorityBadge priority={row.priority} compact /><span className="text-[11px] text-[#7A8797]">{relativeTime(row.created_at)}</span><span className="rounded-full bg-[#F2F6FB] px-2 py-0.5 text-[10px] font-medium capitalize text-[#68758A]">{row.status.replace("_", " ")}</span></div>
              <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-5 text-[#5C6878]">{row.message ?? eventLabel(row.event_type)}</p>
              <p className="mt-1 text-[11px] text-[#7A8797]">{customerName(row)} {row.claims?.claim_no ? `· ${row.claims.claim_no}` : ""} {row.vehicles?.vehicle_no ? `· ${row.vehicles.vehicle_no}` : ""}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">{row.status === "new" ? <ActivitySeenButton activityId={row.id} /> : null}<Link href={actionHref(row)} className="rounded-lg border border-[#D6E0EC] px-3 py-1.5 text-[11px] font-medium text-[#071D49] transition hover:border-[#174EA6] hover:bg-[#F3F7FD]">View</Link></div>
          </div>
        ))}
      </div>
      {hiddenCount ? <div className="border-t border-[#E8EEF6] px-4 py-2.5 text-center text-[11.5px] font-medium text-[#68758A]">{hiddenCount} older activit{hiddenCount === 1 ? "y" : "ies"} hidden from dashboard preview.</div> : null}
    </>
  );
}

function buildActionGroups(rows: DashboardActivityRow[]): ActionGroup[] {
  const groups = new Map<string, ActionGroup>();
  for (const row of rows) {
    const definition = actionGroupDefinition(row);
    const existing = groups.get(definition.key);
    if (!existing) {
      groups.set(definition.key, { ...definition, count: 1, urgentCount: isUrgent(row) ? 1 : 0, oldestAt: row.created_at });
      continue;
    }
    existing.count += 1;
    if (isUrgent(row)) existing.urgentCount += 1;
    if (Date.parse(row.created_at) < Date.parse(existing.oldestAt)) existing.oldestAt = row.created_at;
  }
  return Array.from(groups.values()).sort((a, b) => b.urgentCount - a.urgentCount || b.count - a.count || Date.parse(a.oldestAt) - Date.parse(b.oldestAt));
}

function actionGroupDefinition(row: DashboardActivityRow): Pick<ActionGroup, "key" | "label" | "href"> {
  if (row.event_type === "claim_document_reuploaded") return { key: "reupload", label: "Rejected Docs Reuploaded", href: "/dashboard?activity=replacements#manager-action" };
  if (row.event_type === "claim_document_uploaded" || row.event_type === "claim_documents_completed") return { key: "documents", label: "Documents Uploaded", href: "/dashboard?activity=documents#manager-action" };
  if (row.event_type.startsWith("support_ticket")) return { key: "support", label: "Support Replies / Tickets", href: "/dashboard?activity=support#manager-action" };
  if (row.event_type.startsWith("customer_kyc")) return { key: "kyc", label: "KYC / Profile Updates", href: "/dashboard?activity=kyc#customer-activity" };
  if (row.event_type === "roadside_call_started") return { key: "roadside", label: "Roadside Assistance", href: "/dashboard?activity=roadside#manager-action" };
  return { key: "customer-updates", label: "Customer Updates", href: "/dashboard#manager-action" };
}

function PriorityBadge({ priority, compact = false }: { priority: DashboardActivityRow["priority"]; compact?: boolean }) {
  const className = priority === "critical" ? "border-red-200 bg-red-50 text-red-700" : priority === "high" ? "border-orange-200 bg-orange-50 text-orange-700" : priority === "medium" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium capitalize ${className}`}>{compact ? priority.slice(0, 1).toUpperCase() : priority}</span>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="px-4 py-8 text-center"><p className="text-[13px] font-semibold text-[#071D49]">{title}</p><p className="mt-1 text-[11.5px] text-[#7A8797]">{message}</p></div>;
}

function oldestAgeDays(label: string) {
  const match = label.match(/(\d+) day/);
  return match ? Number(match[1]) : 0;
}
function isUrgent(row: DashboardActivityRow) { return row.priority === "critical" || row.priority === "high"; }
function customerName(row: DashboardActivityRow) { return row.customers?.company_name || row.customers?.contact_name || "Customer"; }
function actionHref(row: DashboardActivityRow) { if (row.claim_id) return `/claims/${row.claim_id}`; if (row.support_ticket_id) return `/support/${row.support_ticket_id}`; if (row.customer_id) return `/customers/${row.customer_id}`; return "/dashboard"; }
function metadataText(row: DashboardActivityRow, key: string) { const value = row.metadata?.[key]; return typeof value === "string" || typeof value === "number" ? String(value) : null; }
function eventLabel(eventType: DashboardActivityRow["event_type"]) { return eventType.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function activityIcon(eventType: DashboardActivityRow["event_type"]) { if (eventType.includes("document")) return "D"; if (eventType.includes("support")) return "S"; if (eventType.includes("kyc")) return "K"; if (eventType.includes("roadside")) return "R"; return "C"; }
function relativeTime(value: string) { const diffMs = Date.now() - Date.parse(value); if (!Number.isFinite(diffMs)) return "-"; const minutes = Math.max(0, Math.floor(diffMs / 60000)); if (minutes < 1) return "Just now"; if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); if (days === 1) return "1d ago"; return `${days}d ago`; }
function firstName(name?: string | null) { return name?.trim().split(/\s+/)[0] ?? ""; }
function greetingForIndiaTime() { const hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: "Asia/Kolkata" }).format(new Date())); if (hour < 12) return "Good morning"; if (hour < 17) return "Good afternoon"; return "Good evening"; }
