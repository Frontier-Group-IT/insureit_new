"use client";

import { Search, X } from "lucide-react";
import { KeyboardEvent, useEffect, useMemo, useRef, useState } from "react";

type Scope = "customers" | "policies" | "renewals" | "claims" | "payout" | "global" | "policy-intakes";

type Suggestion = {
  value: string;
  label: string;
  meta: string;
  kind: string;
};

type IntakeRow = {
  intake_number: string;
  customer_mobile: string;
  status: string;
  ocr_status: string;
  file_name: string;
  lead_source_name: string;
  ocr_fields?: Array<{ key: string; value: string }>;
};

type Props = {
  scope: Scope;
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  wrapperClassName?: string;
  inputClassName: string;
  searchIconClassName?: string;
  showClear?: boolean;
  clearButtonClassName?: string;
  autoFocus?: boolean;
  autoSubmitOnSelect?: boolean;
};

const DEBOUNCE_MS = 180;

function intakeField(row: IntakeRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row.ocr_fields?.find((field) => field.key === key)?.value?.trim();
    if (value) return value;
  }
  return "";
}

function intakeSuggestions(rows: IntakeRow[], query: string) {
  const normalized = query.toLowerCase();
  const seen = new Set<string>();
  const suggestions: Suggestion[] = [];

  for (const row of rows) {
    const customer = intakeField(row, "customer_name", "insured_name", "policy_holder_name");
    const policy = intakeField(row, "policy_number");
    const vehicle = intakeField(row, "vehicle_registration_number", "registration_number");
    const insurer = intakeField(row, "insurer_name", "insurance_company", "insurer");
    const values = [
      row.intake_number,
      row.customer_mobile,
      row.status,
      row.ocr_status,
      row.file_name,
      row.lead_source_name,
      customer,
      policy,
      vehicle,
      insurer,
    ].filter(Boolean);

    if (!values.some((item) => item.toLowerCase().includes(normalized))) continue;
    const value = row.intake_number || policy || customer || row.customer_mobile;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    suggestions.push({
      value,
      label: row.intake_number || policy || customer || "Policy Intake",
      meta: [customer, policy, vehicle, insurer, row.customer_mobile].filter(Boolean).slice(0, 3).join(" · "),
      kind: "Policy Intake",
    });
    if (suggestions.length >= 8) break;
  }

  return suggestions;
}

export function PartnerAutocompleteInput({
  scope,
  name,
  value,
  defaultValue = "",
  onValueChange,
  placeholder,
  ariaLabel,
  wrapperClassName = "relative min-w-0",
  inputClassName,
  searchIconClassName = "pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7D8DA4]",
  showClear = false,
  clearButtonClassName = "absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-[#7D8DA4] transition hover:bg-[#EEF3F8] hover:text-[#3156B8] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3156B8]/20",
  autoFocus = false,
  autoSubmitOnSelect = false,
}: Props) {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(defaultValue);
  const currentValue = controlled ? value : internalValue;
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const intakeRowsRef = useRef<IntakeRow[] | null>(null);

  const normalized = useMemo(() => currentValue.trim(), [currentValue]);

  const setValue = (nextValue: string) => {
    if (!controlled) setInternalValue(nextValue);
    onValueChange?.(nextValue);
  };

  useEffect(() => {
    if (normalized.length < 2) {
      setSuggestions([]);
      setOpen(false);
      setActiveIndex(-1);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        let next: Suggestion[] = [];

        if (scope === "policy-intakes") {
          if (!intakeRowsRef.current) {
            const rows: IntakeRow[] = [];
            let offset = 0;
            let total = 0;
            do {
              const response = await fetch(`/api/partner/policy-intakes?limit=50&offset=${offset}&filter=all`, {
                credentials: "same-origin",
                cache: "no-store",
                signal: controller.signal,
              });
              const payload = await response.json().catch(() => null) as { ok?: boolean; intakes?: IntakeRow[]; total?: number } | null;
              if (!response.ok || !payload?.ok) break;
              const batch = payload.intakes ?? [];
              if (!offset) total = payload.total ?? batch.length;
              rows.push(...batch);
              offset += batch.length;
              if (!batch.length) break;
            } while (offset < total && offset < 1000);
            intakeRowsRef.current = rows;
          }
          next = intakeSuggestions(intakeRowsRef.current ?? [], normalized);
        } else {
          const response = await fetch(
            `/api/partner/search-suggestions?scope=${encodeURIComponent(scope)}&q=${encodeURIComponent(normalized)}`,
            { credentials: "same-origin", cache: "no-store", signal: controller.signal },
          );
          const payload = await response.json().catch(() => null) as { ok?: boolean; suggestions?: Suggestion[] } | null;
          if (!response.ok || !payload?.ok) return;
          next = payload.suggestions ?? [];
        }

        if (controller.signal.aborted) return;
        setSuggestions(next);
        setActiveIndex(next.length ? 0 : -1);
        setOpen(focused && next.length > 0);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setSuggestions([]);
          setOpen(false);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [focused, normalized, scope]);

  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  const choose = (suggestion: Suggestion) => {
    setValue(suggestion.value);
    setOpen(false);
    setActiveIndex(-1);
    if (autoSubmitOnSelect) {
      window.setTimeout(() => inputRef.current?.form?.requestSubmit(), 0);
    }
    inputRef.current?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !suggestions.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (index + 1) % suggestions.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      choose(suggestions[activeIndex]);
    } else if (event.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className={wrapperClassName}>
      <Search className={searchIconClassName} />
      <input
        ref={inputRef}
        name={name}
        value={currentValue}
        onChange={(event) => setValue(event.target.value)}
        onFocus={() => {
          setFocused(true);
          if (normalized.length >= 2 && suggestions.length) setOpen(true);
        }}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        autoComplete="off"
        autoFocus={autoFocus}
        aria-label={ariaLabel}
        aria-autocomplete="list"
        aria-expanded={open}
        aria-haspopup="listbox"
        className={inputClassName}
      />

      {showClear && currentValue ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            setValue("");
            setSuggestions([]);
            setOpen(false);
            inputRef.current?.focus();
          }}
          aria-label={`Clear ${ariaLabel.toLowerCase()}`}
          className={clearButtonClassName}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}

      {open && suggestions.length ? (
        <div
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-[100] max-h-[320px] overflow-y-auto rounded-xl border border-[#D7E2EE] bg-white p-1.5 shadow-[0_18px_48px_rgba(24,49,83,0.18)]"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={`${suggestion.kind}-${suggestion.value}-${index}`}
              type="button"
              role="option"
              aria-selected={index === activeIndex}
              onMouseEnter={() => setActiveIndex(index)}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => choose(suggestion)}
              className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${index === activeIndex ? "bg-[#EEF5FF]" : "hover:bg-[#F7FAFD]"}`}
            >
              <span className="mt-0.5 inline-flex shrink-0 rounded-md bg-[#EAF1FB] px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.04em] text-[#315C8F]">
                {suggestion.kind}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[10.5px] font-extrabold text-[#1C304A]">{suggestion.label}</span>
                {suggestion.meta ? <span className="mt-0.5 block truncate text-[9px] font-medium text-[#71829A]">{suggestion.meta}</span> : null}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
