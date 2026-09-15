"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

 type Suggestion = {
  value: string;
  label: string;
  meta: string;
  kind: string;
};

type SearchConfig = {
  scope: "customers" | "policies" | "renewals" | "claims" | "payout" | "global" | "policy-intakes";
  selector: string;
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

const SEARCH_DEBOUNCE_MS = 180;

function searchConfig(pathname: string): SearchConfig | null {
  if (pathname === "/partner/customers") {
    return { scope: "customers", selector: 'input[aria-label^="Search customers"]' };
  }
  if (pathname === "/partner/payout") {
    return { scope: "payout", selector: 'input[aria-label="Search payout records"]' };
  }
  if (pathname.startsWith("/partner/claims")) {
    return { scope: "claims", selector: 'input[aria-label="Search claims"]' };
  }
  if (pathname === "/partner/policy-intakes") {
    return { scope: "policy-intakes", selector: 'input[placeholder^="Search PIR"]' };
  }
  if (pathname === "/partner/policies") {
    return { scope: "policies", selector: 'input[name="q"][placeholder^="Search policy"]' };
  }
  if (pathname.startsWith("/partner/renewals")) {
    return { scope: "renewals", selector: 'input[name="q"]' };
  }
  if (pathname === "/partner/search") {
    return { scope: "global", selector: 'input[name="q"][placeholder^="Customer, policy"]' };
  }
  return null;
}

function positionFor(input: HTMLInputElement) {
  const rect = input.getBoundingClientRect();
  return {
    left: Math.max(8, rect.left),
    top: rect.bottom + 6,
    width: Math.max(280, rect.width),
  };
}

function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  if (setter) setter.call(input, value);
  else input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

function intakeField(row: IntakeRow, ...keys: string[]) {
  for (const key of keys) {
    const value = row.ocr_fields?.find((field) => field.key === key)?.value?.trim();
    if (value) return value;
  }
  return "";
}

function intakeSuggestions(rows: IntakeRow[], query: string): Suggestion[] {
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

    if (!values.some((value) => value.toLowerCase().includes(normalized))) continue;

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

export function PartnerSearchAutocompleteEnhancer() {
  const pathname = usePathname();
  const config = searchConfig(pathname);
  const [input, setInput] = useState<HTMLInputElement | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [position, setPosition] = useState({ left: 0, top: 0, width: 0 });
  const intakeRowsRef = useRef<IntakeRow[] | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!config) {
      setInput(null);
      setOpen(false);
      return;
    }

    const findInput = () => document.querySelector<HTMLInputElement>(config.selector);
    const syncInput = () => {
      const next = findInput();
      if (next !== input) setInput(next);
    };

    syncInput();
    const observer = new MutationObserver(syncInput);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [config?.scope, config?.selector, input]);

  useEffect(() => {
    if (!input || !config) return;

    const updatePosition = () => setPosition(positionFor(input));
    const onFocus = () => {
      updatePosition();
      if (input.value.trim().length >= 2 && suggestions.length) setOpen(true);
    };
    const onScrollOrResize = () => {
      if (document.activeElement === input || open) updatePosition();
    };

    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-haspopup", "listbox");
    input.addEventListener("focus", onFocus);
    window.addEventListener("resize", onScrollOrResize);
    window.addEventListener("scroll", onScrollOrResize, true);
    updatePosition();

    return () => {
      input.removeAttribute("aria-autocomplete");
      input.removeAttribute("aria-haspopup");
      input.removeEventListener("focus", onFocus);
      window.removeEventListener("resize", onScrollOrResize);
      window.removeEventListener("scroll", onScrollOrResize, true);
    };
  }, [config, input, open, suggestions.length]);

  useEffect(() => {
    if (!input || !config) return;

    let timer: number | undefined;
    let controller: AbortController | undefined;

    const fetchIntakeRows = async () => {
      if (intakeRowsRef.current) return intakeRowsRef.current;
      const rows: IntakeRow[] = [];
      let offset = 0;
      let total = 0;

      do {
        const response = await fetch(`/api/partner/policy-intakes?limit=50&offset=${offset}&filter=all`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const payload = await response.json().catch(() => null) as {
          ok?: boolean;
          intakes?: IntakeRow[];
          total?: number;
        } | null;
        if (!response.ok || !payload?.ok) break;
        const batch = payload.intakes ?? [];
        if (!offset) total = payload.total ?? batch.length;
        rows.push(...batch);
        offset += batch.length;
        if (!batch.length) break;
      } while (offset < total && offset < 1000);

      intakeRowsRef.current = rows;
      return rows;
    };

    const loadSuggestions = async () => {
      const query = input.value.trim();
      const requestId = ++requestIdRef.current;
      if (query.length < 2) {
        setSuggestions([]);
        setOpen(false);
        setActiveIndex(-1);
        return;
      }

      try {
        let next: Suggestion[] = [];
        if (config.scope === "policy-intakes") {
          const rows = await fetchIntakeRows();
          next = intakeSuggestions(rows, query);
        } else {
          controller?.abort();
          controller = new AbortController();
          const response = await fetch(
            `/api/partner/search-suggestions?scope=${encodeURIComponent(config.scope)}&q=${encodeURIComponent(query)}`,
            { credentials: "same-origin", cache: "no-store", signal: controller.signal },
          );
          const payload = await response.json().catch(() => null) as {
            ok?: boolean;
            suggestions?: Suggestion[];
          } | null;
          if (!response.ok || !payload?.ok) return;
          next = payload.suggestions ?? [];
        }

        if (requestId !== requestIdRef.current) return;
        setSuggestions(next);
        setActiveIndex(next.length ? 0 : -1);
        setPosition(positionFor(input));
        setOpen(next.length > 0 && document.activeElement === input);
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    };

    const onInput = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        void loadSuggestions();
      }, SEARCH_DEBOUNCE_MS);
    };

    input.addEventListener("input", onInput);
    if (input.value.trim().length >= 2) onInput();

    return () => {
      input.removeEventListener("input", onInput);
      window.clearTimeout(timer);
      controller?.abort();
    };
  }, [config, input]);

  const chooseSuggestion = (suggestion: Suggestion) => {
    if (!input) return;
    setNativeInputValue(input, suggestion.value);
    setOpen(false);
    setActiveIndex(-1);
    if (input.form) {
      window.setTimeout(() => input.form?.requestSubmit(), 0);
    }
    input.focus();
  };

  useEffect(() => {
    if (!input || !open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (!suggestions.length) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((index) => (index + 1) % suggestions.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
      } else if (event.key === "Enter" && activeIndex >= 0) {
        event.preventDefault();
        chooseSuggestion(suggestions[activeIndex]);
      } else if (event.key === "Escape") {
        setOpen(false);
      }
    };

    input.addEventListener("keydown", onKeyDown);
    return () => input.removeEventListener("keydown", onKeyDown);
  }, [activeIndex, input, open, suggestions]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (input?.contains(target)) return;
      const list = document.getElementById("partner-search-autocomplete-list");
      if (list?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [input, open]);

  if (!config || !input || !open || !suggestions.length) return null;

  return (
    <div
      id="partner-search-autocomplete-list"
      role="listbox"
      className="fixed z-[90] max-h-[320px] overflow-y-auto rounded-xl border border-[#D7E2EE] bg-white p-1.5 shadow-[0_18px_48px_rgba(24,49,83,0.18)]"
      style={{ left: position.left, top: position.top, width: position.width }}
    >
      {suggestions.map((suggestion, index) => (
        <button
          key={`${suggestion.kind}-${suggestion.value}-${index}`}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          onMouseEnter={() => setActiveIndex(index)}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => chooseSuggestion(suggestion)}
          className={`flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition ${
            index === activeIndex ? "bg-[#EEF5FF]" : "hover:bg-[#F7FAFD]"
          }`}
        >
          <span className="mt-0.5 inline-flex shrink-0 rounded-md bg-[#EAF1FB] px-2 py-1 text-[8px] font-extrabold uppercase tracking-[0.04em] text-[#315C8F]">
            {suggestion.kind}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10.5px] font-extrabold text-[#1C304A]">{suggestion.label}</span>
            {suggestion.meta ? (
              <span className="mt-0.5 block truncate text-[9px] font-medium text-[#71829A]">{suggestion.meta}</span>
            ) : null}
          </span>
        </button>
      ))}
    </div>
  );
}
