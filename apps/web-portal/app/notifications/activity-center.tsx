import Link from "next/link";
import type { DashboardActivityRow } from "@/lib/manager-dashboard";
import { claimPath, customerEditPath } from "@/lib/portal-routes";
import { ActivityHandledButton, ActivitySeenButton, ActivityWorkButton } from "../dashboard/activity-status-buttons";

export function ActivityCenter({ activeRows, recentRows }: { activeRows: DashboardActivityRow[]; recentRows: DashboardActivityRow[] }) {
  return (
    <div className="space-y-4">
      <section className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="New" value={activeRows.filter((row) => row.status === "new").length} />
        <SummaryCard label="In Progress" value={activeRows.filter((row) => row.status === "in_progress").length} />
        <SummaryCard label="High Priority" value={activeRows.filter((row) => row.priority === "high" || row.priority === "critical").length} />
        <SummaryCard label="Recent Activity" value={recentRows.length} />
      </section>

      <section className="rounded-2xl border border-[#DCE7F5] bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-[#E6EEF7] px-4 py-3">
          <div>
            <h2 className="text-[15px] font-semibold text-[#071D49]">Action Required</h2>
            <p className="mt-0.5 text-[11.5px] text-[#68758A]">Customer updates that are new or still in progress.</p>
          </div>
          <Link href="/dashboard#manager-action" className="rounded-lg border border-[#D6E0EC] px-3 py-1.5 text-[11px] font-medium text-[#071D49] transition hover:border-[#174EA6] hover:bg-[#F3F7FD]">Dashboard</Link>
        </div>
        <ActivityList rows={activeRows} showActions emptyTitle="No active notifications" emptyMessage="New customer mobile updates will appear here." />
      </section>

      <section className="rounded-2xl border border-[#DCE7F5] bg-white shadow-sm">
        <div className="border-b border-[#E6EEF7] px-4 py-3">
          <h2 className="text-[15px] font-semibold text-[#071D49]">Recent Activity</h2>
          <p className="mt-0.5 text-[11.5px] text-[#68758A]">Latest customer activity and handled updates.</p>
        </div>
        <ActivityList rows={recentRows} emptyTitle="No recent activity" emptyMessage="Activity will begin after the Supabase triggers are applied and customers use the mobile app." />
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#DCE7F5] bg-white p-3 shadow-sm">
      <p className="text-[11.5px] font-medium text-[#516073]">{label}</p>
      <p className="mt-2 text-[26px] font-semibold leading-none tracking-tight text-[#071D49]">{value}</p>
    </div>
  );
}

function ActivityList({ rows, showActions = false, emptyTitle, emptyMessage }: { rows: DashboardActivityRow[]; showActions?: boolean; emptyTitle: string; emptyMessage: string }) {
  if (!rows.length) {
    return <div className="px-4 py-8 text-center"><p className="text-[13px] font-semibold text-[#071D49]">{emptyTitle}</p><p className="mt-1 text-[11.5px] text-[#7A8797]">{emptyMessage}</p></div>;
  }

  return (
    <div className="divide-y divide-[#E8EEF6]">
      {rows.map((row) => (
        <div key={row.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#FAFCFF]">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-[#F2F6FB] text-[12px] font-semibold text-[#68758A]">{activityIcon(row.event_type)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <p className="text-[12.5px] font-semibold text-[#071D49]">{row.title}</p>
              <PriorityBadge priority={row.priority} />
              <StatusBadge status={row.status} />
              <span className="text-[11px] text-[#7A8797]">{relativeTime(row.created_at)}</span>
            </div>
            <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-5 text-[#5C6878]">{row.message ?? eventLabel(row.event_type)}</p>
            <p className="mt-1 text-[11px] text-[#7A8797]">{customerName(row)} {row.claims?.claim_no ? `· ${row.claims.claim_no}` : ""} {row.vehicles?.vehicle_no ? `· ${row.vehicles.vehicle_no}` : ""}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            {showActions && row.status === "new" ? <ActivitySeenButton activityId={row.id} /> : null}
            {showActions ? <ActivityWorkButton activityId={row.id} /> : null}
            {showActions ? <ActivityHandledButton activityId={row.id} /> : null}
            <Link href={actionHref(row)} className="rounded-lg border border-[#D6E0EC] px-3 py-1.5 text-[11px] font-medium text-[#071D49] transition hover:border-[#174EA6] hover:bg-[#F3F7FD]">View</Link>
          </div>
        </div>
      ))}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: DashboardActivityRow["priority"] }) {
  const className = priority === "critical" ? "border-red-200 bg-red-50 text-red-700" : priority === "high" ? "border-orange-200 bg-orange-50 text-orange-700" : priority === "medium" ? "border-blue-200 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-600";
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10.5px] font-medium capitalize ${className}`}>{priority}</span>;
}

function StatusBadge({ status }: { status: DashboardActivityRow["status"] }) {
  return <span className="rounded-full bg-[#F2F6FB] px-2 py-0.5 text-[10px] font-medium capitalize text-[#68758A]">{status.replace("_", " ")}</span>;
}

function customerName(row: DashboardActivityRow) { return row.customers?.company_name || row.customers?.contact_name || "Customer"; }
function actionHref(row: DashboardActivityRow) { if (row.claim_id) return claimPath(row.claim_id); if (row.customer_id) return customerEditPath(row.customer_id); return "/notifications"; }
function eventLabel(eventType: DashboardActivityRow["event_type"]) { return eventType.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function activityIcon(eventType: DashboardActivityRow["event_type"]) { if (eventType.includes("document")) return "D"; if (eventType.includes("support")) return "S"; if (eventType.includes("kyc")) return "K"; if (eventType.includes("roadside")) return "R"; return "C"; }
function relativeTime(value: string) { const diffMs = Date.now() - Date.parse(value); if (!Number.isFinite(diffMs)) return "-"; const minutes = Math.max(0, Math.floor(diffMs / 60000)); if (minutes < 1) return "Just now"; if (minutes < 60) return `${minutes}m ago`; const hours = Math.floor(minutes / 60); if (hours < 24) return `${hours}h ago`; const days = Math.floor(hours / 24); if (days === 1) return "1d ago"; return `${days}d ago`; }
