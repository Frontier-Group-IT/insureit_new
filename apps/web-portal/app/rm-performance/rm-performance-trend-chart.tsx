"use client";

import { useMemo, useState } from "react";

type TrendRow = {
  month: string;
  policy_count: number;
  net_premium: number;
};

export function RmPerformanceTrendChart({ rows }: { rows: TrendRow[] }) {
  const values = useMemo(() => rows.slice(-6), [rows]);
  const points = useMemo(() => buildPoints(values), [values]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (!values.length) {
    return (
      <div className="grid h-[86px] place-items-center rounded-xl bg-[#F7F9FC] text-[8px] font-medium text-[#98A2B3]">
        No trend data
      </div>
    );
  }

  const hovered = hoveredIndex === null ? null : points.dots[hoveredIndex];
  const hoveredRow = hoveredIndex === null ? null : values[hoveredIndex];

  return (
    <div className="relative">
      <svg
        viewBox="0 0 300 86"
        className="h-[86px] w-full overflow-visible"
        role="img"
        aria-label="Recent monthly net premium trend"
        onMouseLeave={() => setHoveredIndex(null)}
      >
        <defs>
          <linearGradient id="rm-performance-hover-area" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#2E5FA7" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2E5FA7" stopOpacity="0.01" />
          </linearGradient>
        </defs>

        <path d={points.area} fill="url(#rm-performance-hover-area)" />
        <polyline
          points={points.line}
          fill="none"
          stroke="#2E5FA7"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.dots.map((dot, index) => {
          const active = hoveredIndex === index;
          return (
            <g key={dot.key}>
              {active ? (
                <line
                  x1={dot.x}
                  x2={dot.x}
                  y1="6"
                  y2="76"
                  stroke="#B9C8DC"
                  strokeWidth="1"
                  strokeDasharray="3 4"
                />
              ) : null}
              <circle
                cx={dot.x}
                cy={dot.y}
                r={active ? 5.2 : 3.7}
                fill={active ? "#2E5FA7" : "#FFFFFF"}
                stroke="#2E5FA7"
                strokeWidth="2.2"
                className="cursor-pointer transition-all duration-150"
                onMouseEnter={() => setHoveredIndex(index)}
                onFocus={() => setHoveredIndex(index)}
                tabIndex={0}
              />
              <circle
                cx={dot.x}
                cy={dot.y}
                r="13"
                fill="transparent"
                className="cursor-pointer"
                onMouseEnter={() => setHoveredIndex(index)}
              />
            </g>
          );
        })}
      </svg>

      {hovered && hoveredRow ? (
        <div
          className="pointer-events-none absolute z-10 min-w-[118px] -translate-x-1/2 rounded-xl border border-[#DCE5F1] bg-white px-3 py-2 shadow-[0_10px_24px_rgba(31,51,81,.14)]"
          style={{
            left: String((hovered.x / 300) * 100) + "%",
            top: String(Math.max(0, hovered.y - 54)) + "px",
          }}
        >
          <p className="text-[7px] font-black uppercase tracking-[.08em] text-[#8A96A7]">
            {monthLabel(hoveredRow.month)}
          </p>
          <p className="mt-1 text-[10px] font-black text-[#17365D]">
            {compactMoney(hoveredRow.net_premium)}
          </p>
          <p className="mt-0.5 text-[7.5px] text-[#7D8999]">
            {number(hoveredRow.policy_count)} policies
          </p>
        </div>
      ) : null}

      <div className="mt-1 grid grid-cols-6 gap-1 text-center">
        {values.map((row, index) => (
          <button
            key={row.month}
            type="button"
            onMouseEnter={() => setHoveredIndex(index)}
            onFocus={() => setHoveredIndex(index)}
            className={"text-[6.5px] font-bold transition-colors " + (hoveredIndex === index ? "text-[#17365D]" : "text-[#8A96A6]")}
          >
            {monthLabel(row.month)}
          </button>
        ))}
      </div>
    </div>
  );
}

function buildPoints(values: TrendRow[]) {
  const width = 300;
  const height = 76;
  const padX = 12;
  const padY = 10;
  const max = Math.max(...values.map((row) => row.net_premium), 1);
  const min = Math.min(...values.map((row) => row.net_premium), 0);
  const span = Math.max(max - min, 1);

  const dots = values.map((row, index) => {
    const x = values.length === 1
      ? width / 2
      : padX + (index * (width - padX * 2)) / (values.length - 1);
    const y = padY + ((max - row.net_premium) / span) * (height - padY * 2);
    return { key: row.month, x, y };
  });

  const line = dots.map((dot) => dot.x.toFixed(1) + "," + dot.y.toFixed(1)).join(" ");
  const area = dots.length
    ? "M " + dots[0].x.toFixed(1) + " " + height + " L "
      + dots.map((dot) => dot.x.toFixed(1) + " " + dot.y.toFixed(1)).join(" L ")
      + " L " + dots[dots.length - 1].x.toFixed(1) + " " + height + " Z"
    : "";

  return { line, area, dots };
}

function compactMoney(value: number) {
  const n = Math.abs(value || 0);
  if (n >= 10000000) return "₹" + (value / 10000000).toFixed(2) + " Cr";
  if (n >= 100000) return "₹" + (value / 100000).toFixed(1) + " L";
  if (n >= 1000) return "₹" + (value / 1000).toFixed(1) + " K";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function number(value: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0);
}

function monthLabel(value: string) {
  const date = value ? new Date(value.slice(0, 7) + "-01T00:00:00Z") : null;
  return date && !Number.isNaN(date.getTime())
    ? new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(date)
    : value;
}
