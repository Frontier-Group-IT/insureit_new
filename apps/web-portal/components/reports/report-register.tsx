import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import type { ReactNode } from "react";

export function ReportRegisterViews({ desktop, mobile }: { desktop: ReactNode; mobile: ReactNode }) {
  return (
    <>
      <div className="report-register-desktop hidden md:block">{desktop}</div>
      <div className="report-register-mobile md:hidden">{mobile}</div>
    </>
  );
}

export function ReportRecordCard({
  eyebrow,
  title,
  subtitle,
  actionHref,
  actionLabel = "Open",
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actionHref?: string | null;
  actionLabel?: string;
  children?: ReactNode;
}) {
  return (
    <article className="report-record-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {eyebrow ? <div className="report-record-eyebrow">{eyebrow}</div> : null}
          <div className="report-record-title">{title}</div>
          {subtitle ? <div className="report-record-subtitle">{subtitle}</div> : null}
        </div>
        {actionHref ? <ReportOpenLink href={actionHref} label={actionLabel} compact /> : null}
      </div>
      {children ? <div className="report-record-fields">{children}</div> : null}
    </article>
  );
}

export function ReportRecordField({ label, value, emphasis = false }: { label: string; value: ReactNode; emphasis?: boolean }) {
  return (
    <div className="report-record-field">
      <span>{label}</span>
      <strong className={emphasis ? "report-record-value-emphasis" : ""}>{value}</strong>
    </div>
  );
}

export function ReportOpenLink({ href, label = "Open", compact = false }: { href: string; label?: string; compact?: boolean }) {
  return (
    <Link href={href} className={`report-open-link ${compact ? "report-open-link-compact" : ""}`}>
      <span>{label}</span>
      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
    </Link>
  );
}

export function ReportPagination({
  page,
  pages,
  total,
  previousHref,
  nextHref,
  pageSize,
}: {
  page: number;
  pages: number;
  total: number;
  previousHref: string;
  nextHref: string;
  pageSize?: number;
}) {
  const first = total === 0 ? 0 : (page - 1) * Math.max(pageSize ?? 0, 0) + 1;
  const last = pageSize ? Math.min(total, page * pageSize) : null;
  const countLabel = last ? `${formatInteger(first)}–${formatInteger(last)} of ${formatInteger(total)}` : `${formatInteger(total)} records`;

  return (
    <div className="report-pagination">
      <span className="report-pagination-count">{countLabel}</span>
      <div className="report-pagination-controls">
        <Link aria-disabled={page <= 1} href={page <= 1 ? "#" : previousHref} className={`report-pagination-link ${page <= 1 ? "pointer-events-none opacity-40" : ""}`}>
          <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
          <span>Previous</span>
        </Link>
        <span className="report-pagination-page">Page {formatInteger(page)} of {formatInteger(pages)}</span>
        <Link aria-disabled={page >= pages} href={page >= pages ? "#" : nextHref} className={`report-pagination-link ${page >= pages ? "pointer-events-none opacity-40" : ""}`}>
          <span>Next</span>
          <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}
