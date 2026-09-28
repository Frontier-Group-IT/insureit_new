"use client";

import { useMemo, useState } from "react";

type TrendRow = { month: string; policy_count: number; net_premium: number };

export function RmPerformanceTrendChart({ rows }: { rows: TrendRow[] }) {
  const values = useMemo(() => rows.slice(-6), [rows]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  if (!values.length) return <div className="grid h-[98px] place-items-center rounded-xl bg-[#F7F9FC] text-[10px] font-medium text-[#687589]">No trend data</div>;

  const max = Math.max(...values.map((row) => row.net_premium), 1);
  return (
    <div className="relative" onMouseLeave={() => setHoveredIndex(null)}>
      <div className="grid h-[104px] grid-cols-6 items-end gap-2 px-1 pt-5">
        {values.map((row, index) => {
          const height = row.net_premium > 0 ? Math.max((row.net_premium / max) * 70, 18) : 4;
          const active = hoveredIndex === index;
          return (
            <div key={row.month} className="relative flex h-full min-w-0 flex-col items-center justify-end" onMouseEnter={() => setHoveredIndex(index)}>
              <span className="absolute text-[8px] font-black text-[#43556F]" style={{ bottom: `${height + 3}px` }}>{number(row.policy_count)}</span>
              {active ? <div className="pointer-events-none absolute left-1/2 z-20 w-max -translate-x-1/2 rounded-lg border border-[#DCE5F1] bg-white px-2 py-1.5 text-center shadow-md" style={{ bottom: `${height + 17}px` }}><p className="text-[8px] font-black uppercase text-[#647286]">{monthLabel(row.month)}</p><p className="text-[9px] font-black text-[#17365D]">{compactMoney(row.net_premium)}</p><p className="text-[8px] text-[#667386]">{number(row.policy_count)} policies</p></div> : null}
              <div className={"relative w-full max-w-[34px] rounded-t-md transition-all " + (active ? "bg-[#17365D]" : "bg-[#2E6CB5]")} style={{ height: `${height}px` }} />
            </div>
          );
        })}
      </div>
      <div className="mt-1 grid grid-cols-6 gap-2 text-center">{values.map((row, index) => <button key={row.month} type="button" onMouseEnter={() => setHoveredIndex(index)} onFocus={() => setHoveredIndex(index)} onBlur={() => setHoveredIndex(null)} className={"min-w-0 transition-colors " + (hoveredIndex === index ? "text-[#17365D]" : "text-[#657286]")}><span className="block text-[9px] font-bold">{monthLabel(row.month)}</span><span className="mt-0.5 block truncate text-[7.5px] font-black text-[#43556F]">{compactMoney(row.net_premium)}</span></button>)}</div>
    </div>
  );
}

function compactMoney(value: number) { const n = Math.abs(value || 0); if (n >= 10000000) return "₹" + (value / 10000000).toFixed(2) + "Cr"; if (n >= 100000) return "₹" + (value / 100000).toFixed(1) + "L"; if (n >= 1000) return "₹" + (value / 1000).toFixed(1) + "K"; return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value || 0); }
function number(value: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(value || 0); }
function monthLabel(value: string) { const date = value ? new Date(value.slice(0, 7) + "-01T00:00:00Z") : null; return date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat("en-IN", { month: "short", timeZone: "UTC" }).format(date) : value; }
