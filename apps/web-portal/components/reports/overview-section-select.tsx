"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

type Option = { value: string; label: string; href: string };

export function OverviewSectionSelect({
  label,
  options,
}: {
  label: string;
  options: Option[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onMouseDown(event: MouseEvent) {
      if (open && ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
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

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        className="ov-mini-select"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {label} <ChevronDown className="h-3 w-3" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-[calc(100%+6px)] z-40 min-w-[145px] overflow-hidden rounded-lg border border-[#d8e0eb] bg-white p-1.5 shadow-[0_14px_35px_rgba(25,45,78,0.16)]"
        >
          {options.map((option) => (
            <Link
              key={option.value}
              href={option.href}
              prefetch={false}
              role="menuitem"
              onClick={() => setOpen(false)}
              className={`flex w-full items-center rounded-md px-3 py-2 text-[11px] font-semibold transition hover:bg-[#f1f5fb] ${
                option.label === label ? "bg-[#eef4fb] text-[#174b82]" : "text-[#344862]"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
