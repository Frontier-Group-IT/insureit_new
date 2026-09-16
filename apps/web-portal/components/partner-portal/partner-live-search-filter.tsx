"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

const LIVE_SEARCH_PATHS = new Set([
  "/partner/policies",
  "/partner/renewals",
  "/partner/renewals/external",
  "/partner/search",
  "/partner/vehicles",
]);

const SEARCH_DEBOUNCE_MS = 350;

export function PartnerLiveSearchFilter() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!LIVE_SEARCH_PATHS.has(pathname)) return;

    const timers = new WeakMap<HTMLInputElement, number>();

    const handleInput = (event: Event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement)) return;
      if (input.name !== "q" || input.type === "hidden") return;

      const form = input.closest("form");
      if (!form || form.getAttribute("action") !== pathname) return;

      const existingTimer = timers.get(input);
      if (existingTimer) window.clearTimeout(existingTimer);

      const timer = window.setTimeout(() => {
        const value = input.value.trim();
        const params = new URLSearchParams(searchParams.toString());
        params.delete("page");

        if (value) params.set("q", value);
        else params.delete("q");

        const nextSearch = params.toString();
        router.replace(nextSearch ? `${pathname}?${nextSearch}` : pathname, { scroll: false });
      }, SEARCH_DEBOUNCE_MS);

      timers.set(input, timer);
    };

    document.addEventListener("input", handleInput);
    return () => document.removeEventListener("input", handleInput);
  }, [pathname, router, searchParams]);

  return null;
}
