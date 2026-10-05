"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ReportsWorkspaceSkeleton } from "@/components/reports/reports-workspace-skeleton";

type ReportsNavigationPendingContextValue = {
  pending: boolean;
  beginReportNavigation: (href?: string) => boolean;
};

const ReportsNavigationPendingContext = createContext<ReportsNavigationPendingContextValue | null>(null);

function currentLocationKey() {
  if (typeof window === "undefined") return "";
  return `${window.location.pathname}${window.location.search}`;
}

function normalizeHref(href: string) {
  if (typeof window === "undefined") return href;
  try {
    const url = new URL(href, window.location.href);
    return `${url.pathname}${url.search}`;
  } catch {
    return href;
  }
}

export function ReportsNavigationPendingProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const routeKey = `${pathname}?${searchParams.toString()}`;
  const [pending, setPending] = useState(false);
  const startedFromRef = useRef("");

  const beginReportNavigation = useCallback((href?: string) => {
    const current = currentLocationKey();
    if (href && normalizeHref(href) === current) return false;
    startedFromRef.current = current;
    setPending(true);
    return true;
  }, []);

  useEffect(() => {
    if (!pending) return;
    const current = currentLocationKey();
    if (startedFromRef.current && current !== startedFromRef.current) {
      setPending(false);
      startedFromRef.current = "";
    }
  }, [pending, routeKey]);

  useEffect(() => {
    if (!pending) return;
    const timeout = window.setTimeout(() => {
      setPending(false);
      startedFromRef.current = "";
    }, 15000);
    return () => window.clearTimeout(timeout);
  }, [pending]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>("a[href]") : null;
      if (!target || target.target === "_blank" || target.hasAttribute("download")) return;
      const url = new URL(target.href, window.location.href);
      if (url.origin !== window.location.origin || !url.pathname.startsWith("/reports")) return;
      if (`${url.pathname}${url.search}` === currentLocationKey()) return;
      beginReportNavigation(`${url.pathname}${url.search}`);
    };

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target instanceof HTMLFormElement ? event.target : null;
      if (!form || !form.closest(".report-page-shell")) return;
      const action = new URL(form.action || window.location.href, window.location.href);
      if (action.origin !== window.location.origin || !action.pathname.startsWith("/reports")) return;
      beginReportNavigation();
    };

    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [beginReportNavigation]);

  const value = useMemo(() => ({ pending, beginReportNavigation }), [pending, beginReportNavigation]);
  return <ReportsNavigationPendingContext.Provider value={value}>{children}</ReportsNavigationPendingContext.Provider>;
}

export function ReportsPendingContent({ children }: { children: ReactNode }) {
  const context = useContext(ReportsNavigationPendingContext);
  const pending = context?.pending ?? false;

  return (
    <div className="relative min-h-[520px]">
      <div className={pending ? "invisible" : "visible"} aria-hidden={pending || undefined}>
        {children}
      </div>
      {pending ? (
        <div className="absolute inset-x-0 top-0 z-20 bg-white">
          <ReportsWorkspaceSkeleton />
        </div>
      ) : null}
    </div>
  );
}

export function useReportsNavigationPending() {
  const context = useContext(ReportsNavigationPendingContext);
  if (!context) {
    throw new Error("useReportsNavigationPending must be used inside ReportsNavigationPendingProvider");
  }
  return context;
}
