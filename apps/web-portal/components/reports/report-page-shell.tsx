import Link from "next/link";
import { Download, Filter } from "lucide-react";
import type { ReactNode } from "react";
import { ReportRegisterEnhancer } from "@/components/reports/report-register-enhancer";
import { ReportFilterSubmitGuard } from "@/components/reports/report-query-shortcuts";

export const reportInputClass = "h-9 w-full rounded-md border border-[#d9e0e8] bg-white px-2.5 text-[11px] font-semibold text-[#344054] outline-none transition focus:border-[#7692b6] focus:ring-2 focus:ring-[#e9f0f7]";

export function ReportPageShell({
  title,
  titleAccessory,
  actions,
  controls,
  loadError = false,
  children,
  className = "",
  headerClassName = "",
  controlsClassName = "",
}: {
  title: string;
  titleAccessory?: ReactNode;
  actions?: ReactNode;
  controls?: ReactNode;
  loadError?: boolean;
  children: ReactNode;
  className?: string;
  headerClassName?: string;
  controlsClassName?: string;
}) {
  return (
    <div className={`report-page-shell mx-auto max-w-[1560px] space-y-3.5 pb-8 ${className}`}>
      <ReportFilterSubmitGuard />
      <ReportRegisterEnhancer />
      <header className={`portal-card overflow-hidden ${headerClassName}`}>
        <div className="flex flex-col gap-3 border-b border-[#e8ecf1] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="report-title text-[24px] font-semibold tracking-[-0.03em] text-[#172033]">{title}</h1>
            {titleAccessory}
          </div>
          {actions ? <div className="report-header-actions flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {controls ? <div className={`report-controls bg-[#fbfcfd] px-4 py-3.5 sm:px-5 ${controlsClassName}`}>{controls}</div> : null}
      </header>
      {loadError ? <ReportErrorBanner /> : null}
      {children}
    </div>
  );
}

export function ReportFilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="report-filter-label mb-1 block text-[9.5px] font-bold tracking-[0.01em] text-[#667085]">{label}</span>
      {children}
    </label>
  );
}

export function ReportApplyButton({ label = "Apply" }: { label?: string }) {
  return (
    <button type="submit" className="report-primary-action mt-auto inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#214f80] px-3.5 text-[10.5px] font-bold text-white transition hover:bg-[#183f69] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7692b6] focus-visible:ring-offset-2">
      <Filter className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export function ReportResetLink({ href, label = "Reset" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="report-secondary-action mt-auto inline-flex h-9 items-center justify-center rounded-md border border-[#d9e0e8] bg-white px-3.5 text-[10.5px] font-bold text-[#526174] transition hover:border-[#b9c5d2] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7692b6] focus-visible:ring-offset-2">
      {label}
    </Link>
  );
}

export function ReportExportLink({ href, label = "Export" }: { href: string; label?: string }) {
  return (
    <a href={href} className="report-secondary-action inline-flex h-9 items-center gap-1.5 rounded-md border border-[#d2dae4] bg-white px-3 text-[10.5px] font-bold text-[#34445d] transition hover:border-[#aebdce] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7692b6] focus-visible:ring-offset-2">
      <Download className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

export function ReportErrorBanner({ message = "Reporting service unavailable" }: { message?: string }) {
  return (
    <div role="alert" className="report-error rounded-lg border border-red-200 bg-red-50 px-4 py-3.5 text-[11px] font-bold text-red-700">
      {message}
    </div>
  );
}

export function ReportEmptyState({ message = "No records for these filters" }: { message?: string }) {
  return <div className="report-empty px-5 py-9 text-center text-[11px] font-semibold text-[#7a8798]">{message}</div>;
}
