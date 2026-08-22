import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";

type MetricTone = "navy" | "green" | "amber" | "red" | "blue" | "slate";

type BrokerRegisterToolbarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  searchPlaceholder: string;
  children?: ReactNode;
  action?: ReactNode;
  activeViewLabel?: string;
  leftControls?: ReactNode;
  compact?: boolean;
};

type RegisterViewTabsProps = {
  value: string;
  options: Array<{ value: string; label: string; count?: number }>;
  onChange: (value: string) => void;
};

const metricTones: Record<MetricTone, string> = {
  navy: "border-[#C9D6EA] bg-[#F8FAFD] text-[#17365D]",
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  red: "border-rose-200 bg-rose-50 text-rose-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700"
};

export function BrokerRegisterShell({
  title,
  eyebrow,
  description,
  icon,
  metrics,
  children
}: {
  title: string;
  eyebrow: string;
  description: string;
  icon: ReactNode;
  metrics: Array<{ label: string; value: string | number; hint: string; tone?: MetricTone }>;
  children: ReactNode;
}) {
  const showSupportingCopy = title !== "Customer Portfolio" && title !== "Vehicle Portfolio" && title !== "Policy Portfolio" && title !== "External Policy Portfolio" && title !== "External Policies";
  const customerReferenceLayout = title === "Customer Portfolio";
  const vehicleReferenceLayout = title === "Vehicle Portfolio";
  const policyReferenceLayout = title === "Policy Portfolio";
  const externalPolicyReferenceLayout = title === "External Policy Portfolio" || title === "External Policies";
  const compactReferenceLayout = customerReferenceLayout || vehicleReferenceLayout || policyReferenceLayout || externalPolicyReferenceLayout;
  const childItems = Children.toArray(children);
  const firstChild = childItems[0];
  const compactToolbar =
    compactReferenceLayout &&
    isValidElement<BrokerRegisterToolbarProps>(firstChild) &&
    firstChild.type === BrokerRegisterToolbar
      ? firstChild
      : null;

  let headerActions: ReactNode = null;
  let renderedChildren: ReactNode = children;

  if (compactToolbar) {
    const toolbarChildren = Children.toArray(compactToolbar.props.children);
    const tabs = toolbarChildren.find(
      (child): child is ReactElement<RegisterViewTabsProps> =>
        isValidElement<RegisterViewTabsProps>(child) && child.type === RegisterViewTabs
    );
    const primarySelect = toolbarChildren.find(
      (child) => isValidElement(child) && child.type === RegisterSelect
    );
    const secondaryHeaderActions = toolbarChildren.filter(
      (child) => child !== tabs && child !== primarySelect
    );
    const compactTabs = tabs
      ? cloneElement(tabs, {
          options: customerReferenceLayout
            ? tabs.props.options
                .filter((option) => option.value === "all" || option.value === "active" || option.value === "kyc")
                .map((option) => option.value === "kyc" ? { ...option, label: "Inactive" } : option)
            : tabs.props.options
        })
      : null;
    const renderedToolbar = cloneElement(compactToolbar, {
      activeViewLabel: undefined,
      action: undefined,
      leftControls: primarySelect,
      compact: true,
      children: compactTabs
    });

    headerActions = (
      <div className="flex flex-wrap items-center justify-end gap-2">
        {secondaryHeaderActions}
        {compactToolbar.props.action}
      </div>
    );
    renderedChildren = [renderedToolbar, ...childItems.slice(1)];
  }

  return (
    <section className="mx-auto max-w-[1480px] overflow-hidden rounded-2xl border border-[#DCE5EF] bg-white shadow-[0_18px_55px_rgba(15,23,42,0.07)]">
      <div className={`border-b border-[#E5ECF5] bg-[#F8FAFC] px-4 sm:px-5 ${compactReferenceLayout ? "py-3" : "py-4"}`}>
        {compactReferenceLayout ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#17365D] text-white shadow-[0_10px_22px_rgba(23,54,93,0.18)]">{icon}</span>
              <h2 className="text-[18px] font-semibold leading-tight text-[#0F172A]">{title}</h2>
            </div>
            {headerActions}
          </div>
        ) : (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(620px,0.95fr)] xl:items-center">
            <div className="flex min-w-0 items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-[#17365D] text-white shadow-[0_10px_22px_rgba(23,54,93,0.18)]">{icon}</span>
              <div className="min-w-0">
                {showSupportingCopy ? <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-[#64748B]">{eyebrow}</p> : null}
                <h2 className="mt-1 text-[18px] font-semibold leading-tight text-[#0F172A]">{title}</h2>
                {showSupportingCopy ? <p className="mt-1 max-w-2xl text-[11.5px] leading-5 text-[#64748B]">{description}</p> : null}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {metrics.map((metric) => (
                <div key={metric.label} className={`rounded-xl border px-3 py-2.5 ${metricTones[metric.tone ?? "slate"]}`}>
                  <p className="text-[8.5px] font-bold uppercase tracking-[0.08em] opacity-70">{metric.label}</p>
                  <p className="mt-1 text-[20px] font-semibold leading-none tabular-nums">{metric.value}</p>
                  <p className="mt-1 truncate text-[9.5px] font-medium opacity-75">{metric.hint}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {renderedChildren}
    </section>
  );
}

export function BrokerRegisterToolbar({
  query,
  onQueryChange,
  searchPlaceholder,
  children,
  action,
  activeViewLabel,
  leftControls,
  compact = false
}: BrokerRegisterToolbarProps) {
  return (
    <div className={`border-b border-[#E5ECF5] bg-white px-3 sm:px-4 ${compact ? "py-2" : "py-3"}`}>
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <label className={`relative min-w-[230px] flex-1 ${compact ? "lg:max-w-[360px]" : "lg:max-w-[520px]"}`}>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B93AA]" />
            <input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white pl-10 pr-3 text-[12px] text-[#0F172A] outline-none transition focus:border-[#17365D] focus:ring-2 focus:ring-[#17365D]/10"
            />
          </label>
          {leftControls}
          {activeViewLabel ? <span className="inline-flex h-9 items-center rounded-full border border-[#D8E2EE] bg-[#F8FAFC] px-3 text-[10px] font-semibold text-[#475569]">{activeViewLabel}</span> : null}
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
          {children}
          {action}
        </div>
      </div>
    </div>
  );
}

export function RegisterSelect({
  value,
  onChange,
  label,
  children
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="relative">
      <SlidersHorizontal className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#8B93AA]" />
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-10 min-w-[168px] rounded-xl border border-[#CBD5E1] bg-white pl-9 pr-8 text-[11px] font-semibold text-[#334155] outline-none transition focus:border-[#17365D] focus:ring-2 focus:ring-[#17365D]/10"
      >
        {children}
      </select>
    </label>
  );
}

export function RegisterViewTabs({
  value,
  options,
  onChange
}: RegisterViewTabsProps) {
  return (
    <div className="flex gap-1 overflow-x-auto rounded-xl border border-[#D8E2EE] bg-[#F8FAFC] p-1">
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={`h-8 shrink-0 rounded-lg px-3 text-[10.5px] font-bold transition ${active ? "bg-[#17365D] text-white shadow-sm" : "text-[#53627A] hover:bg-white"}`}
          >
            {option.label}{typeof option.count === "number" ? <span className={active ? "ml-1 text-white/75" : "ml-1 text-[#94A3B8]"}>{option.count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export function RegisterStatusPill({ tone, children }: { tone: MetricTone; children: ReactNode }) {
  return <span className={`inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9.5px] font-bold ${metricTones[tone]}`}><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" />{children}</span>;
}

export function RegisterPagination({
  pageRows,
  filteredRows,
  safePage,
  totalPages,
  pageSize,
  onPrevious,
  onNext
}: {
  pageRows: number;
  filteredRows: number;
  safePage: number;
  totalPages: number;
  pageSize: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-[#E5ECF5] bg-[#FBFCFE] px-3 py-3 text-[11px] text-[#64748B] sm:flex-row sm:items-center sm:justify-between">
      <p>Showing {pageRows ? (safePage - 1) * pageSize + 1 : 0}-{Math.min(safePage * pageSize, filteredRows)} of {filteredRows}</p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button type="button" disabled={safePage === 1} onClick={onPrevious} className="h-9 rounded-lg border border-[#CBD5E1] bg-white px-3 font-semibold text-[#334155] disabled:opacity-40">Previous</button>
        <span className="px-1 font-semibold">{safePage} / {totalPages}</span>
        <button type="button" disabled={safePage === totalPages} onClick={onNext} className="h-9 rounded-lg border border-[#CBD5E1] bg-white px-3 font-semibold text-[#334155] disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}

export function RegisterEmpty({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-4 py-16 text-center">
      <p className="text-[14px] font-semibold text-[#334155]">{title}</p>
      <p className="mt-1 text-[11px] text-[#94A3B8]">{description}</p>
    </div>
  );
}
