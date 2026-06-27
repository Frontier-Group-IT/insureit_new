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
  const hideTimeoutRef = useRef<number | null>(null);

  function clearTimers() {
    if (showTimeoutRef.current) window.clearTimeout(showTimeoutRef.current);
    if (hideTimeoutRef.current) window.clearTimeout(hideTimeoutRef.current);
    showTimeoutRef.current = null;
    hideTimeoutRef.current = null;
  }

  useEffect(() => {
    clearTimers();
    setLoading(false);
  }, [pathname, searchParams]);

  useEffect(() => {
    function show(nextLabel: string) {
      clearTimers();
      setLabel(nextLabel);
      showTimeoutRef.current = window.setTimeout(() => setLoading(true), 160);
      hideTimeoutRef.current = window.setTimeout(() => setLoading(false), 2600);
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.dataset.noLoader === "true" || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      show(anchor.dataset.loadingLabel ?? "Loading");
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.dataset.noLoader === "true") return;
      show(form.dataset.loadingLabel ?? "Saving");
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("pageshow", clearTimers);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("pageshow", clearTimers);
      clearTimers();
    };
  }, []);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-white/28 px-4 backdrop-blur-[3px]">
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
