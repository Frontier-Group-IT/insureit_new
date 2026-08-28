"use client";

import { SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

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
}: {
  path: string;
  businessLine: "Motor" | "Non Motor" | null;
  category: string | null;
  categories: string[];
  period: string;
  fromDate: string | null;
  toDate: string | null;
  fields: ReportCompactFilterField[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [draftCategory, setDraftCategory] = useState(category ?? "");
  const [draft, setDraft] = useState<Record<string, string>>(() => Object.fromEntries(fields.map((field) => [field.name, field.value])));

  useEffect(() => {
    setDraftCategory(category ?? "");
    setDraft(Object.fromEntries(fields.map((field) => [field.name, field.value])));
  }, [category, fields]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

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
    const nextDraft: Record<string, string> = {};
    for (const field of fields) nextDraft[field.name] = field.type === "date" ? field.value : "";
    setDraft(nextDraft);
    setDraftCategory("");
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Business line</span>
          <select
            value={businessLine ?? ""}
            onChange={(event) => applyBusiness(event.target.value)}
            className="h-9 min-w-[148px] rounded-lg border border-[#d9e0e8] bg-white px-3 pr-8 text-[10.5px] font-bold text-[#344054] outline-none transition hover:border-[#b9c5d2] focus:border-[#7692b6] focus:ring-2 focus:ring-[#e9f0f7]"
          >
            <option value="">All Business</option>
            <option value="Motor">Motor</option>
            <option value="Non Motor">Non Motor</option>
          </select>
        </label>
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
          <aside className="absolute inset-y-0 right-0 flex w-full max-w-[410px] flex-col border-l border-[#dbe3ec] bg-white shadow-[-20px_0_60px_rgba(15,23,42,.15)]">
            <div className="flex items-center justify-between border-b border-[#e8ecf1] px-5 py-4">
              <div>
                <h2 className="text-[15px] font-bold text-[#1b2943]">Filter report</h2>
                <p className="mt-0.5 text-[9.5px] text-[#7b8799]">Keep the main report clean and narrow the data only when needed.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="grid h-8 w-8 place-items-center rounded-lg border border-[#e0e6ee] text-[#667085] hover:bg-[#f8fafc]"><X className="h-4 w-4" /></button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-5">
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

            <div className="flex items-center justify-between gap-3 border-t border-[#e8ecf1] bg-[#fbfcfd] px-5 py-4">
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

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="mb-6"><h3 className="mb-3 text-[9px] font-black uppercase tracking-[.09em] text-[#7c899b]">{title}</h3>{children}</section>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[9px] font-bold text-[#667085]">{label}</span>{children}</label>;
}

function clearPages(params: URLSearchParams) {
  for (const [key] of Array.from(params.entries())) {
    if (key.toLowerCase().includes("page")) params.delete(key);
  }
}
