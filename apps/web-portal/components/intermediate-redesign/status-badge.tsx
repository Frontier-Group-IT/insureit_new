/**
 * Semantic status badge. Replaces the gray-only StatusBadge that was
 * used throughout the original register pages.
 *
 * - "success"  → green     (active, completed, registered)
 * - "warning"  → amber     (pending, under review, needs attention)
 * - "error"    → red       (suspended, rejected, failed)
 * - "info"     → blue      (invited, info-only)
 * - "pending"  → slate     (default / not started)
 *
 * The `tone` prop maps to the designTokens.status colors.
 * Accepts either a known status keyword or a raw string.
 */
export type StatusTone = "success" | "warning" | "error" | "info" | "pending";

export interface StatusBadgeProps {
  /** The status string to display (e.g. "active", "suspended", "invited") */
  value: string;
  /** If omitted, tone is auto-derived from the value */
  tone?: StatusTone;
  /** Show a colored dot indicator to the left of the label */
  dot?: boolean;
  /** Truncate long values */
  truncate?: boolean;
  /** Additional classes to merge */
  className?: string;
}

// Maps raw status strings from the API to a semantic tone.
const STATUS_MAP: Record<string, StatusTone> = {
  // Success
  active: "success",
  iib_registered: "success",
  agreement_signed: "success",
  approved: "success",
  registered: "success",
  on_time: "success",
  completed: "success",

  // Warning
  pending: "warning",
  under_review: "warning",
  changes_requested: "warning",
  documents_pending: "warning",
  agreement_pending: "warning",
  exam_pending: "warning",
  training_pending: "warning",
  iib_pending: "warning",

  // Error — invited goes here (not info; invited = needs action = warning tier)
  invited: "info",
  suspended: "error",
  rejected: "error",
  rejected_posp: "error",
  failed: "error",
  expired: "error",
  inactive: "error",

  // Info
  not_created: "info",
  import_existing_posp: "info",
  convert_to_partner: "info",

  // Pending / default
  pending_partner: "pending",
  pending_review: "pending",
  pending_assignment: "pending",
};

function deriveTone(value: string): StatusTone {
  const normalized = value.toLowerCase().replace(/\s+/g, "_");
  return STATUS_MAP[normalized] ?? "pending";
}

const TONE_CLASSES: Record<StatusTone, { container: string; dot: string; text: string }> = {
  success: {
    container: "bg-[var(--status-success-bg)] text-[var(--status-success-text)] border border-[var(--status-success-border)]",
    dot: "bg-green-500",
    text: "text-green-800",
  },
  warning: {
    container: "bg-[var(--status-warning-bg)] text-[var(--status-warning-text)] border border-[var(--status-warning-border)]",
    dot: "bg-amber-500",
    text: "text-amber-800",
  },
  error: {
    container: "bg-[var(--status-error-bg)] text-[var(--status-error-text)] border border-[var(--status-error-border)]",
    dot: "bg-red-500",
    text: "text-red-800",
  },
  info: {
    container: "bg-[var(--status-info-bg)] text-[var(--status-info-text)] border border-[var(--status-info-border)]",
    dot: "bg-blue-500",
    text: "text-blue-800",
  },
  pending: {
    container: "bg-[var(--status-pending-bg)] text-[var(--status-pending-text)] border border-[var(--status-pending-border)]",
    dot: "bg-slate-400",
    text: "text-slate-600",
  },
};

export function StatusBadge({ value, tone, dot = false, truncate = true, className = "" }: StatusBadgeProps) {
  const resolvedTone = tone ?? deriveTone(value);
  const classes = TONE_CLASSES[resolvedTone];
  const displayValue = value.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  const baseClasses = "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-semibold tracking-[0.02em]";
  const containerClass = truncate ? `${baseClasses} ${classes.container} max-w-[140px] truncate` : `${baseClasses} ${classes.container}`;
  const finalClassName = className ? `${containerClass} ${className}` : containerClass;

  return (
    <span
      className={finalClassName}
      aria-label={`Status: ${displayValue}`}
    >
      {dot ? <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${classes.dot}`} aria-hidden="true" /> : null}
      <span className="truncate">{displayValue}</span>
    </span>
  );
}

/**
 * Color-coded workflow/lifecycle badge — shows the stage in the onboarding flow.
 * This replaces the old Journey card dots and the gray-only stage labels.
 */
export function LifecycleBadge({
  value,
  active = false,
  completed = false,
}: {
  value: string;
  active?: boolean;
  completed?: boolean;
}) {
  let tone: StatusTone;
  if (completed) tone = "success";
  else if (active) tone = "info";
  else tone = "pending";

  return <StatusBadge value={value} tone={tone} dot />;
}
