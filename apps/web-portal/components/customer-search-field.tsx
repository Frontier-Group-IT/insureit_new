"use client";

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react";

export type CustomerSearchOption = { label: string; value: string };

export function CustomerSearchField({
  label,
  name,
  options,
  defaultValue,
  required = false,
  labelAction,
  onSelectionChange,
  disabled = false,
  containedResults = false,
}: {
  label: string;
  name: string;
  options: CustomerSearchOption[];
  defaultValue?: string | null;
  required?: boolean;
  labelAction?: ReactNode;
  onSelectionChange?: (value: string) => void;
  disabled?: boolean;
  containedResults?: boolean;
}) {
  const initialOption = options.find((option) => option.value === (defaultValue ?? "")) ?? null;
  const [query, setQuery] = useState(initialOption?.label ?? "");
  const [selectedValue, setSelectedValue] = useState(initialOption?.value ?? "");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLocaleLowerCase().includes(normalized));
  }, [options, query]);

  function selectOption(option: CustomerSearchOption) {
    setQuery(option.label);
    setSelectedValue(option.value);
    setOpen(false);
    setActiveIndex(0);
    inputRef.current?.setCustomValidity("");
    onSelectionChange?.(option.value);
  }

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedValue("");
    onSelectionChange?.("");
    setOpen(true);
    setActiveIndex(0);
    if (required && value.trim()) inputRef.current?.setCustomValidity("Select a customer from the matching results.");
    else inputRef.current?.setCustomValidity("");
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((current) => Math.min(current + 1, Math.max(matches.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && open && matches[activeIndex]) {
      event.preventDefault();
      selectOption(matches[activeIndex]);
      return;
    }
    if (event.key === "Escape") setOpen(false);
  }

  const listboxId = `${name}-matches`;

  return (
    <div className="relative min-w-0">
      {labelAction ? (
        <div className="mb-1 flex items-center gap-1.5">
          <label className="block text-[10.5px] font-semibold text-[#344054]" htmlFor={`${name}_search`}>
            {label}{required ? " *" : ""}
          </label>
          {labelAction}
        </div>
      ) : (
        <label className="mb-1 block text-[10.5px] font-semibold text-[#344054]" htmlFor={`${name}_search`}>
          {label}{required ? " *" : ""}
        </label>
      )}
      <input type="hidden" name={name} value={selectedValue} />
      <input
        ref={inputRef}
        id={`${name}_search`}
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open && matches[activeIndex] ? `${name}-option-${activeIndex}` : undefined}
        autoComplete="off"
        required={required}
        value={query}
        placeholder="Search customer"
        disabled={disabled}
        className="h-10 w-full rounded-xl border border-[#CBD5E1] bg-white px-3 text-[12px] text-[#17203A] outline-none transition placeholder:text-[#98A2B3] focus:border-[#4F46E5] focus:ring-2 focus:ring-[#E0E7FF] disabled:cursor-not-allowed disabled:border-[#E3E8EF] disabled:bg-[#F8FAFC] disabled:text-[#64748B]"
        onFocus={() => setOpen(true)}
        onChange={(event) => handleQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
      />
      {open ? (
        <div
          id={listboxId}
          role="listbox"
          className={`${containedResults ? "relative z-20" : "absolute z-50"} mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-[#D7E1EE] bg-white p-1.5 shadow-[0_14px_35px_rgba(15,23,42,0.16)]`}
        >
          {matches.length ? (
            matches.map((option, index) => (
              <button
                key={option.value}
                id={`${name}-option-${index}`}
                type="button"
                role="option"
                aria-selected={option.value === selectedValue}
                className={`block w-full rounded-lg px-3 py-2 text-left text-[11px] transition ${
                  index === activeIndex ? "bg-[#EEF4FF] text-[#17365D]" : "text-[#334155] hover:bg-[#F8FAFC]"
                }`}
                onMouseDown={(event) => event.preventDefault()}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => selectOption(option)}
              >
                {option.label}
              </button>
            ))
          ) : (
            <div className="px-3 py-2 text-[10.5px] text-[#64748B]">No matching customer</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
