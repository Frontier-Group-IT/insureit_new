"use client";

import { useEffect, useRef, type ReactNode } from "react";

export type CustomerTheme = "light" | "dark" | "system";
export const customerThemeKey = "insureit:customer-color-theme";
export const customerThemeEvent = "insureit:customer-color-theme-change";

function normalizeTheme(value: unknown): CustomerTheme {
  return value === "dark" || value === "system" ? value : "light";
}

export function readCustomerTheme(): CustomerTheme {
  try { return normalizeTheme(window.localStorage.getItem(customerThemeKey)); }
  catch { return "light"; }
}

export function CustomerThemeScope({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    let preference = readCustomerTheme();
    function apply() {
      if (ref.current) ref.current.dataset.customerTheme = preference === "system" ? (media.matches ? "dark" : "light") : preference;
    }
    function onPreference(event: Event) {
      preference = normalizeTheme((event as CustomEvent<unknown>).detail);
      apply();
    }
    function onStorage(event: StorageEvent) {
      if (event.key === customerThemeKey || event.key === null) { preference = readCustomerTheme(); apply(); }
    }
    apply();
    window.addEventListener(customerThemeEvent, onPreference);
    window.addEventListener("storage", onStorage);
    media.addEventListener("change", apply);
    return () => {
      window.removeEventListener(customerThemeEvent, onPreference);
      window.removeEventListener("storage", onStorage);
      media.removeEventListener("change", apply);
    };
  }, []);
  return <div ref={ref} data-customer-theme="light" className="customer-compact min-h-screen bg-[#F6F8FB] text-[#10213D]">{children}</div>;
}
