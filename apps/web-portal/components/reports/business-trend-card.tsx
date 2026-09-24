"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { OverviewTrendPeriod } from "@/components/reports/reports-overview-toolbar";

export type BusinessTrendPoint = {
  key: string;
  label: string;
  axisLabel: string;
  policy_count: number;
  net_premium: number;
};

type Props = {
  activePeriod: OverviewTrendPeriod;
  options: Array<{ value: OverviewTrendPeriod; label: string; href: string }>;
  points: BusinessTrendPoint[];
};

export function BusinessTrendCard({ activePeriod, options, points }: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (open && menuRef.current && !menuRef.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const activeLabel = options.find((option) => option.value === activePeriod)?.label ?? "Last 6 Months";

  return (
    <article className="ov-card ov-section">
      <div className="ov-section-head">
        <h2>Business Trend</h2>
        <div ref={menuRef} className="relative">
          <button type="button" className="ov-mini-select" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
            {activeLabel} <ChevronDown className="h-3 w-3" />
          </button>
          {open ? (
            <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-40 min-w-[145px] overflow-hidden rounded-lg border border-[#d8e0eb] bg-white p-1.5 shadow-[0_14px_35px_rgba(25,45,78,0.16)]">
              {options.map((option) => (
                <Link
                  key={option.value}
                  href={option.href}
                  prefetch={false}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={`flex w-full items-center rounded-md px-3 py-2 text-[11px] font-semibold transition hover:bg-[#f1f5fb] ${
                    option.value === activePeriod ? "bg-[#eef4fb] text-[#174b82]" : "text-[#344862]"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      <BusinessTrendChart points={points} hoveredIndex={hoveredIndex} setHoveredIndex={setHoveredIndex} />
    </article>
  );
}

function BusinessTrendChart({
  points,
  hoveredIndex,
  setHoveredIndex,
}: {
  points: BusinessTrendPoint[];
  hoveredIndex: number | null;
  setHoveredIndex: (index: number | null) => void;
}) {
  if (!points.length) return <div className="r2-empty">No business trend available for the selected period</div>;

  const width = 720;
  const height = 220;
  const pad = { left: 48, right: 46, top: 28, bottom: 38 };
  const premiumMax = Math.max(...points.map((row) => row.net_premium), 1);
  const policyMax = Math.max(...points.map((row) => row.policy_count), 1);
  const plotWidth = width - pad.left - pad.right;
  const x = (index: number) => pad.left + (points.length === 1 ? plotWidth / 2 : index * (plotWidth / (points.length - 1)));
  const yPremium = (value: number) => height - pad.bottom - (value / premiumMax) * (height - pad.top - pad.bottom);
  const yPolicy = (value: number) => height - pad.bottom - (value / policyMax) * (height - pad.top - pad.bottom);
  const premiumPoints = points.map((row, index) => `${x(index)},${yPremium(row.net_premium)}`).join(" ");
  const policyPoints = points.map((row, index) => `${x(index)},${yPolicy(row.policy_count)}`).join(" ");
  const hoverWidth = points.length === 1 ? plotWidth : Math.max(24, plotWidth / Math.max(points.length - 1, 1));
  const hovered = hoveredIndex == null ? null : points[hoveredIndex] ?? null;

  return (
    <div className="ov-chart">
      <div className="ov-chart-legend">
        <span><i className="ov-dot ov-dot--blue" />Net Premium (₹ Lakh)</span>
        <span><i className="ov-dot ov-dot--slate" />Policies (Count)</span>
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Net premium and policy count trend" onMouseLeave={() => setHoveredIndex(null)}>
        {[0, .25, .5, .75, 1].map((tick) => {
          const y = pad.top + tick * (height - pad.top - pad.bottom);
          return <line key={tick} x1={pad.left} x2={width - pad.right} y1={y} y2={y} className="ov-grid-line" />;
        })}
        <polyline points={premiumPoints} fill="none" className="ov-line ov-line--premium" />
        <polyline points={policyPoints} fill="none" className="ov-line ov-line--policies" />

        {points.map((row, index) => (
          <g key={row.key}>
            <rect
              x={Math.max(pad.left, x(index) - hoverWidth / 2)}
              y={pad.top}
              width={Math.min(hoverWidth, width - pad.right - Math.max(pad.left, x(index) - hoverWidth / 2))}
              height={height - pad.top - pad.bottom}
              fill="transparent"
              onMouseEnter={() => setHoveredIndex(index)}
            />
            {hoveredIndex === index ? <line x1={x(index)} x2={x(index)} y1={pad.top} y2={height - pad.bottom} stroke="#9db0c8" strokeWidth="1" strokeDasharray="3 4" /> : null}
            <circle cx={x(index)} cy={yPremium(row.net_premium)} r={hoveredIndex === index ? "5" : "3.5"} className="ov-point ov-point--premium" onMouseEnter={() => setHoveredIndex(index)} />
            <circle cx={x(index)} cy={yPolicy(row.policy_count)} r={hoveredIndex === index ? "4.5" : "3"} className="ov-point ov-point--policies" onMouseEnter={() => setHoveredIndex(index)} />
            {shouldShowAxisLabel(index, points.length) ? (
              <text x={x(index)} y={height - 13} textAnchor="middle" className="ov-axis-label">{row.axisLabel}</text>
            ) : null}
          </g>
        ))}

        <text x="8" y="16" className="ov-axis-label">{compactMoney(premiumMax)}</text>
        <text x={width - 5} y="16" textAnchor="end" className="ov-axis-label">{number(policyMax)}</text>

        {hovered && hoveredIndex != null ? <Tooltip x={x(hoveredIndex)} width={width} point={hovered} /> : null}
      </svg>
    </div>
  );
}

function Tooltip({ x, width, point }: { x: number; width: number; point: BusinessTrendPoint }) {
  const boxWidth = 168;
  const boxHeight = 58;
  const boxX = Math.min(Math.max(8, x - boxWidth / 2), width - boxWidth - 8);
  return (
    <g pointerEvents="none">
      <rect x={boxX} y="34" width={boxWidth} height={boxHeight} rx="8" fill="#ffffff" stroke="#d8e0eb" strokeWidth="1" />
      <text x={boxX + 10} y="50" fontSize="9.5" fontWeight="700" fill="#17365d">{point.label}</text>
      <text x={boxX + 10} y="66" fontSize="9" fill="#4d607a">Net Premium: {compactMoney(point.net_premium)}</text>
      <text x={boxX + 10} y="81" fontSize="9" fill="#4d607a">Policies: {number(point.policy_count)}</text>
    </g>
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


function shouldShowAxisLabel(index: number, total: number) {
  if (total <= 8) return true;
  const step = Math.ceil(total / 6);
  return index === 0 || index === total - 1 || index % step === 0;
}
