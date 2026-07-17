"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { InsureItLoader } from "./insureit-loader";

const minimumVisibleMs = 360;
const networkQuietMs = 220;
const domQuietMs = 180;
const safetyTimeoutMs = 20000;
const userIntentWindowMs = 1200;
const routeConfirmationMs = 1500;

type LoadingIntent = {
  label: string;
  expiresAt: number;
};

function delay(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function waitForAnimationFrames() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

function waitForDocumentReady() {
  if (document.readyState === "complete") return Promise.resolve();
  return new Promise<void>((resolve) => {
    const timeout = window.setTimeout(resolve, 4000);
    window.addEventListener("load", () => {
      window.clearTimeout(timeout);
      resolve();
    }, { once: true });
  });
}

async function waitForFonts() {
  if (!("fonts" in document)) return;
  await Promise.race([document.fonts.ready.then(() => undefined), delay(1600)]);
}

function isVisibleImage(image: HTMLImageElement) {
  if (image.loading !== "lazy") return true;
  const rect = image.getBoundingClientRect();
  return rect.bottom >= 0 && rect.top <= window.innerHeight && rect.right >= 0 && rect.left <= window.innerWidth;
}

async function waitForImages() {
  const images = Array.from(document.images).filter((image) => !image.complete && isVisibleImage(image));
  if (!images.length) return;
  await Promise.race([
    Promise.all(images.map((image) => new Promise<void>((resolve) => {
      image.addEventListener("load", () => resolve(), { once: true });
      image.addEventListener("error", () => resolve(), { once: true });
    }))).then(() => undefined),
    delay(2600),
  ]);
}

function waitForDomQuiet() {
  return new Promise<void>((resolve) => {
    const root = document.querySelector("main") ?? document.body;
    let quietTimer = window.setTimeout(finish, domQuietMs);
    const maximumTimer = window.setTimeout(finish, 1400);
    const observer = new MutationObserver(() => {
      window.clearTimeout(quietTimer);
      quietTimer = window.setTimeout(finish, domQuietMs);
    });

    function finish() {
      observer.disconnect();
      window.clearTimeout(quietTimer);
      window.clearTimeout(maximumTimer);
      resolve();
    }

    observer.observe(root, { childList: true, subtree: true, attributes: true, characterData: true });
  });
}

function requestHeaders(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(input instanceof Request ? input.headers : undefined);
  if (init?.headers) new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  return headers;
}

function isNextNavigationRequest(input: RequestInfo | URL, init?: RequestInit) {
  const url = input instanceof Request ? input.url : input.toString();
  const headers = requestHeaders(input, init);
  return url.includes("_rsc=")
    || headers.has("RSC")
    || headers.has("Next-Router-State-Tree")
    || headers.get("Accept")?.includes("text/x-component") === true;
}

function GlobalNavigationLoaderInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const searchKey = searchParams.toString();
  const [loading, setLoading] = useState(true);
  const [label, setLabel] = useState("Loading page");
  const loadingRef = useRef(true);
  const labelRef = useRef("Loading page");
  const startedAtRef = useRef(Date.now());
  const activeRequestsRef = useRef(0);
  const routePendingRef = useRef(false);
  const routeStartUrlRef = useRef("");
  const intentRef = useRef<LoadingIntent | null>(null);
  const settleVersionRef = useRef(0);
  const safetyTimerRef = useRef<number | null>(null);
  const routeFallbackTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const setDocumentBusy = useCallback((busy: boolean) => {
    if (busy) {
      document.documentElement.dataset.insureitGlobalLoading = "true";
      document.body.setAttribute("aria-busy", "true");
    } else {
      delete document.documentElement.dataset.insureitGlobalLoading;
      document.body.removeAttribute("aria-busy");
    }
  }, []);

  const clearSafetyTimer = useCallback(() => {
    if (safetyTimerRef.current) window.clearTimeout(safetyTimerRef.current);
    safetyTimerRef.current = null;
  }, []);

  const clearRouteFallback = useCallback(() => {
    if (routeFallbackTimerRef.current) window.clearTimeout(routeFallbackTimerRef.current);
    routeFallbackTimerRef.current = null;
  }, []);

  const hideLoader = useCallback(() => {
    settleVersionRef.current += 1;
    clearSafetyTimer();
    clearRouteFallback();
    routePendingRef.current = false;
    routeStartUrlRef.current = "";
    intentRef.current = null;
    loadingRef.current = false;
    if (mountedRef.current) setLoading(false);
    setDocumentBusy(false);
  }, [clearRouteFallback, clearSafetyTimer, setDocumentBusy]);

  const showLoader = useCallback((nextLabel = "Loading page") => {
    settleVersionRef.current += 1;
    clearSafetyTimer();
    labelRef.current = nextLabel;
    if (mountedRef.current) setLabel(nextLabel);
    if (!loadingRef.current) {
      startedAtRef.current = Date.now();
      loadingRef.current = true;
      if (mountedRef.current) setLoading(true);
    }
    setDocumentBusy(true);
    safetyTimerRef.current = window.setTimeout(hideLoader, safetyTimeoutMs);
  }, [clearSafetyTimer, hideLoader, setDocumentBusy]);

  const settleLoader = useCallback(async () => {
    if (!loadingRef.current || routePendingRef.current || activeRequestsRef.current > 0) return;
    const version = ++settleVersionRef.current;

    await delay(networkQuietMs);
    if (version !== settleVersionRef.current || routePendingRef.current || activeRequestsRef.current > 0) return;

    await waitForDocumentReady();
    await waitForFonts();
    await waitForImages();
    await waitForDomQuiet();
    await waitForAnimationFrames();

    const remaining = minimumVisibleMs - (Date.now() - startedAtRef.current);
    if (remaining > 0) await delay(remaining);
    if (version !== settleVersionRef.current || routePendingRef.current || activeRequestsRef.current > 0) return;
    hideLoader();
  }, [hideLoader]);

  const armIntent = useCallback((nextLabel: string) => {
    const intent = { label: nextLabel, expiresAt: Date.now() + userIntentWindowMs };
    intentRef.current = intent;
    window.setTimeout(() => {
      if (intentRef.current !== intent) return;
      intentRef.current = null;
      if (!routePendingRef.current && activeRequestsRef.current === 0) void settleLoader();
    }, userIntentWindowMs + 50);
  }, [settleLoader]);

  const beginRoute = useCallback((nextLabel = "Loading page") => {
    const startingUrl = window.location.href;
    routeStartUrlRef.current = startingUrl;
    armIntent(nextLabel);
    clearRouteFallback();
    routePendingRef.current = true;
    showLoader(nextLabel);

    const confirmRoute = () => {
      if (!routePendingRef.current || window.location.href !== startingUrl) return;
      if (activeRequestsRef.current > 0) {
        routeFallbackTimerRef.current = window.setTimeout(confirmRoute, 300);
        return;
      }
      routePendingRef.current = false;
      routeStartUrlRef.current = "";
      void settleLoader();
    };

    routeFallbackTimerRef.current = window.setTimeout(confirmRoute, routeConfirmationMs);
  }, [armIntent, clearRouteFallback, settleLoader, showLoader]);

  useEffect(() => {
    clearRouteFallback();
    routePendingRef.current = false;
    routeStartUrlRef.current = "";
    void settleLoader();
  }, [clearRouteFallback, pathname, searchKey, settleLoader]);

  useEffect(() => {
    mountedRef.current = true;
    setDocumentBusy(true);
    void settleLoader();

    const originalFetch = window.fetch.bind(window);
    const originalPushState = window.history.pushState;
    const originalReplaceState = window.history.replaceState;

    window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const intent = intentRef.current;
      const intentActive = Boolean(intent && intent.expiresAt >= Date.now());
      const tracked = loadingRef.current || intentActive || isNextNavigationRequest(input, init);

      if (tracked) {
        activeRequestsRef.current += 1;
        showLoader(intentActive ? intent?.label ?? labelRef.current : labelRef.current);
      }

      try {
        return await originalFetch(input, init);
      } finally {
        if (tracked) {
          activeRequestsRef.current = Math.max(0, activeRequestsRef.current - 1);
          if (activeRequestsRef.current === 0) void settleLoader();
        }
      }
    }) as typeof window.fetch;

    function changedUrl(previousUrl: string) {
      return previousUrl !== window.location.href;
    }

    window.history.pushState = function (...args: Parameters<History["pushState"]>) {
      const previousUrl = window.location.href;
      const result = originalPushState.apply(this, args);
      if (changedUrl(previousUrl)) {
        const intent = intentRef.current;
        beginRoute(intent?.label ?? "Loading page");
      }
      return result;
    };

    window.history.replaceState = function (...args: Parameters<History["replaceState"]>) {
      const previousUrl = window.location.href;
      const result = originalReplaceState.apply(this, args);
      if (changedUrl(previousUrl)) {
        const intent = intentRef.current;
        beginRoute(intent?.label ?? "Loading page");
      }
      return result;
    };

    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target as Element | null;
      const anchor = target?.closest("a[href]") as HTMLAnchorElement | null;

      if (anchor) {
        if (anchor.dataset.noLoader === "true" || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash === window.location.hash) return;
        if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
        beginRoute(anchor.dataset.loadingLabel ?? "Loading page");
        return;
      }

      const button = target?.closest("button, input[type='button'], input[type='submit'], [role='button']") as HTMLElement | null;
      if (!button || button.dataset.noLoader === "true" || button.getAttribute("aria-disabled") === "true" || button.hasAttribute("disabled")) return;
      const nativeButton = button as HTMLButtonElement;
      const type = nativeButton.type?.toLowerCase();
      if (type === "submit" && nativeButton.form) return;

      const nextLabel = button.dataset.loadingLabel ?? button.getAttribute("aria-label") ?? "Loading";
      armIntent(nextLabel);
      if (button.dataset.showLoader === "true" || button.dataset.loadingLabel) showLoader(nextLabel);
    }

    function handleChange(event: Event) {
      const control = event.target as HTMLElement | null;
      if (!control || control.dataset.noLoader === "true") return;
      if (!control.matches("select, input[type='checkbox'], input[type='radio']")) return;
      armIntent(control.dataset.loadingLabel ?? "Updating");
    }

    function handleSubmit(event: SubmitEvent) {
      const form = event.target as HTMLFormElement | null;
      if (!form || form.dataset.noLoader === "true" || form.method.toLowerCase() === "dialog" || form.target === "_blank") return;
      if (!form.noValidate && !form.checkValidity()) return;
      const nextLabel = form.dataset.loadingLabel ?? "Saving changes";
      armIntent(nextLabel);
      showLoader(nextLabel);
      window.setTimeout(() => {
        if (!routePendingRef.current && activeRequestsRef.current === 0) void settleLoader();
      }, 650);
    }

    function handlePopState() {
      beginRoute("Loading page");
    }

    function handleBeforeUnload() {
      showLoader("Loading page");
    }

    function handlePageShow() {
      routePendingRef.current = false;
      routeStartUrlRef.current = "";
      showLoader("Loading page");
      void settleLoader();
    }

    document.addEventListener("click", handleClick, true);
    document.addEventListener("change", handleChange, true);
    document.addEventListener("submit", handleSubmit, true);
    window.addEventListener("popstate", handlePopState);
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      mountedRef.current = false;
      window.fetch = originalFetch;
      window.history.pushState = originalPushState;
      window.history.replaceState = originalReplaceState;
      document.removeEventListener("click", handleClick, true);
      document.removeEventListener("change", handleChange, true);
      document.removeEventListener("submit", handleSubmit, true);
      window.removeEventListener("popstate", handlePopState);
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("pageshow", handlePageShow);
      clearSafetyTimer();
      clearRouteFallback();
      setDocumentBusy(false);
    };
  }, [armIntent, beginRoute, clearRouteFallback, clearSafetyTimer, setDocumentBusy, settleLoader, showLoader]);

  if (!loading) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] grid place-items-center bg-white/32 px-4 backdrop-blur-[3px]"
      aria-live="polite"
      aria-busy="true"
      data-insureit-global-loader="true"
    >
      <div className="w-full max-w-[300px] rounded-3xl border border-white/90 bg-white/95 p-6 shadow-[0_24px_70px_rgba(7,29,73,0.2)]">
        <InsureItLoader label={label} sublabel="Please wait while the page finishes loading." />
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
