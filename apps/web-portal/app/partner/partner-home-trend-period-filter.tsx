"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";

export type PartnerHomeTrendPeriod = "6m" | "mtd" | "12m";

const OPTIONS: { value: PartnerHomeTrendPeriod; label: string }[] = [
  { value: "6m", label: "Last 6 Months" },
  { value: "mtd", label: "MTD" },
  { value: "12m", label: "Last 12 Months" },
];

export function PartnerHomeTrendPeriodFilter({
  period,
  label,
}: {
  period: PartnerHomeTrendPeriod;
  label: string;
}) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const selectPeriod = (value: PartnerHomeTrendPeriod) => {
    setOpen(false);
    if (value === period) return;
    router.push(value === "6m" ? "/partner" : `/partner?trend=${value}`);
  };

  return (
    <>
      <div ref={rootRef} className="partner-home-trend-period-filter relative shrink-0">
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#DDE5EF] bg-[#F9FBFE] px-2.5 py-1.5 text-[8.5px] font-semibold text-[#526784] transition hover:bg-[#F4F7FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20"
        >
          <span>{label}</span>
          <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>

        {open ? (
          <div
            role="menu"
            className="absolute left-0 z-30 mt-1.5 w-36 overflow-hidden rounded-lg border border-[#DCE5F1] bg-white p-1 shadow-[0_8px_24px_rgba(25,50,90,0.14)]"
          >
            {OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={period === option.value}
                onClick={() => selectPeriod(option.value)}
                className={`block w-full rounded-md px-2.5 py-2 text-left text-[9px] font-semibold transition ${period === option.value ? "bg-[#EEF4FF] text-[#244F9E]" : "text-[#526784] hover:bg-[#F5F8FC]"}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>

      <style>{`
        div:has(> .partner-home-trend-period-filter) > h2 {
          flex: 0 1 auto !important;
        }

        div:has(> .partner-home-trend-period-filter) > .partner-home-trend-period-filter {
          order: 1;
        }

        div:has(> .partner-home-trend-period-filter) > div:not(.partner-home-trend-period-filter) {
          order: 2;
          margin-left: auto;
        }

        div:has(> .partner-home-trend-period-filter) > a {
          order: 3;
        }
      `}</style>
    </>
  );
}
