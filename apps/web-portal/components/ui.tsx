import Link from "next/link";
import type { ReactNode } from "react";
import type { ClaimStatus } from "./data";

const statusStyles: Record<string, string> = {
  Draft: "bg-slate-100 text-slate-700 ring-slate-200",
  "Accident Reported": "bg-orange-50 text-orange-700 ring-orange-200",
  "Initial Documents Pending": "bg-amber-50 text-amber-800 ring-amber-200",
  "Initial Documents Verification Pending": "bg-cyan-50 text-cyan-800 ring-cyan-200",
  "Initial Documents Submitted": "bg-cyan-50 text-cyan-800 ring-cyan-200",
  "Initial Documents Verified": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Documents Pending": "bg-amber-50 text-amber-800 ring-amber-200",
  "Documents Submitted": "bg-cyan-50 text-cyan-800 ring-cyan-200",
  "Claim Intimated": "bg-blue-50 text-blue-700 ring-blue-200",
  "Surveyor Appointed": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Vehicle Inspected": "bg-cyan-50 text-cyan-700 ring-cyan-200",
  "Final Documents Awaited": "bg-amber-50 text-amber-800 ring-amber-200",
  "Final Documents Verification Pending": "bg-cyan-50 text-cyan-800 ring-cyan-200",
  "Final Documents Submitted": "bg-cyan-50 text-cyan-800 ring-cyan-200",
  "Final Documents Verified": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Claim Intimation": "bg-blue-50 text-blue-700 ring-blue-200",
  "Final Surveyor Details": "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Survey Status": "bg-yellow-50 text-yellow-800 ring-yellow-200",
  "Survey Done": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Work Approval Status": "bg-purple-50 text-purple-700 ring-purple-200",
  "Work Approval Received": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "Estimate Submitted": "bg-purple-50 text-purple-700 ring-purple-200",
  "Approval Pending": "bg-yellow-50 text-yellow-800 ring-yellow-200",
  "Repair Started": "bg-teal-50 text-teal-700 ring-teal-200",
  "Under Repair": "bg-orange-50 text-orange-700 ring-orange-200",
  "Repair Completed": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "RA Intimation": "bg-orange-50 text-orange-700 ring-orange-200",
  "RA Intimation Done": "bg-emerald-50 text-emerald-700 ring-emerald-200",
  "DO Status": "bg-yellow-50 text-yellow-800 ring-yellow-200",
  "Final Bill Submitted": "bg-lime-50 text-lime-700 ring-lime-200",
  "Payment Stage": "bg-green-50 text-green-700 ring-green-200",
  "Settlement Under Process": "bg-green-50 text-green-700 ring-green-200",
  "Claim Complete": "bg-emerald-100 text-emerald-800 ring-emerald-300",
  Settled: "bg-green-100 text-green-800 ring-green-300",
  Rejected: "bg-red-50 text-red-700 ring-red-200",
  Closed: "bg-slate-200 text-slate-700 ring-slate-300",
  Active: "bg-green-50 text-green-700 ring-green-200",
  Review: "bg-amber-50 text-amber-800 ring-amber-200",
  Attention: "bg-orange-50 text-orange-700 ring-orange-200",
  "Renewal due": "bg-amber-50 text-amber-800 ring-amber-200",
  Valid: "bg-green-50 text-green-700 ring-green-200",
  "Expiring soon": "bg-orange-50 text-orange-700 ring-orange-200"
};

export function StatusBadge({ status }: { status: ClaimStatus | string }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${statusStyles[status] ?? statusStyles.Draft}`}>{status}</span>;
}

export function PriorityBadge({ priority }: { priority: "High" | "Medium" | "Low" }) {
  const styles = {
    High: "bg-red-50 text-red-700 ring-red-200",
    Medium: "bg-amber-50 text-amber-800 ring-amber-200",
    Low: "bg-slate-50 text-slate-600 ring-slate-200"
  }[priority];
  return <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-semibold ring-1 ring-inset ${styles}`}>{priority}</span>;
}

