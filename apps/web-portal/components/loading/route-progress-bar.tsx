"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

const showDelayMs = 180;
const minimumVisibleMs = 280;
const fallbackMs = 4500;

function RouteProgressBarInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [visible, setVisible] = useState(false);
  const visibleRef = useRef(false);
  const startedAtRef = useRef(0);
  const showTimerRef = useRef<number | null>(null);
  const fallbackTimerRef = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (showTimerRef.current) window.clearTimeout(showTimerRef.current);
    if (fallbackTimerRef.current) window.clearTimeout(fallbackTimerRef.current);
    showTimerRef.current = null;
    fallbackTimerRef.current = null;
  }, []);

  const finish = useCallback(() => {
    if (!visibleRef.current) {
      clearTimers();
      return;
    }

    const remaining = minimumVisibleMs - (Date.now() - startedAtRef.current);
    window.setTimeout(() => {
      visibleRef.current = false;
      setVisible(false);
      clearTimers();
    }, Math.max(remaining, 0));
  }, [clearTimers]);

  const start = useCallback(() => {
    clearTimers();
    showTimerRef.current = window.setTimeout(() => {
      startedAtRef.current = Date.now();
      visibleRef.current = true;
      setVisible(true);
      fallbackTimerRef.current = window.setTimeout(finish, fallbackMs);
    }, showDelayMs);
  }, [clearTimers, finish]);

  useEffect(() => {
    finish();
  }, [finish, pathname, searchKey]);

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.dataset.noProgress === "true") return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;
      start();
    }

    function handlePopState() {
      start();
    }

    document.addEventListener("click", handleClick, true);
    window.addEventListener("popstate", handlePopState);
    return () => {
      document.removeEventListener("click", handleClick, true);
      window.removeEventListener("popstate", handlePopState);
      clearTimers();
    };
  }, [clearTimers, start]);

  return (
    <div
      className={`pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[3px] overflow-hidden bg-transparent transition-opacity duration-150 ${visible ? "opacity-100" : "opacity-0"}`}
      aria-hidden={!visible}
    >
      <div className="h-full w-full bg-[#071D49]/10" />
      <div className="absolute inset-y-0 left-0 w-[42%] animate-[insureit-route-rail_1.05s_cubic-bezier(.4,0,.2,1)_infinite] rounded-r-full bg-gradient-to-r from-[#071D49] via-[#D8A31A] to-[#20C997] shadow-[0_0_16px_rgba(216,163,26,0.45)]" />
    </div>
  );
}

export function RouteProgressBar() {
  return (
    <Suspense fallback={null}>
      <RouteProgressBarInner />
    </Suspense>
  );
}
