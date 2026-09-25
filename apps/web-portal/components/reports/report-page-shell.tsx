import Link from "next/link";
import { Download, Filter } from "lucide-react";
import type { ReactNode } from "react";
import { ReportRegisterEnhancer } from "@/components/reports/report-register-enhancer";
import { ReportFilterSubmitGuard } from "@/components/reports/report-query-shortcuts";
import { ReportWorkspaceNavigation } from "@/components/reports/report-workspace-navigation";
import { ReportToolbarPortal } from "@/components/reports/report-toolbar-portal";

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
  persistentHeader = false,
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
  persistentHeader?: boolean;
}) {
  if (persistentHeader) {
    return (
      <>
        <ReportFilterSubmitGuard />
        <ReportRegisterEnhancer />
        {controls || actions ? (
          <ReportToolbarPortal>
            <>
              {controls ? <div className={`reports-reference-filter-area ${controlsClassName}`}>{controls}</div> : null}
              {actions ? <div className="reports-reference-actions report-header-actions">{actions}</div> : null}
            </>
          </ReportToolbarPortal>
        ) : null}
        {loadError ? <ReportErrorBanner /> : null}
        <div className={`reports-reference-content ${className}`}>{children}</div>
      </>
    );
  }

  return (
    <div className={`reports-reference-shell report-page-shell mx-auto max-w-[1560px] pb-8 ${className}`}>
      <ReportFilterSubmitGuard />
      <ReportRegisterEnhancer />

      <header className={`reports-reference-header ${headerClassName}`} aria-label={title}>
        <div className="reports-reference-topbar">
          <div className="reports-reference-left">
            <div className="reports-reference-heading">
              <h1>Reports</h1>
              {titleAccessory ? <span className="reports-reference-title-accessory">{titleAccessory}</span> : null}
            </div>
            <ReportWorkspaceNavigation />
          </div>

          {controls || actions ? (
            <div className={`reports-reference-toolbar ${controlsClassName}`}>
              {controls ? <div className="reports-reference-filter-area">{controls}</div> : null}
              {actions ? <div className="reports-reference-actions report-header-actions">{actions}</div> : null}
            </div>
          ) : null}
        </div>
      </header>

      {loadError ? <ReportErrorBanner /> : null}
      <div className="reports-reference-content">{children}</div>
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
    <a href={href} className="report-secondary-action inline-flex h-9 items-center gap-1.5 rounded-md border border-[#0e5da5] bg-[#0e5da5] px-3 text-[10.5px] font-bold text-white transition hover:border-[#0b4d89] hover:bg-[#0b4d89] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7692b6] focus-visible:ring-offset-2">
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
