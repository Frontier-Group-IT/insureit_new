"use client";

import { useMemo, useState } from "react";
import { Building2, ChevronDown } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type OverviewBusinessScope = "all" | "motor" | "non_motor" | "life" | "health";
export type OverviewTrendPeriod = "mtd" | "last_month" | "last_6_months" | "year";
export type OverviewTrendPoint = {
  key: string;
  label: string;
  axisLabel?: string;
  policyCount: number;
  netPremium: number;
};

const BUSINESS_OPTIONS: Array<{ key: OverviewBusinessScope; label: string }> = [
  { key: "all", label: "All Business" },
  { key: "motor", label: "Motor" },
  { key: "non_motor", label: "Non Motor" },
  { key: "life", label: "Life" },
  { key: "health", label: "Health" },
];

const TREND_OPTIONS: Array<{ key: OverviewTrendPeriod; label: string }> = [
  { key: "mtd", label: "MTD" },
  { key: "last_month", label: "Last Month" },
  { key: "last_6_months", label: "Last 6 Months" },
  { key: "year", label: "1 Year" },
];

function useQuerySelection() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  return (name: string, value: string, removeWhen?: string) => {
    const next = new URLSearchParams(params.toString());
    if (value === removeWhen) next.delete(name);
    else next.set(name, value);
    router.push(`${pathname}?${next.toString()}`);
  };
}

