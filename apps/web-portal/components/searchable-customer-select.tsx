"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type SelectOption = { label: string; value: string };

export function SearchableCustomerSelect({
  name,
  options,
  defaultValue = "",
  placeholder = "Select customer",
  required = false,
}: {
  name: string;
  options: SelectOption[];
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(defaultValue ?? "");
  const [query, setQuery] = useState("");

  const selected = options.find((option) => option.value === value) ?? null;
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function choose(option: SelectOption) {
    setValue(option.value);
    setQuery("");
    setOpen(false);
  }

  return (
    <div ref={rootRef} className="relative min-w-0">
      <input type="hidden" name={name} value={value} />
      {required && !value ? <input className="sr-only" tabIndex={-1} required value="" onChange={() => undefined} aria-hidden="true" /> : null}
      <button
        id={name}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between rounded-xl border border-[#CBD5E1] bg-white px-3 text-left text-[12px] text-[#17203A] outline-none transition hover:border-[#AAB7C8] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF]"
      >
        <span className={selected ? "truncate" : "truncate text-[#667085]"}>{selected?.label ?? placeholder}</span>
        <ChevronDown className="h-4 w-4 shrink-0 text-[#17203A]" aria-hidden="true" />
      </button>

      {open ? (
        <div className="absolute z-50 mt-1.5 w-full min-w-[260px] overflow-hidden rounded-xl border border-[#D8E2EF] bg-white shadow-[0_14px_35px_rgba(15,23,42,0.16)]">
          <div className="border-b border-[#E7ECF3] p-2">
            <div className="flex h-9 items-center gap-2 rounded-lg border border-[#CBD5E1] bg-white px-2.5 focus-within:border-[#4F46E5] focus-within:ring-2 focus-within:ring-[#E0E7FF]">
              <Search className="h-3.5 w-3.5 shrink-0 text-[#64748B]" aria-hidden="true" />
              <input
                ref={inputRef}
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setOpen(false);
                    setQuery("");
                  }
                }}
                placeholder="Search customer..."
                className="min-w-0 flex-1 bg-transparent text-[11.5px] text-[#17203A] outline-none placeholder:text-[#98A2B3]"
                aria-label="Search customer"
              />
            </div>
          </div>
          <div role="listbox" aria-label="Customers" className="max-h-60 overflow-y-auto p-1.5">
            {filtered.length ? filtered.map((option) => (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={option.value === value}
                onClick={() => choose(option)}
                className={`block w-full rounded-lg px-2.5 py-2 text-left text-[11.5px] transition hover:bg-[#F3F7FB] ${option.value === value ? "bg-[#EEF4FA] font-semibold text-[#17365D]" : "text-[#334155]"}`}
              >
                {option.label}
              </button>
            )) : <div className="px-3 py-4 text-center text-[10.5px] text-[#667085]">No customers found</div>}
          </div>
        </div>
      ) : null}
    </div>
  );
}
