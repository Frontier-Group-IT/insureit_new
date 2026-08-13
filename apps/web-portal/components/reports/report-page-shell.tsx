import Link from "next/link";
import { Download, Filter } from "lucide-react";
import type { ReactNode } from "react";

export const reportInputClass = "h-10 w-full rounded-lg border border-[#dfe5ee] bg-white px-3 text-[10.5px] font-semibold text-[#26364f] outline-none transition focus:border-[#7788bd] focus:ring-2 focus:ring-[#dfe5ff]";

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
    <div className={`mx-auto max-w-[1560px] space-y-4 pb-8 ${className}`}>
      <header className={`portal-card overflow-hidden ${headerClassName}`}>
        <div className="flex flex-col gap-3 border-b border-[#e8ecf2] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h1 className="text-[26px] font-semibold tracking-[-0.025em] text-[#13203b] sm:text-[30px]">{title}</h1>
            {titleAccessory}
          </div>
          {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {controls ? <div className={`px-5 py-4 sm:px-6 ${controlsClassName}`}>{controls}</div> : null}
      </header>
      {loadError ? <ReportErrorBanner /> : null}
      {children}
    </div>
  );
}

export function ReportFilterField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[8.5px] font-black uppercase tracking-[0.08em] text-[#7b8799]">{label}</span>
      {children}
    </label>
  );
}

export function ReportApplyButton({ label = "Apply" }: { label?: string }) {
  return (
    <button type="submit" className="mt-auto inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[#172a5c] px-4 text-[10.5px] font-bold text-white transition hover:bg-[#213a78] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7788bd] focus-visible:ring-offset-2">
      <Filter className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

export function ReportResetLink({ href, label = "Reset" }: { href: string; label?: string }) {
  return (
    <Link href={href} className="mt-auto inline-flex h-10 items-center justify-center rounded-lg border border-[#dfe5ee] bg-white px-4 text-[10.5px] font-bold text-[#526174] transition hover:border-[#c8d1df] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7788bd] focus-visible:ring-offset-2">
      {label}
    </Link>
  );
}

export function ReportExportLink({ href, label = "Export CSV" }: { href: string; label?: string }) {
  return (
    <a href={href} className="inline-flex h-9 items-center gap-2 rounded-lg border border-[#cad4e4] bg-white px-3 text-[10px] font-bold text-[#263b69] transition hover:border-[#aebbd0] hover:bg-[#f8fafc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7788bd] focus-visible:ring-offset-2">
      <Download className="h-3.5 w-3.5" /> {label}
    </a>
  );
}

export function ReportErrorBanner({ message = "Reporting service unavailable." }: { message?: string }) {
  return (
    <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-[11px] font-bold text-red-700">
      {message}
    </div>
  );
}

export function ReportEmptyState({ message = "No records for these filters" }: { message?: string }) {
  return <div className="px-5 py-10 text-center text-[10px] font-semibold text-[#7a8798]">{message}</div>;
}
