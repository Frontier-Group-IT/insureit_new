import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle, ArrowRight, LoaderCircle, Search, SlidersHorizontal, Sparkles } from "lucide-react";
import { primaryActionClassName, secondaryActionClassName } from "@/components/action-styles";
import type { ClaimStatus } from "./data";

const statusStyles: Record<string, string> = {
  Draft: "border-slate-200 bg-slate-50 text-slate-700",
  "Accident Reported": "border-orange-200 bg-orange-50 text-orange-700",
  "Initial Documents Pending": "border-amber-200 bg-amber-50 text-amber-800",
  "Initial Documents Verification Pending": "border-cyan-200 bg-cyan-50 text-cyan-800",
  "Initial Documents Submitted": "border-cyan-200 bg-cyan-50 text-cyan-800",
  "Initial Documents Verified": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Documents Pending": "border-amber-200 bg-amber-50 text-amber-800",
  "Documents Submitted": "border-cyan-200 bg-cyan-50 text-cyan-800",
  "Claim Intimated": "border-blue-200 bg-blue-50 text-blue-700",
  "Surveyor Appointed": "border-indigo-200 bg-indigo-50 text-indigo-700",
  "Vehicle Inspected": "border-cyan-200 bg-cyan-50 text-cyan-700",
  "Final Documents Awaited": "border-amber-200 bg-amber-50 text-amber-800",
  "Final Documents Verification Pending": "border-cyan-200 bg-cyan-50 text-cyan-800",
  "Final Documents Submitted": "border-cyan-200 bg-cyan-50 text-cyan-800",
  "Final Documents Verified": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Claim Intimation": "border-blue-200 bg-blue-50 text-blue-700",
  "Final Surveyor Details": "border-indigo-200 bg-indigo-50 text-indigo-700",
  "Survey Status": "border-yellow-200 bg-yellow-50 text-yellow-800",
  "Survey Done": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Work Approval Status": "border-purple-200 bg-purple-50 text-purple-700",
  "Work Approval Received": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "Estimate Submitted": "border-purple-200 bg-purple-50 text-purple-700",
  "Approval Pending": "border-yellow-200 bg-yellow-50 text-yellow-800",
  "Repair Started": "border-teal-200 bg-teal-50 text-teal-700",
  "Under Repair": "border-orange-200 bg-orange-50 text-orange-700",
  "Repair Completed": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "RA Intimation": "border-orange-200 bg-orange-50 text-orange-700",
  "RA Intimation Done": "border-emerald-200 bg-emerald-50 text-emerald-700",
  "DO Status": "border-yellow-200 bg-yellow-50 text-yellow-800",
  "Final Bill Submitted": "border-lime-200 bg-lime-50 text-lime-700",
  "Payment Stage": "border-green-200 bg-green-50 text-green-700",
  "Settlement Under Process": "border-green-200 bg-green-50 text-green-700",
  "Claim Complete": "border-emerald-300 bg-emerald-100 text-emerald-800",
  Settled: "border-green-300 bg-green-100 text-green-800",
  Rejected: "border-red-200 bg-red-50 text-red-700",
  Closed: "border-slate-300 bg-slate-100 text-slate-700",
  Active: "border-green-200 bg-green-50 text-green-700",
  Review: "border-amber-200 bg-amber-50 text-amber-800",
  Attention: "border-orange-200 bg-orange-50 text-orange-700",
  "Renewal due": "border-amber-200 bg-amber-50 text-amber-800",
  Valid: "border-green-200 bg-green-50 text-green-700",
  "Expiring soon": "border-orange-200 bg-orange-50 text-orange-700"
};

export function StatusBadge({ status }: { status: ClaimStatus | string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9.5px] font-bold capitalize tracking-[0.01em] shadow-[0_4px_12px_rgba(15,23,42,0.05)] ${statusStyles[status] ?? statusStyles.Draft}`}><span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" />{status}</span>;
}

export function PriorityBadge({ priority }: { priority: "High" | "Medium" | "Low" }) {
  const styles = {
    High: "border-red-200 bg-red-50 text-red-700",
    Medium: "border-amber-200 bg-amber-50 text-amber-800",
    Low: "border-slate-200 bg-slate-50 text-slate-600"
  }[priority];
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[9.5px] font-bold ${styles}`}>{priority}</span>;
}

