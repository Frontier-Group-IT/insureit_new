"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, InputHTMLAttributes } from "react";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue" | "onChange" | "placeholder"> & {
  hints: readonly string[];
  value?: string;
  defaultValue?: string;
  onChange?: (event: ChangeEvent<HTMLInputElement>) => void;
};

export function CustomerAnimatedSearchInput({ hints, value, defaultValue, onChange, className = "", ...props }: Props) {
  const [localValue, setLocalValue] = useState(defaultValue ?? "");
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const text = value ?? localValue;

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (text || reduceMotion || hints.length < 2) return;
    const timer = window.setInterval(() => setIndex(previous => previous + 1), 3200);
    return () => window.clearInterval(timer);
  }, [text, reduceMotion, hints.length]);

  const active = hints.length ? hints[index % hints.length] : "";
  const previous = hints.length && index > 0 ? hints[(index - 1) % hints.length] : null;

  return (
    <span className="relative flex h-5 min-w-0 flex-1 items-center">
      <input
        {...props}
        type="search"
        value={text}
        onChange={event => {
          if (value === undefined) setLocalValue(event.target.value);
          onChange?.(event);
        }}
        className={`relative z-10 h-5 w-full min-w-0 appearance-none border-0 bg-transparent p-0 align-middle leading-5 outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:outline-none ${className}`}
      />
      {!text && active && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 z-0 flex items-center overflow-hidden">
          {previous && !reduceMotion && (
            <span key={`previous-${index}`} className="customer-search-slide-out absolute inset-x-0 top-0 h-5 truncate leading-5">{previous}</span>
          )}
          <span key={`current-${index}`} className={`absolute inset-x-0 top-0 h-5 truncate leading-5 ${index > 0 && !reduceMotion ? "customer-search-slide-in" : ""}`}>{active}</span>
        </span>
      )}
      <style jsx>{`
        @keyframes customer-search-enter { from { transform: translateY(100%); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes customer-search-exit { from { transform: translateY(0); opacity: 1; } to { transform: translateY(-100%); opacity: 0; } }
        .customer-search-slide-in { animation: customer-search-enter 400ms ease-in-out both; }
        .customer-search-slide-out { animation: customer-search-exit 400ms ease-in-out both; }
        @media (prefers-reduced-motion: reduce) {
          .customer-search-slide-in, .customer-search-slide-out { animation: none; }
        }
      `}</style>
    </span>
  );
}
