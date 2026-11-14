"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { CustomerAnimatedSearchInput } from "./customer-animated-search-input";

/** Search only records already authorized for the current Customer account. */
export function CustomerSearchAutocomplete({
  value, onChange, options, onSelect, hints, label, name, className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: readonly string[];
  onSelect?: (value: string) => void;
  hints: readonly string[];
  label: string;
  name?: string;
  className?: string;
}) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState<CSSProperties>({});
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const matches = useMemo(() => {
    const q = value.trim().toLocaleLowerCase();
    if (q.length < 2) return [];
    const seen = new Set<string>();
    return options.filter(option => {
      const normalized = option.trim().toLocaleLowerCase();
      if (!normalized || seen.has(normalized) || !normalized.includes(q)) return false;
      seen.add(normalized);
      return true;
    }).slice(0, 5);
  }, [options, value]);
  const visible = mounted && focused && open && value.trim().length >= 2;

  useEffect(() => {
    if (!visible) return;
    const reposition = () => {
      const rect = anchor.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        position: "fixed",
        left: Math.max(8, rect.left),
        top: rect.bottom + 5,
        width: rect.width,
        maxHeight: Math.max(120, Math.min(260, window.innerHeight - rect.bottom - 12)),
        zIndex: 500,
      });
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [visible]);

  function select(selected: string) {
    onChange(selected);
    onSelect?.(selected);
    setOpen(false);
    setActiveIndex(0);
  }
  function keyDown(event: KeyboardEvent<HTMLSpanElement>) {
    if (event.key === "Escape") { setOpen(false); return; }
    if (!value.trim() || value.trim().length < 2) return;
    if (event.key === "ArrowDown" && matches.length) {
      event.preventDefault(); setOpen(true);
      setActiveIndex(index => Math.min(index + 1, matches.length - 1));
    } else if (event.key === "ArrowUp" && matches.length) {
      event.preventDefault(); setActiveIndex(index => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && visible && matches[activeIndex]) {
      event.preventDefault(); select(matches[activeIndex]);
    }
  }

  return (
    <span ref={anchor} className="relative flex min-w-0 flex-1 items-center"
      onFocusCapture={() => { setFocused(true); setOpen(true); }}
      onBlurCapture={() => { setFocused(false); setOpen(false); }}
      onKeyDownCapture={keyDown}>
      <CustomerAnimatedSearchInput
        name={name} value={value}
        onChange={event => { onChange(event.target.value); setOpen(true); setActiveIndex(0); }}
        hints={hints} aria-label={label} aria-autocomplete="list"
        aria-expanded={visible} autoComplete="off" className={className}
      />
      {visible ? createPortal(
        <div role="listbox" aria-label={label + " suggestions"} style={position}
          className="overflow-y-auto rounded-xl border border-[#D7E1EE] bg-white p-1 shadow-[0_14px_35px_rgba(15,23,42,.16)]">
          {matches.length ? matches.map((option,index) => (
            <button key={option} type="button" role="option"
              aria-selected={index === activeIndex}
              className={`block w-full truncate rounded-lg px-3 py-2 text-left text-[12px] ${index === activeIndex ? "bg-[#EDF4FF] text-[#17365D]" : "text-[#334155] hover:bg-[#F8FAFC]"}`}
              onMouseDown={event => event.preventDefault()}
              onClick={() => select(option)}>
              {option}
            </button>
          )) : <p className="px-3 py-2 text-[12px] text-[#64748B]">No matching suggestions</p>}
        </div>, document.body
      ) : null}
    </span>
  );
}
