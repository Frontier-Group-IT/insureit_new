"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { PartnerHomeTrendPeriodFilter } from "./partner-home-trend-period-filter";

export type TrendPeriod = "6m" | "mtd" | "12m";
export type TrendPoint = {
  month: string;
  premium: number | string;
  policies: number;
  label?: string;
};

function formatCompactCurrency(value: number | string) {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatTooltipPremium(value: number | string) {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return "₹0";

  const formatUnit = (divisor: number, suffix: string) => {
    const scaled = amount / divisor;
    const digits = scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2;
    const formatted = new Intl.NumberFormat("en-IN", {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    }).format(scaled);
    return `₹${formatted} ${suffix}`;
  };

  if (Math.abs(amount) >= 10_000_000) return formatUnit(10_000_000, "Cr");
  if (Math.abs(amount) >= 100_000) return formatUnit(100_000, "L");

  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatPeriod(point: TrendPoint) {
  const parsed = new Date(`${point.month}-01T00:00:00Z`);
  const monthYear = Number.isNaN(parsed.getTime())
    ? point.month
    : new Intl.DateTimeFormat("en-IN", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(parsed);

  return point.label ? `${point.label} · ${monthYear}` : monthYear;
}

export function PartnerBusinessTrend({
  trend,
  period,
  periodLabel,
  iconSrc,
}: {
  trend: TrendPoint[];
  period: TrendPeriod;
  periodLabel: string;
  iconSrc: string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [pinnedIndex, setPinnedIndex] = useState<number | null>(null);
  const activeIndex = hoveredIndex ?? pinnedIndex;
  const points = trend;

  const chart = useMemo(() => {
    const maxPremium = Math.max(1, ...points.map((point) => Number(point.premium ?? 0)));
    const plotLeft = 30;
    const plotRight = 570;
    const plotTop = 28;
    const plotBottom = 150;
    const plotHeight = plotBottom - plotTop;
    const slotWidth = points.length > 1 ? (plotRight - plotLeft) / (points.length - 1) : 0;
    const barWidth = points.length >= 10 ? 26 : points.length >= 7 ? 34 : 44;

    return {
      maxPremium,
      plotLeft,
      plotRight,
      plotTop,
      plotBottom,
      plotHeight,
      slotWidth,
      barWidth,
    };
  }, [points]);

  const activePoint = activeIndex === null ? null : points[activeIndex] ?? null;
  const activeX = activeIndex === null
    ? null
    : points.length > 1
      ? chart.plotLeft + activeIndex * chart.slotWidth
      : 300;
  const tooltipLeft = activeX === null ? 50 : Math.min(91, Math.max(9, (activeX / 600) * 100));

  return (
    <div
      data-partner-business-trend="interactive"
      className="overflow-visible rounded-xl border border-[#DCE5F1] bg-white shadow-[0_4px_14px_rgba(25,50,90,0.05)]"
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-[#E6ECF3] px-4 py-3">
        <span className="grid h-6 w-6 place-items-center">
          <Image src={iconSrc} alt="" width={20} height={20} className="h-auto w-auto object-contain" />
        </span>
        <h2 className="min-w-0 flex-1 text-[14px] font-extrabold tracking-[-0.02em] text-[#142B50]">M/M Business Trend</h2>
        <div className="flex items-center gap-3 text-[8.5px] font-semibold text-[#6F8098]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm bg-[#A9CFFF]" />
            Net Premium
          </span>
        </div>
        <PartnerHomeTrendPeriodFilter period={period} label={periodLabel} />
        <Link
          href="/partner/business"
          prefetch={false}
          data-partner-home-reference-cta="true"
          className="inline-flex h-7 shrink-0 items-center justify-center gap-1 bg-[#163968] px-2.5 text-[8.5px] font-semibold text-white shadow-none transition hover:bg-[#102F59] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#163968]/30"
        >
          <span>View My Business</span>
          <ArrowRight className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>

      {points.length ? (
        <div className="relative px-1 pb-2 pt-3">
          {activePoint ? (
            <div
              data-partner-business-trend-tooltip="true"
              className="pointer-events-none absolute top-3 z-20 min-w-[155px] -translate-x-1/2 rounded-lg border border-[#C9D8EB] bg-white px-3 py-2 text-left shadow-[0_8px_24px_rgba(20,43,80,0.16)]"
              style={{ left: `${tooltipLeft}%` }}
            >
              <p className="text-[9px] font-extrabold text-[#24466F]">{formatPeriod(activePoint)}</p>
              <p className="mt-1 text-[8.5px] font-medium text-[#6F8098]">
                Net Premium: <span className="font-bold text-[#425D80]">{formatTooltipPremium(activePoint.premium)}</span>
              </p>
              <p className="mt-0.5 text-[8.5px] font-medium text-[#6F8098]">
                Policies: <span className="font-bold text-[#425D80]">{activePoint.policies}</span>
              </p>
            </div>
          ) : null}

          <svg
            viewBox="0 0 600 190"
            className="h-[210px] w-full"
            role="img"
            aria-label={`Net premium and policy totals for ${periodLabel.toLowerCase()}. Hover, focus, or click a period for details.`}
            onPointerLeave={() => setHoveredIndex(null)}
          >
            {[0, 1, 2, 3].map((grid) => {
              const y = chart.plotTop + (chart.plotHeight / 3) * grid;
              return <line key={grid} x1="8" x2="592" y1={y} y2={y} stroke="#E7EDF5" strokeWidth="1" />;
            })}

            {points.map((point, index) => {
              const x = points.length > 1 ? chart.plotLeft + index * chart.slotWidth : 300;
              const premium = Number(point.premium ?? 0);
              const barHeight = Math.max(4, (premium / chart.maxPremium) * chart.plotHeight);
              const y = chart.plotBottom - barHeight;
              const isActive = activeIndex === index;
              const hitWidth = points.length > 1 ? Math.max(42, chart.slotWidth * 0.86) : 120;

              return (
                <g
                  key={`${point.month}-${index}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${formatPeriod(point)}. Net Premium ${formatTooltipPremium(point.premium)}. ${point.policies} policies.`}
                  onPointerEnter={() => setHoveredIndex(index)}
                  onFocus={() => setHoveredIndex(index)}
                  onBlur={() => setHoveredIndex(null)}
                  onClick={() => setPinnedIndex((current) => (current === index ? null : index))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setPinnedIndex((current) => (current === index ? null : index));
                    }
                  }}
                  className="cursor-pointer outline-none"
                >
                  <rect
                    x={x - hitWidth / 2}
                    y={chart.plotTop - 10}
                    width={hitWidth}
                    height={chart.plotBottom - chart.plotTop + 48}
                    fill="transparent"
                  />
                  <rect
                    x={x - chart.barWidth / 2}
                    y={y}
                    width={chart.barWidth}
                    height={barHeight}
                    rx="5"
                    fill={isActive ? "#7CB4FF" : index === points.length - 1 ? "#8DBDFF" : "#C4DEFF"}
                    stroke={isActive ? "#4E8FE8" : "none"}
                    strokeWidth={isActive ? "1.5" : "0"}
                  />
                  <text
                    x={x}
                    y={Math.max(14, y - 7)}
                    textAnchor="middle"
                    fontSize={points.length >= 10 ? "6.5" : "8"}
                    fontWeight="700"
                    fill="#536987"
                  >
                    {formatCompactCurrency(point.premium)}
                  </text>
                  <text x={x} y="176" textAnchor="middle" fontSize={points.length >= 10 ? "7" : "9"} fontWeight="700" fill="#536987">
                    {point.label ?? formatPeriod(point).split(" ")[0]}
                  </text>
                  <text x={x} y="187" textAnchor="middle" fontSize={points.length >= 10 ? "6" : "7.5"} fontWeight="600" fill="#8391A5">
                    {point.policies} policies
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      ) : (
        <div className="grid min-h-[210px] place-items-center px-4 text-[10px] font-semibold text-[#7A899E]">No trend data available.</div>
      )}
    </div>
  );
}
