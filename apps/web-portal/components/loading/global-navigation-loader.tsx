"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { InsureItLoader } from "./insureit-loader";

function GlobalNavigationLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [label, setLabel] = useState("Opening claim workspace");
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    setLoading(false);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
  }, [pathname, searchParams]);

  useEffect(() => {
    function show(nextLabel: string) {
      setLabel(nextLabel);
      window.setTimeout(() => setLoading(true), 80);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => setLoading(false), 8000);
    }

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.dataset.noLoader === "true" || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      show(anchor.dataset.loadingLabel ?? "Opening claim workspace");
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.dataset.noLoader === "true") return;
      show(form.dataset.loadingLabel ?? "Saving claim operation");
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("submit", handleSubmit, true);
    return () => {
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("submit", handleSubmit, true);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!loading) return null;

  return (
    <div className="fixed inset-0 z-[9999] grid place-items-center bg-[#071D49]/18 px-4 backdrop-blur-[3px]">
      <div className="w-full max-w-[360px] rounded-3xl border border-white/70 bg-white/95 p-7 shadow-[0_28px_90px_rgba(7,29,73,0.24)]">
        <InsureItLoader label={label} sublabel="Securing data, updating claim stage and preparing the next workspace." />
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