export function MetricCard({ label, value, hint, tone = "navy", icon }: { label: string; value: string; hint: string; tone?: "navy" | "green" | "amber" | "red"; icon: string }) {
  const tones = {
    navy: "from-navy-900 to-navy-700 text-white",
    green: "from-green-700 to-emerald-500 text-white",
    amber: "from-amber-500 to-orange-500 text-white",
    red: "from-red-600 to-rose-500 text-white"
  };
  return (
    <section className={`overflow-hidden rounded-3xl bg-gradient-to-br p-5 shadow-soft ${tones[tone]}`}>
      <div className="flex items-start justify-between gap-4">
        <div><p className="text-sm font-medium text-white/75">{label}</p><p className="mt-3 text-3xl font-bold tracking-tight">{value}</p></div>
        <span className="rounded-2xl bg-white/15 px-3 py-2 text-xl">{icon}</span>
      </div>
      <p className="mt-5 text-sm font-medium text-white/80">{hint}</p>
    </section>
  );
}

export function SearchFilterBar({
  searchPlaceholder,
  filterLabel = "Status",
  filterName = "status",
  filterOptions = [],
  defaultSearch = "",
  defaultFilter = "all",
  action,
  compact = false
}: {
  searchPlaceholder: string;
  filterLabel?: string;
  filterName?: string;
  filterOptions?: Array<{ value: string; label: string }>;
  defaultSearch?: string;
  defaultFilter?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  const hasFilters = Boolean(defaultSearch || defaultFilter !== "all");
  return (
    <form method="get" className={`${compact ? "mb-2 rounded-lg border border-slate-200 bg-white p-2" : "mb-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"}`}>
      <div className={`flex flex-col md:flex-row md:items-center md:justify-between ${compact ? "gap-2" : "gap-3"}`}>
        <div className="flex-1">
          <input name="q" defaultValue={defaultSearch} className={`${compact ? "h-8 w-full rounded-md px-2.5 text-xs" : "w-full px-3.5"}`} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
        </div>
        <div className={`flex flex-col sm:flex-row sm:items-center ${compact ? "gap-2" : "gap-3"}`}>
          <select name={filterName} className={`${compact ? "h-8 min-w-36 rounded-md px-2.5 text-xs" : "min-w-40"}`} aria-label={filterLabel} defaultValue={defaultFilter}>
            <option value="all">All {filterLabel.toLowerCase()}</option>
            {filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
          <button type="submit" className={`${compact ? "h-8 rounded-md px-3 text-xs" : "h-10 rounded-lg px-4 text-sm"} bg-navy-700 font-semibold text-white transition hover:bg-navy-900`}>Apply</button>
          {hasFilters ? <Link href="?" className={`${compact ? "h-8 rounded-md px-3 text-xs" : "h-10 rounded-lg px-4 text-sm"} inline-flex items-center justify-center border border-slate-200 font-semibold text-slate-600 transition hover:bg-slate-50`}>Clear</Link> : null}
          {action}
        </div>
      </div>
    </form>
  );
}

export function EmptyState({ title, description, action, className = "" }: { title: string; description?: string; action?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center ${className}`}>
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">?</div>
      <h3 className="mt-4 text-base font-semibold text-navy-900">{title}</h3>
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">{description}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading claim workspace...", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`} aria-live="polite">
      <div className="animate-pulse space-y-3"><div className="h-4 w-36 rounded bg-slate-200" /><div className="h-8 w-full rounded bg-slate-100" /><div className="h-8 w-2/3 rounded bg-slate-100" /></div>
      <p className="mt-4 text-sm text-slate-500">{label}</p>
    </div>
  );
}

export function ErrorState({ title = "Unable to load data", description = "Please refresh or try again. Contact an administrator if the issue continues.", className = "" }: { title?: string; description?: string; className?: string }) {
  return <div className={`rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 ${className}`}><p className="font-semibold">{title}</p><p className="mt-1 text-red-600">{description}</p></div>;
}