export function ReportOverviewBusinessControl({ value }: { value: OverviewBusinessScope }) {
  const [open, setOpen] = useState(false);
  const select = useQuerySelection();
  const label = BUSINESS_OPTIONS.find((option) => option.key === value)?.label ?? "All Business";

  return (
    <div className="ov-dropdown">
      <button type="button" className="ov-control" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((state) => !state)}>
        <Building2 className="h-3.5 w-3.5" /><span>{label}</span><ChevronDown className="h-3 w-3" />
      </button>
      {open ? (
        <>
          <button type="button" aria-label="Close business menu" className="ov-dropdown-scrim" onClick={() => setOpen(false)} />
          <div className="ov-dropdown-menu" role="menu">
            {BUSINESS_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                role="menuitem"
                className={`ov-dropdown-option ${option.key === value ? "ov-dropdown-option--active" : ""}`}
                onClick={() => {
                  setOpen(false);
                  select("business_scope", option.key, "all");
                }}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

export function ReportOverviewBusinessTrend({
  period,
  points,
}: {
  period: OverviewTrendPeriod;
  points: OverviewTrendPoint[];
}) {
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const select = useQuerySelection();
  const label = TREND_OPTIONS.find((option) => option.key === period)?.label ?? "Last 6 Months";

  const chart = useMemo(() => {
    const width = 720;
    const height = 220;
    const pad = { left: 48, right: 46, top: 28, bottom: 38 };
    const premiumMax = Math.max(...points.map((row) => row.netPremium), 1);
    const policyMax = Math.max(...points.map((row) => row.policyCount), 1);
    const x = (index: number) => pad.left + (points.length <= 1 ? 0 : index * ((width - pad.left - pad.right) / (points.length - 1)));
    const yPremium = (value: number) => height - pad.bottom - (value / premiumMax) * (height - pad.top - pad.bottom);
    const yPolicy = (value: number) => height - pad.bottom - (value / policyMax) * (height - pad.top - pad.bottom);
    return { width, height, pad, premiumMax, policyMax, x, yPremium, yPolicy };
  }, [points]);

  return (
    <article className="ov-card ov-section">
      <div className="ov-section-head">
        <h2>Business Trend</h2>
        <div className="ov-dropdown">
          <button type="button" className="ov-mini-select" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((state) => !state)}>
            {label}<ChevronDown className="h-3 w-3" />
          </button>
          {open ? (
            <>
              <button type="button" aria-label="Close trend period menu" className="ov-dropdown-scrim" onClick={() => setOpen(false)} />
              <div className="ov-dropdown-menu ov-dropdown-menu--trend" role="menu">
                {TREND_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    role="menuitem"
                    className={`ov-dropdown-option ${option.key === period ? "ov-dropdown-option--active" : ""}`}
                    onClick={() => {
                      setOpen(false);
                      select("trend_period", option.key, "last_6_months");
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {!points.length ? <div className="r2-empty">No business trend available</div> : (
        <div className="ov-chart">
          <div className="ov-chart-legend"><span><i className="ov-dot ov-dot--blue" />Net Premium (₹ Lakh)</span><span><i className="ov-dot ov-dot--slate" />Policies (Count)</span></div>
          <div className="ov-chart-stage">
            <svg viewBox={`0 0 ${chart.width} ${chart.height}`} role="img" aria-label="Net premium and policy count trend" onMouseLeave={() => setHovered(null)}>
              {[0, .25, .5, .75, 1].map((tick) => {
                const y = chart.pad.top + tick * (chart.height - chart.pad.top - chart.pad.bottom);
                return <line key={tick} x1={chart.pad.left} x2={chart.width - chart.pad.right} y1={y} y2={y} className="ov-grid-line" />;
              })}
              <polyline points={points.map((row, index) => `${chart.x(index)},${chart.yPremium(row.netPremium)}`).join(" ")} fill="none" className="ov-line ov-line--premium" />
              <polyline points={points.map((row, index) => `${chart.x(index)},${chart.yPolicy(row.policyCount)}`).join(" ")} fill="none" className="ov-line ov-line--policies" />
              {points.map((row, index) => (
                <g key={row.key}>
                  <line x1={chart.x(index)} x2={chart.x(index)} y1={chart.pad.top} y2={chart.height - chart.pad.bottom} className={hovered === index ? "ov-hover-line ov-hover-line--active" : "ov-hover-line"} />
                  <circle cx={chart.x(index)} cy={chart.yPremium(row.netPremium)} r="3.5" className="ov-point ov-point--premium" />
                  <circle cx={chart.x(index)} cy={chart.yPolicy(row.policyCount)} r="3" className="ov-point ov-point--policies" />
                  <rect
                    x={Math.max(chart.pad.left, chart.x(index) - (points.length > 1 ? ((chart.width - chart.pad.left - chart.pad.right) / (points.length - 1)) / 2 : 20))}
                    y={chart.pad.top}
                    width={points.length > 1 ? Math.max(20, (chart.width - chart.pad.left - chart.pad.right) / (points.length - 1)) : 40}
                    height={chart.height - chart.pad.top - chart.pad.bottom}
                    fill="transparent"
                    onMouseEnter={() => setHovered(index)}
                    onMouseMove={() => setHovered(index)}
                  />
                  <text x={chart.x(index)} y={chart.height - 13} textAnchor="middle" className="ov-axis-label">{row.axisLabel ?? row.label}</text>
                </g>
              ))}
              <text x="8" y="16" className="ov-axis-label">{compactMoney(chart.premiumMax)}</text>
              <text x={chart.width - 5} y="16" textAnchor="end" className="ov-axis-label">{number(chart.policyMax)}</text>
            </svg>
            {hovered != null && points[hovered] ? (
              <div className="ov-chart-tooltip" style={{ left: `${(chart.x(hovered) / chart.width) * 100}%` }}>
                <strong>{points[hovered].label}</strong>
                <span>Net Premium <b>{compactMoney(points[hovered].netPremium)}</b></span>
                <span>Policies <b>{number(points[hovered].policyCount)}</b></span>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </article>
  );
}

function compactMoney(value: number) {
  const absolute = Math.abs(value || 0);
  if (absolute >= 10_000_000) return `₹${(value / 10_000_000).toFixed(2)} Cr`;
  if (absolute >= 100_000) return `₹${(value / 100_000).toFixed(1)} L`;
  if (absolute >= 1_000) return `₹${(value / 1_000).toFixed(1)} K`;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0);
}

function number(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}