export function MetricCard({ label, value, hint, tone = "navy", icon }: { label: string; value: string; hint: string; tone?: "navy" | "green" | "amber" | "red"; icon: string }) {
  const tones = {
    navy: "from-[#201A52] via-[#5B4BDA] to-[#6C63FF] text-white shadow-[#5B4BDA]/20",
    green: "from-[#087F79] via-[#0CA89B] to-[#38D9C5] text-white shadow-[#0CA89B]/20",
    amber: "from-[#C97600] via-[#F59E0B] to-[#FFD166] text-white shadow-[#F59E0B]/20",
    red: "from-[#B82F4C] via-[#ED4D6E] to-[#FF7A8F] text-white shadow-[#ED4D6E]/20"
  };
  return (
    <section className={`group relative overflow-hidden rounded-[24px] bg-gradient-to-br p-5 shadow-[0_24px_60px_-28px_currentColor] transition duration-300 hover:-translate-y-1 ${tones[tone]}`}>
      <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-white/15 blur-2xl transition duration-500 group-hover:scale-125" />
      <div className="relative flex items-start justify-between gap-4">
        <div><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-white/70">{label}</p><p className="mt-3 font-display text-[32px] font-semibold tracking-[-0.04em]">{value}</p></div>
        <span className="grid h-11 w-11 place-items-center rounded-2xl border border-white/20 bg-white/14 text-[20px] shadow-inner backdrop-blur">{icon}</span>
      </div>
      <div className="relative mt-5 flex items-center justify-between gap-3 border-t border-white/15 pt-3"><p className="text-[10.5px] font-medium text-white/78">{hint}</p><ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></div>
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
  compact = false,
  onSearchChange,
  onFilterChange
}: {
  searchPlaceholder: string;
  filterLabel?: string;
  filterName?: string;
  filterOptions?: Array<{ value: string; label: string }>;
  defaultSearch?: string;
  defaultFilter?: string;
  action?: ReactNode;
  compact?: boolean;
  onSearchChange?: (value: string) => void;
  onFilterChange?: (value: string) => void;
}) {
  const hasFilters = Boolean(defaultSearch || defaultFilter !== "all");
  const controlled = Boolean(onSearchChange || onFilterChange);
  return (
    <form method="get" onSubmit={controlled ? (event) => event.preventDefault() : undefined} className={`ui-toolbar ${compact ? "mb-2 rounded-2xl p-2" : "mb-4 rounded-[22px] p-3"}`}>
      <div className={`flex flex-col md:flex-row md:items-center md:justify-between ${compact ? "gap-2" : "gap-3"}`}>
        <label className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B93AA]" />
          <input name="q" {...(controlled ? { value: defaultSearch } : { defaultValue: defaultSearch })} onChange={onSearchChange ? (event) => onSearchChange(event.target.value) : undefined} className={`${compact ? "h-9 w-full rounded-xl pl-9 text-[11px]" : "h-10 w-full rounded-xl pl-10 text-[11.5px]"}`} placeholder={searchPlaceholder} aria-label={searchPlaceholder} />
        </label>
        <div className={`flex flex-col sm:flex-row sm:items-center ${compact ? "gap-2" : "gap-3"}`}>
          <label className="relative"><SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B93AA]" /><select name={filterName} className={`${compact ? "h-9 min-w-36 rounded-xl pl-9 text-[11px]" : "h-10 min-w-44 rounded-xl pl-9 text-[11.5px]"}`} aria-label={filterLabel} {...(controlled ? { value: defaultFilter } : { defaultValue: defaultFilter })} onChange={onFilterChange ? (event) => onFilterChange(event.target.value) : undefined}><option value="all">All {filterLabel.toLowerCase()}</option>{filterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          {controlled ? null : <button type="submit" className={`${primaryActionClassName} ${compact ? "h-9 px-3 text-[9px]" : ""}`}>Apply</button>}
          {hasFilters ? controlled ? <button type="button" onClick={() => { onSearchChange?.(""); onFilterChange?.("all"); }} className={`${secondaryActionClassName} ${compact ? "h-9 px-3 text-[9px]" : ""}`}>Clear</button> : <Link href="?" className={`${secondaryActionClassName} ${compact ? "h-9 px-3 text-[9px]" : ""}`}>Clear</Link> : null}
          {action}
        </div>
      </div>
    </form>
  );
}

export function EmptyState({ title, description, action, className = "", icon }: { title: string; description?: string; action?: ReactNode; className?: string; icon?: ReactNode }) {
  return (
    <div className={`relative overflow-hidden rounded-[22px] border border-dashed border-[#CFCBFF] bg-gradient-to-br from-white via-[#F8F7FF] to-[#EEFBFF] p-8 text-center ${className}`}>
      <div className="absolute left-1/2 top-0 h-28 w-28 -translate-x-1/2 rounded-full bg-[#6C63FF]/12 blur-3xl" />
      <div className="relative mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-white bg-white/90 text-[#6157DF] shadow-[0_12px_28px_rgba(97,87,223,0.15)]">{icon ?? <Sparkles className="h-5 w-5" />}</div>
      <h3 className="relative mt-4 font-display text-[15px] font-semibold tracking-[-0.02em] text-[#1B1E3C]">{title}</h3>
      {description ? <p className="relative mx-auto mt-2 max-w-md text-[10.5px] leading-5 text-[#737B92]">{description}</p> : null}
      {action ? <div className="relative mt-5">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "Loading workspace...", className = "" }: { label?: string; className?: string }) {
  return (
    <div className={`ui-glass-panel rounded-[22px] border border-white/80 bg-white/75 p-5 ${className}`} aria-live="polite">
      <div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-[#EEECFF] text-[#6157DF]"><LoaderCircle className="h-4 w-4 animate-spin" /></span><p className="text-[11px] font-semibold text-[#4E5670]">{label}</p></div>
      <div className="mt-4 animate-pulse space-y-2.5"><div className="h-3 w-36 rounded-full bg-[#E5E6F2]" /><div className="h-9 w-full rounded-xl bg-[#F0F1F7]" /><div className="h-9 w-2/3 rounded-xl bg-[#F0F1F7]" /></div>
    </div>
  );
}

export function ErrorState({ title = "Unable to load data", description = "Please refresh or try again. Contact an administrator if the issue continues.", className = "" }: { title?: string; description?: string; className?: string }) {
  return <div className={`flex items-start gap-3 rounded-[20px] border border-red-200 bg-red-50/85 p-5 text-red-700 shadow-[0_15px_35px_rgba(185,28,28,0.08)] ${className}`}><span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-red-100"><AlertCircle className="h-4 w-4" /></span><div><p className="text-[11.5px] font-semibold">{title}</p><p className="mt-1 text-[10.5px] leading-5 text-red-600">{description}</p></div></div>;
}
