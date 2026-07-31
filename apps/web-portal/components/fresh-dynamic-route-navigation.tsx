"use client";

import { useEffect } from "react";

const freshRoutePatterns = [
  /^\/intermediaries\/applications\/[^/]+(?:\/workflow)?\/?$/,
  /^\/customers\/applications\/[^/]+(?:\/registration-form)?\/?$/,
  /^\/customers\/[^/]+\/edit\/?$/,
  /^\/customers\/groups\/[^/]+\/members\/?$/,
  /^\/claims\/[^/]+(?:\/final-documents|\/spot-surveyor)?\/?$/,
  /^\/vehicles\/[^/]+\/edit\/?$/,
  /^\/policies\/[^/]+\/edit\/?$/,
];

export function FreshDynamicRouteNavigation() {
  useEffect(() => {
    function handleClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target;
      if (!(target instanceof Element)) return;

      const anchor = target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download") || anchor.dataset.noFreshNavigation === "true") return;

      const url = new URL(anchor.href, window.location.href);
      if (!shouldFreshNavigate(url)) return;

      event.preventDefault();
      window.location.assign(freshDynamicRouteUrl(url));
    }

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, []);

  return null;
}

export function freshDynamicRouteUrl(href: string | URL) {
  const url = href instanceof URL ? new URL(href) : new URL(href, typeof window === "undefined" ? "http://localhost" : window.location.href);
  url.searchParams.set("fresh", String(Date.now()));
  return `${url.pathname}${url.search}${url.hash}`;
}

function shouldFreshNavigate(url: URL) {
  if (typeof window !== "undefined" && url.origin !== window.location.origin) return false;
  return freshRoutePatterns.some((pattern) => pattern.test(url.pathname));
}
