import type { ReactNode } from "react";

/**
 * Redesigned UI components for the intermediate register.
 *
 * Improvements over the original:
 * - Sticky table headers with backdrop-blur
 * - Zebra row striping via alternating background
 * - Consistent 12px base font for body, 9px uppercase for headers
 * - Color-coded stat cards with icons
 * - Filter pills that visually distinguish active state
 * - Clean action buttons with gradient backgrounds
 */

/**
 * Column definition type.
 * Exported so external components can build column arrays with proper typing.
 */
export interface ColumnDef<T> {
  key: string;
  label: string;
  render: (row: T) => ReactNode;
  width?: string;
}

/**
 * Desktop stat card with icon and color-coded tone.
 */
export function StatCard({
  label,
  value,
  icon,
  tone = "default",
}: {
  label: string;
  value: number | string;
  icon?: ReactNode;
  tone?: "default" | "success" | "warning" | "error" | "info";
}) {
  const toneClasses = {
    default: "bg-white border-neutral-200",
    success: "bg-green-50 border-green-200",
    warning: "bg-amber-50 border-amber-200",
    error: "bg-red-50 border-red-200",
    info: "bg-blue-50 border-blue-200",
  }[tone];

  const iconColor = {
    default: "text-neutral-400",
    success: "text-green-600",
    warning: "text-amber-600",
    error: "text-red-600",
    info: "text-blue-600",
  }[tone];

  return (
    <div
      className={`rounded-xl border ${toneClasses} px-4 py-3.5 shadow-sm flex items-center gap-3`}
    >
      {icon ? (
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-neutral-100 ${iconColor}`}>
          {icon}
        </span>
      ) : null}
      <div className="min-w-0">
        <p className="text-[9px] font-bold uppercase tracking-[0.06em] text-neutral-500">{label}</p>
        <p className="mt-0.5 text-[20px] font-semibold text-neutral-800">{value}</p>
      </div>
    </div>
  );
}

/**
 * Filter toolbar: search, filter dropdowns, bulk actions, right action.
 */
export function FilterToolbar({
  searchPlaceholder = "Search...",
  searchValue = "",
  onSearchChange,
  onSearchSubmit,
  onSearchClear,
  filters,
  activeFilterKey,
  activeFilterValue,
  onFilterChange,
  selectedCount = 0,
  bulkActions,
  rightAction,
}: {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  onSearchSubmit?: (value: string) => void;
  onSearchClear?: () => void;
  filters?: Array<{
    key: string;
    label: string;
    options: Array<{ value: string; label: string }>;
  }>;
  activeFilterKey?: string | null;
  activeFilterValue?: string;
  onFilterChange?: (key: string, value: string) => void;
  selectedCount?: number;
  bulkActions?: Array<{ label: string; onClick: () => void; variant?: "default" | "danger" }>;
  rightAction?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <form
        method="get"
        onSubmit={(e) => {
          e.preventDefault();
          if (onSearchSubmit) onSearchSubmit(searchValue);
        }}
        className="relative min-w-0 flex-1"
      >
        <input
          type="search"
          value={searchValue}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-11 w-full rounded-xl border border-neutral-300 bg-white pl-10 pr-4 text-[11px] text-neutral-800 placeholder-neutral-400 outline-none focus:border-brand-navy-500 focus:ring-2 focus:ring-brand-navy-100"
        />
        {searchValue ? (
          <button
            type="button"
            onClick={onSearchClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
            aria-label="Clear search"
          >
            ✕
          </button>
        ) : null}
      </form>

      <div className="flex flex-wrap items-center gap-2.5">
        {selectedCount > 0 && bulkActions ? (
          <div className="inline-flex items-center gap-1.5 rounded-lg border border-brand-navy-300 bg-brand-navy-50 px-3 py-1.5 text-[10px] font-semibold text-brand-navy-700">
            <span>{selectedCount} selected</span>
            {bulkActions.map((action, i) => (
              <button
                key={i}
                type="button"
                onClick={action.onClick}
                className={`rounded-md px-2 py-1 text-[9px] font-semibold ${action.variant === "danger" ? "text-red-700 hover:bg-red-100" : "text-brand-navy-700 hover:bg-brand-navy-200"}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}

        {filters?.map((filter) => (
          <label key={filter.key} className="flex flex-col gap-1 text-[9px] text-neutral-500">
            <select
              value={activeFilterKey === filter.key ? activeFilterValue : ""}
              onChange={(e) => onFilterChange?.(filter.key, e.target.value)}
              className="h-9 min-w-36 rounded-xl border border-neutral-300 bg-white px-3 text-[10px] text-neutral-800 outline-none focus:border-brand-navy-500 focus:ring-2 focus:ring-brand-navy-100"
            >
              <option value="">{filter.label}</option>
              {filter.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ))}

        {rightAction}
      </div>
    </div>
  );
}

/**
 * Pill-shaped stat button — replaces the old plain-text MetricFilter tabs.
 */
export function FilterPill({
  label,
  value,
  active = false,
  onClick,
}: {
  label: string;
  value: number;
  active?: boolean;
  onClick?: () => void;
}) {
  const baseClasses = "flex flex-col items-center gap-0.5 rounded-xl px-4 py-2 text-[10px] font-semibold transition-all duration-150";
  const activeClasses = "bg-brand-navy-50 text-brand-navy-700 ring-2 ring-brand-navy-500";
  const inactiveClasses = "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-800";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${baseClasses} ${active ? activeClasses : inactiveClasses}`}
    >
      <span className="text-[16px] font-bold">{value}</span>
      <span>{label}</span>
    </button>
  );
}

/**
 * Primary call-to-action button with gradient background.
 */
export function PrimaryButton({
  children,
  onClick,
  className = "",
  loading = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  className?: string;
  loading?: boolean;
  disabled?: boolean;
}) {
  const baseClasses = "inline-flex h-10 items-center justify-center rounded-xl px-4 text-[10.5px] font-bold text-white shadow-sm transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-navy-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 bg-gradient-to-r from-brand-navy-500 to-brand-cyan-500 hover:from-brand-navy-600 hover:to-brand-cyan-600 hover:-translate-y-0.5 hover:shadow-md";
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      className={`${baseClasses} ${className}`}
    >
      {loading ? (
        <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
      ) : null}
      {children}
    </button>
  );
}

/**
 * EnhancedTable — a lean, type-driven table that renders IntermediaryRow[]
 * with sticky headers, zebra striping, and a slot-based empty state.
 */
export function EnhancedTable<T>({
  columns,
  rows,
  emptyMessage = "No records found",
  emptySubtext = "Adjust your search or filter to find more records.",
}: {
  columns: ColumnDef<T>[];
  rows: T[];
  emptyMessage?: string;
  emptySubtext?: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm">
      <div className="border-b border-neutral-200 px-4 py-3">
        <h2 className="text-[13px] font-semibold text-neutral-700">Register</h2>
      </div>

      <table className="w-full min-w-[1000px] table-fixed align-top">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={
                  `sticky top-0 z-10 border-b border-neutral-200 bg-neutral-50/90 px-4 py-2.5 ` +
                  `text-[9px] font-bold uppercase tracking-[0.04em] text-neutral-500 backdrop-blur ` +
                  `${col.width ?? ""}`.replace(/\s+/g, " ").trim()
                }
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-200">
          {rows.map((row, i) => (
            <tr
              key={(row as { id?: string }).id ?? i}
              className={
                `group transition-colors ${i % 2 === 1 ? "bg-neutral-50/50" : ""} hover:bg-neutral-50`.replace(/\s+/g, " ").trim()
              }
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={
                    `px-4 py-2.5 align-top text-[12px] text-neutral-800`.replace(/\s+/g, " ").trim()
                  }
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Empty state */}
      {rows.length === 0 ? (
        <div className="px-5 py-16 text-center">
          <p className="text-[12px] font-semibold text-neutral-600">{emptyMessage}</p>
          <p className="mt-1 text-[11px] text-neutral-500">{emptySubtext}</p>
        </div>
      ) : null}
    </section>
  );
}
