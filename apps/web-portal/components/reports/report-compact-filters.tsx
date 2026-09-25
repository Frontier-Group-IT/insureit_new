"use client";

import { Building2, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";

export type ReportCompactFilterOption = { value: string; label: string };
export type ReportCompactFilterField = {
  name: string;
  label: string;
  value: string;
  type?: "select" | "date";
  options?: ReportCompactFilterOption[];
  placeholder?: string;
};

export function ReportCompactFilters({
  path,
  businessLine,
  category,
  categories,
  period,
  fromDate,
  toDate,
  fields,
  compactDrawer = false,
  clearAppliedFilters = false,
}: {
  path: string;
  businessLine: "Motor" | "Non Motor" | null;
  category: string | null;
  categories: string[];
  period: string;
  fromDate: string | null;
  toDate: string | null;
  fields: ReportCompactFilterField[];
  compactDrawer?: boolean;
  clearAppliedFilters?: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [businessOpen, setBusinessOpen] = useState(false);
  const businessRef = useRef<HTMLDivElement>(null);
  const [draftCategory, setDraftCategory] = useState(category ?? "");
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.name, field.value])));

  useEffect(() => {
    setDraftCategory(category ?? "");
    setDraft(Object.fromEntries(fields.map((field) => [field.name, field.value])));
  }, [category, fields]);

  useEffect(() => {
    if (!open && !businessOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (businessOpen && businessRef.current && !businessRef.current.contains(event.target as Node)) {
        setBusinessOpen(false);
      }
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        setBusinessOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, businessOpen]);

  const activeCount = useMemo(() => {
    let count = businessLine === "Non Motor" && category ? 1 : 0;
    for (const field of fields) {
      if (field.type === "date") continue;
      if (field.value) count += 1;
    }
    if (period === "custom" && (fromDate || toDate)) count += 1;
    return count;
  }, [businessLine, category, fields, fromDate, period, toDate]);

  function applyBusiness(value: string) {
    setBusinessOpen(false);
    const next = new URLSearchParams(searchParams.toString());
    if (value === "Motor" || value === "Non Motor") next.set("business", value);
    else next.delete("business");
    if (value !== "Non Motor") next.delete("category");
    clearPages(next);
    router.push(next.size ? `${path}?${next.toString()}` : path);
  }

  function applyAdvanced() {
    const next = new URLSearchParams(searchParams.toString());
    if (businessLine === "Non Motor" && draftCategory) next.set("category", draftCategory);
    else next.delete("category");

    const dateFields = fields.filter((field) => field.type === "date");
    const nonDateFields = fields.filter((field) => field.type !== "date");
    for (const field of nonDateFields) {
      const value = (draft[field.name] ?? "").trim();
      if (value) next.set(field.name, value);
      else next.delete(field.name);
    }

    const draftFrom = draft.from ?? "";
    const draftTo = draft.to ?? "";
    const datesChanged = dateFields.some((field) => (draft[field.name] ?? "") !== field.value);
    if (datesChanged || period === "custom") {
      next.set("period", "custom");
      if (draftFrom) next.set("from", draftFrom); else next.delete("from");
      if (draftTo) next.set("to", draftTo); else next.delete("to");
    } else {
      next.delete("from");
      next.delete("to");
    }

    clearPages(next);
    setOpen(false);
    router.push(next.size ? `${path}?${next.toString()}` : path);
  }

  function clearAdvanced() {
    if (clearAppliedFilters) {
      const next = new URLSearchParams(searchParams.toString());
      next.delete("category");
      for (const field of fields) next.delete(field.name);
      if (period === "custom") next.set("period", "90d");
      clearPages(next);

      setDraft(Object.fromEntries(fields.map((field) => [field.name, ""])));
      setDraftCategory("");
      setOpen(false);
      router.push(next.size ? `${path}?${next.toString()}` : path);
      return;
    }

    const nextDraft: Record<string, string> = {};
    for (const field of fields) nextDraft[field.name] = field.type === "date" ? field.value : "";
    setDraft(nextDraft);
    setDraftCategory("");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <div ref={businessRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={businessOpen}
            onClick={() => setBusinessOpen((current) => !current)}
            className="inline-flex h-9 min-w-[148px] items-center justify-between gap-2 rounded-lg border border-[#d9e0e8] bg-white px-3 text-[10.5px] font-bold text-[#344054] outline-none transition hover:border-[#b9c5d2] hover:bg-[#f8fafc] focus-visible:border-[#b9c5d2] focus-visible:ring-1 focus-visible:ring-[#d7dee7]"
          >
            <span className="inline-flex items-center gap-2">
              <Building2 className="h-3.5 w-3.5 text-[#61738a]" />
              <span>{businessLine ?? "All Business"}</span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-[#61738a]" />
          </button>

          {businessOpen ? (
            <div
              role="menu"
              aria-label="Business line"
              className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[165px] overflow-hidden rounded-lg border border-[#d8e0eb] bg-white p-1.5 shadow-[0_14px_35px_rgba(25,45,78,0.16)]"
            >
              {[
                { value: "", label: "All Business" },
                { value: "Motor", label: "Motor" },
                { value: "Non Motor", label: "Non Motor" },
              ].map((option) => {
                const selected = (businessLine ?? "") === option.value;
                return (
                  <button
                    key={option.value || "all"}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    onClick={() => applyBusiness(option.value)}
                    className={`flex w-full items-center rounded-md px-3 py-2 text-left text-[11px] font-semibold text-[#344862] transition hover:bg-[#f1f3f5] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#d7dee7] ${selected ? "bg-[#f7f8fa]" : "bg-white"}`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#d9e0e8] bg-white px-3 text-[10.5px] font-bold text-[#526174] transition hover:border-[#b9c5d2] hover:bg-[#f8fafc]"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters
          {activeCount ? <span className="rounded-full bg-[#17365D] px-1.5 py-0.5 text-[8px] text-white">{activeCount}</span> : null}
        </button>
      </div>

      {open ? (
        <div className="fixed inset-0 z-[90]">
          <button type="button" aria-label="Close report filters" onClick={() => setOpen(false)} className="absolute inset-0 bg-[#0f172a]/25 backdrop-blur-[1px]" />
          <aside className={`absolute right-0 flex w-full max-w-[410px] flex-col border-l border-[#dbe3ec] bg-white shadow-[-20px_0_60px_rgba(15,23,42,.15)] ${compactDrawer ? "inset-y-0 sm:bottom-auto sm:max-h-full" : "inset-y-0"}`}>
            <div className="flex items-center justify-between border-b border-[#e8ecf1] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-bold text-[#1b2943]">Filter report</h2>
                <p className="mt-0.5 text-[9.5px] text-[#7b8799]">Keep the main report clean and narrow the data only when needed.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e0e6ee] text-[#667085] hover:bg-[#f8fafc]"><X className="h-4 w-4" /></button>
            </div>

            <div className={`${compactDrawer ? "min-h-0 flex-1 sm:flex-initial" : "flex-1"} overflow-y-auto px-5 py-5`}>
              {businessLine === "Non Motor" ? (
                <FilterGroup title="Business">
                  <Field label="Non-Motor category">
                    <select value={draftCategory} onChange={(event) => setDraftCategory(event.target.value)} className={inputClass}>
                      <option value="">All categories</option>
                      {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  </Field>
                </FilterGroup>
              ) : null}

              <FilterGroup title="Reporting dimensions">
                <div className="grid gap-3 sm:grid-cols-2">
                  {fields.filter((field) => field.type !== "date").map((field) => (
                    <Field key={field.name} label={field.label}>
                      <select value={draft[field.name] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [field.name]: event.target.value }))} className={inputClass}>
                        <option value="">{field.placeholder ?? `All ${field.label.toLowerCase()}`}</option>
                        {(field.options ?? []).map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </Field>
                  ))}
                </div>
              </FilterGroup>

              {fields.some((field) => field.type === "date") ? (
                <FilterGroup title="Custom date range">
                  <div className="grid grid-cols-2 gap-3">
                    {fields.filter((field) => field.type === "date").map((field) => (
                      <Field key={field.name} label={field.label}>
                        <input type="date" value={draft[field.name] ?? ""} onChange={(event) => setDraft((current) => ({ ...current, [field.name]: event.target.value }))} className={inputClass} />
                      </Field>
                    ))}
                  </div>
                  <p className="mt-2 text-[8.5px] leading-4 text-[#8a96a7]">Changing either date switches the report to Custom period. The quick period buttons remain available on the main page.</p>
                </FilterGroup>
              ) : null}
            </div>

            <div className={`flex shrink-0 items-center justify-between gap-3 border-t border-[#e8ecf1] bg-[#fbfcfd] px-5 py-4 ${compactDrawer ? "sticky bottom-0 z-10" : ""}`}>
              <button type="button" onClick={clearAdvanced} className="h-9 rounded-lg border border-[#d9e0e8] bg-white px-3 text-[10px] font-bold text-[#667085] hover:bg-[#f8fafc]">Clear filters</button>
              <button type="button" onClick={applyAdvanced} className="h-9 rounded-lg bg-[#214f80] px-4 text-[10.5px] font-bold text-white hover:bg-[#183f69]">Apply filters</button>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}

const inputClass = "h-10 w-full rounded-lg border border-[#d9e0e8] bg-white px-2.5 text-[10.5px] font-semibold text-[#344054] outline-none transition focus:border-[#7692b6] focus:ring-2 focus:ring-[#e9f0f7]";

function FilterGroup({ title, children }: { title: string; children: ReactNode }) {
  return <section className="mb-6"><h3 className="mb-3 text-[9px] font-black uppercase tracking-[.09em] text-[#7c899b]">{title}</h3>{children}</section>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[9px] font-bold text-[#667085]">{label}</span>{children}</label>;
}

function clearPages(params: URLSearchParams) {
  for (const [key] of Array.from(params.entries())) {
    if (key.toLowerCase().includes("page")) params.delete(key);
  }
}
