"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown } from "lucide-react";

type FilterOption = [key: string, label: string, count: number];

export function CustomerExchangeActivityFilter({ accountId, activeFilter, search, options }: {
  accountId: string;
  activeFilter: string;
  search: string;
  options: FilterOption[];
}) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => { setOpen(false); }, [activeFilter, search]);
  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", dismiss);
    document.addEventListener("keydown", escape);
    return () => { document.removeEventListener("pointerdown", dismiss); document.removeEventListener("keydown", escape); };
  }, [open]);
  return (
    <div ref={container} className="relative ml-auto">
      <button type="button" aria-label="Filter Exchange activity" aria-expanded={open} aria-controls="customer-exchange-activity-filter-options"
        onClick={() => setOpen(current => !current)}
        className="flex min-h-9 items-center justify-center gap-2 rounded-xl border border-[#D9E3F0] bg-white px-3 py-2 text-[11px] font-semibold text-[#17365D] shadow-sm transition hover:border-[#A9B9D1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EEE9FF]">
        <span>{options.find(option => option[0] === activeFilter)?.[1] ?? "All"}</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      </button>
      {open ? <nav id="customer-exchange-activity-filter-options" aria-label="Exchange activity filters" className="absolute right-0 z-30 mt-2 min-w-[190px] overflow-hidden rounded-xl border border-[#D9E3F0] bg-white p-1.5 shadow-[0_12px_28px_rgba(23,54,93,.13)]">
        {options.map(([key, label, count]) => (
          <Link key={key} href={{pathname:"/customer/exchange", query:{account:accountId,tab:"activity",activityFilter:key,...(search?{activityQuery:search}:{})}}}
            onClick={() => setOpen(false)} aria-current={activeFilter === key ? "page" : undefined}
            className={`flex min-h-9 items-center justify-between gap-3 rounded-lg px-3 py-2 text-[11px] transition-colors hover:bg-[#F3F7FF] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#EEE9FF] ${activeFilter === key ? "bg-[#EEE9FF] font-bold text-[#6950E8]" : "font-medium text-[#17365D]"}`}>
            <span>{label} ({count})</span>{activeFilter === key ? <Check aria-hidden="true" className="h-3.5 w-3.5 shrink-0" /> : null}
          </Link>
        ))}
      </nav> : null}
    </div>
  );
}
