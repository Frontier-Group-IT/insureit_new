"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { InsureItLoader } from "./insureit-loader";

function GlobalNavigationLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("Loading");
  const showTimeoutRef = useRef<number | null>(null);
  const safetyTimeoutRef = useRef<number | null>(null);
  const navigationStartedRef = useRef(false);

  function clearTimers() {
    if (showTimeoutRef.current) window.clearTimeout(showTimeoutRef.current);
    if (safetyTimeoutRef.current) window.clearTimeout(safetyTimeoutRef.current);
    showTimeoutRef.current = null;
    safetyTimeoutRef.current = null;
  }

  function finishNavigation() {
    clearTimers();
    navigationStartedRef.current = false;
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        window.setTimeout(() => setLoading(false), 120);
      });
    });
  }

  useEffect(() => {
    if (navigationStartedRef.current) finishNavigation();
  }, [pathname, searchParams]);

  useEffect(() => {
    function show(nextLabel: string) {
      clearTimers();
      navigationStartedRef.current = true;
      setLabel(nextLabel);
      showTimeoutRef.current = window.setTimeout(() => setLoading(true), 180);
      safetyTimeoutRef.current = window.setTimeout(() => {
        navigationStartedRef.current = false;
        setLoading(false);
      }, 15000);
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.dataset.noLoader === "true" || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
      show(anchor.dataset.loadingLabel ?? "Loading page");
    }

    function handlePageShow() {
      clearTimers();
      navigationStartedRef.current = false;
      setLoading(false);
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("pageshow", handlePageShow);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("pageshow", handlePageShow);
      clearTimers();
    };
  }, []);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-white/28 px-4 backdrop-blur-[3px]" aria-live="polite" aria-busy="true">
      <div className="w-full max-w-[260px] rounded-3xl border border-white/80 bg-white/92 p-5 shadow-[0_24px_70px_rgba(7,29,73,0.18)]">
        <InsureItLoader label={label} compact />
      </div>
    </div>
  );
}

export function GlobalNavigationLoader() {
  return (
    <Suspense fallback={null}>
      <GlobalNavigationLoaderInner />
    </Suspense>
  );
}
