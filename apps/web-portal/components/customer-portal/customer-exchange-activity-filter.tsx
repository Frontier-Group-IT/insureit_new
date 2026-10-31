"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";

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
        className="flex items-center justify-center gap-2 rounded-lg border border-[#E7ECF7] bg-[#F4F7FD] px-3 py-2.5 text-[11px] font-bold text-[#123967]">
        <span>{options.find(option => option[0] === activeFilter)?.[1] ?? "All"}</span>
        <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      </button>
      {open ? <nav id="customer-exchange-activity-filter-options" aria-label="Exchange activity filters" className="absolute right-0 z-30 mt-2 min-w-[175px] rounded-xl border border-[#DCE4EE] bg-white p-1 shadow-lg">
        {options.map(([key, label, count]) => (
          <Link key={key} href={{pathname:"/customer/exchange", query:{account:accountId,tab:"activity",activityFilter:key,...(search?{activityQuery:search}:{})}}}
            onClick={() => setOpen(false)} aria-current={activeFilter === key ? "page" : undefined}
            className={`block rounded-lg px-3 py-2 text-[11px] transition hover:bg-[#EAF1FB] ${activeFilter === key ? "bg-[#E7F0FD] font-bold text-[#123967]" : "text-[#6880A4]"}`}>
            {label} ({count})
          </Link>
        ))}
      </nav> : null}
    </div>
  );
}
